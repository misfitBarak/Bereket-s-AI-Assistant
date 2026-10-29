import { db } from "../db";
import { processUserMessage } from "../ai/engine";
import { executeTool } from "../ai/tools";
import { getTaskMetrics, getActiveTasks, getBriefingData } from "../services/taskService";
import { listScheduledMessages } from "../services/schedulerService";
import {
  extractAudioInfo,
  downloadTelegramAudio,
  transcribeTelegramAudio,
} from "./voice";
import { sendPersonalMessage } from "./personalClient";

// In-memory sliding cache to prevent duplicate processing of Telegram update IDs
const processedUpdateIds = new Set<number>();
const MAX_STORED_UPDATES = 2000;

export function isUpdateDuplicate(updateId: number): boolean {
  if (processedUpdateIds.has(updateId)) {
    return true;
  }
  processedUpdateIds.add(updateId);
  if (processedUpdateIds.size > MAX_STORED_UPDATES) {
    const oldest = processedUpdateIds.values().next().value;
    if (oldest !== undefined) processedUpdateIds.delete(oldest);
  }
  return false;
}

export function sanitizeTelegramToken(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const match = trimmed.match(/\b(\d{8,12}:[A-Za-z0-9_-]{30,50})\b/);
  if (match) return match[1];
  if (trimmed.startsWith("bot") && trimmed.includes(":")) {
    return trimmed.substring(3);
  }
  return trimmed;
}

export async function getTelegramCredentials() {
  const dbSettings = await db.appSetting.findMany();
  const settingsMap = new Map(dbSettings.map((s) => [s.key, s.value]));

  const rawBotToken = settingsMap.get("TELEGRAM_BOT_TOKEN") || process.env.TELEGRAM_BOT_TOKEN || "";
  const botToken = sanitizeTelegramToken(rawBotToken);
  const allowedUserIdsRaw =
    settingsMap.get("TELEGRAM_ALLOWED_USER_ID") || process.env.TELEGRAM_ALLOWED_USER_ID || "";
  const webhookSecret =
    settingsMap.get("TELEGRAM_WEBHOOK_SECRET") || process.env.TELEGRAM_WEBHOOK_SECRET || "";

  const allowedUserIds = allowedUserIdsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const geminiKey = settingsMap.get("GEMINI_API_KEY") || process.env.GEMINI_API_KEY || "";

  return {
    botToken,
    allowedUserIds,
    webhookSecret,
    geminiKey,
  };
}

export function isUserAuthorized(fromId: number | string | undefined, allowedUserIds: string[]): boolean {
  if (!fromId) return false;
  if (allowedUserIds.length === 0) return false; // Default deny if no allowed user is configured
  return allowedUserIds.includes(String(fromId));
}

export function verifyWebhookSecret(
  incomingSecret: string | null | undefined,
  configuredSecret: string
): boolean {
  if (!configuredSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error("🔒 Security Alert: TELEGRAM_WEBHOOK_SECRET is not configured in production. Failing closed.");
      return false; // Fail closed in production
    }
    return true; // Pass in local development if no secret configured
  }
  if (!incomingSecret) return false;
  return incomingSecret === configuredSecret;
}

/**
 * Split text into safe chunks under Telegram's 4096-character limit
 */
export function chunkMessage(text: string, maxLen: number = 4000): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    // Attempt to split at newline or space
    let splitIdx = remaining.lastIndexOf("\n", maxLen);
    if (splitIdx === -1 || splitIdx < maxLen * 0.5) {
      splitIdx = remaining.lastIndexOf(" ", maxLen);
    }
    if (splitIdx === -1 || splitIdx < maxLen * 0.5) {
      splitIdx = maxLen;
    }
    chunks.push(remaining.substring(0, splitIdx));
    remaining = remaining.substring(splitIdx).trimStart();
  }
  return chunks;
}

/**
 * Send message to Telegram API with automatic chunking and markdown fallback
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  parseMode: "HTML" | "Markdown" | null = "Markdown"
): Promise<{ success: boolean; error?: string }> {
  if (!botToken) {
    return { success: false, error: "TELEGRAM_BOT_TOKEN is not configured" };
  }

  const chunks = chunkMessage(text);
  for (const chunk of chunks) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    try {
      const payload: any = {
        chat_id: chatId,
        text: chunk,
      };
      if (parseMode) payload.parse_mode = parseMode;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // If Markdown formatting failed, retry with plain text
        if (parseMode) {
          delete payload.parse_mode;
          const retryRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!retryRes.ok) {
            const err = await retryRes.text();
            console.error("Telegram send error (plain):", err);
            return { success: false, error: err };
          }
        } else {
          const err = await res.text();
          console.error("Telegram send error:", err);
          return { success: false, error: err };
        }
      }
    } catch (e: any) {
      console.error("Telegram send exception:", e.message);
      return { success: false, error: e.message };
    }
  }

  return { success: true };
}

/**
 * Send 'typing' chat action to indicate the assistant is working
 */
export async function sendTelegramChatAction(
  botToken: string,
  chatId: number | string,
  action: string = "typing"
) {
  if (!botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch {}
}

/**
 * Core Telegram update processor
 */
export async function handleTelegramUpdate(
  update: any,
  secretHeader?: string | null
): Promise<{
  handled: boolean;
  status: "ok" | "ignored" | "unauthorized" | "duplicate" | "bad_secret" | "error";
  replyText?: string;
  error?: string;
}> {
  const { botToken, allowedUserIds, webhookSecret, geminiKey } = await getTelegramCredentials();

  // 1. Verify Webhook Secret if configured
  if (!verifyWebhookSecret(secretHeader, webhookSecret)) {
    console.warn("Telegram webhook rejected: invalid secret header.");
    return { handled: false, status: "bad_secret", error: "Invalid webhook secret" };
  }

  // 2. Validate update structure
  if (!update || typeof update !== "object") {
    return { handled: false, status: "ignored" };
  }

  // 3. Deduplicate update_id
  if (typeof update.update_id === "number") {
    if (isUpdateDuplicate(update.update_id)) {
      return { handled: false, status: "duplicate" };
    }
  }

  const message = update.message;
  if (!message) {
    return { handled: false, status: "ignored" };
  }

  const audioInfo = extractAudioInfo(message);
  if (!message.text && !audioInfo) {
    return { handled: false, status: "ignored" };
  }

  const chatId = message.chat.id;
  const fromId = message.from?.id;
  const chatType = message.chat.type;

  // 4. Enforce private 1-to-1 chats only (Reject group messages for security)
  if (chatType !== "private") {
    if (botToken) {
      await sendTelegramMessage(
        botToken,
        chatId,
        "🔒 *Security Notice*: This private command center only accepts direct private messages."
      );
    }
    return { handled: false, status: "ignored", error: "Non-private chat" };
  }

  // 5. Enforce Authorized User Restriction
  if (!isUserAuthorized(fromId, allowedUserIds)) {
    console.warn(`Unauthorized Telegram access attempt from ID: ${fromId}`);
    if (botToken) {
      await sendTelegramMessage(
        botToken,
        chatId,
        `⛔ *Access Denied*\n\nThis assistant is restricted to the station Graphics Department Lead. Your Telegram user ID is \`${fromId}\`.\n\nTo authorize your account, add this ID to \`TELEGRAM_ALLOWED_USER_ID\` in your command center settings.`
      );
    }
    return { handled: true, status: "unauthorized" };
  }

  // Helper to send reply
  const reply = async (text: string) => {
    if (botToken) {
      await sendTelegramMessage(botToken, chatId, text);
    }
    return text;
  };

  let rawText = (message.text || "").trim();
  let isVoice = false;

  // 6. Handle Voice / Audio Notes if present
  if (audioInfo) {
    if (botToken) {
      sendTelegramChatAction(botToken, chatId, "record_voice");
    }

    const dl = await downloadTelegramAudio(botToken, audioInfo.fileId);
    if (!dl.success || !dl.buffer) {
      const errNotice = `🎙️ *Voice Note Received*\n\n⚠️ Could not download audio: ${dl.error || "Network error"}`;
      await reply(errNotice);
      return { handled: true, status: "error", error: dl.error };
    }

    if (botToken) {
      sendTelegramChatAction(botToken, chatId, "typing");
    }

    const trans = await transcribeTelegramAudio(dl.buffer, dl.mimeType || audioInfo.mimeType, geminiKey);
    if (!trans.success || !trans.text) {
      const errNotice = trans.unintelligible
        ? `🎙️ *Voice Note Received*\n\n⚠️ _I couldn't clearly make out any speech in that audio. Please speak clearly near the microphone or send a written message._`
        : `🎙️ *Voice Note Received*\n\n⚠️ _Transcription error: ${trans.error || "Unable to process audio"}._`;
      await reply(errNotice);
      return { handled: true, status: "error", error: trans.error };
    }

    rawText = trans.text.trim();
    isVoice = true;
  }

  // Indicate assistant is typing
  if (botToken) {
    sendTelegramChatAction(botToken, chatId, "typing");
  }

  const lower = rawText.toLowerCase();

  // 6. Built-in Command: /start
  if (lower === "/start") {
    const text =
      `👋 *Welcome Bereket!*\n\n` +
      `I am your *Personal AI Command Center* on Telegram, connected directly to your Abbay TV Graphics Department, freelance clients, and personal projects.\n\n` +
      `*Available Commands:*\n` +
      `• /tasks — View active priority tasks & deliverables\n` +
      `• /briefing — Daily executive briefing & workload summary\n` +
      `• /status — Assistant connection health & database stats\n` +
      `• /help — Full command and conversation instructions\n\n` +
      `*Natural Conversation:*\n` +
      `You can also text me naturally, e.g.:\n` +
      `• _"Add a high-priority task for Dani to deliver the MMA promo teaser by Friday"_\n` +
      `• _"What is everyone in the Graphics Department working on?"_\n` +
      `• _"Remind me what I decided about the MMA media pack"_`;
    await reply(text);
    return { handled: true, status: "ok", replyText: text };
  }

  // 7. Built-in Command: /help
  if (lower === "/help") {
    const text =
      `📋 *Abbay AI Command Center — Telegram Guide*\n\n` +
      `*Supported Commands:*\n` +
      `• \`/tasks\` — List all active tasks across Abbay TV, Client Work, and Personal Projects.\n` +
      `• \`/tasks abbay_tv\` — Filter for Abbay TV broadcast tasks.\n` +
      `• \`/tasks client\` — Filter for freelance deliverables.\n` +
      `• \`/tasks personal\` — Filter for personal project tasks.\n` +
      `• \`/briefing\` — Instant executive summary of today's focus, department capacity, and urgent deadlines.\n` +
      `• \`/status\` — Health check of active AI model, database records, and authorization.\n` +
      `• \`/scheduled\` — View upcoming scheduled messages, reminders, and recurring reports.\n` +
      `• \`/confirm\` — Approve a pending consequential action (like deleting a task).\n` +
      `• \`/cancel\` — Safely reject a pending action.\n\n` +
      `*Voice & Text:* Send any voice note or message naturally to manage tasks and schedule future actions!`;
    await reply(text);
    return { handled: true, status: "ok", replyText: text };
  }

  // 8. Built-in Command: /status
  if (lower === "/status") {
    const dbSettings = await db.appSetting.findMany();
    const settingsMap = new Map(dbSettings.map((s) => [s.key, s.value]));
    const activeProvider = settingsMap.get("AI_PROVIDER") || process.env.AI_PROVIDER || "auto";
    const currentGeminiModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

    const [metrics, teamCount, projectCount] = await Promise.all([
      getTaskMetrics(),
      db.teamMember.count(),
      db.project.count({ where: { status: { not: "completed" } } }),
    ]);

    const text =
      `🟢 *System Status: Operational*\n\n` +
      `• *AI Provider:* Google Gemini (${currentGeminiModel})\n` +
      `• *Provider Mode:* ${activeProvider === "demo" ? "Autonomous Local Engine" : "Connected (Cloud / Auto)"}\n` +
      `• *Authorized User ID:* \`${fromId}\` (Verified)\n` +
      `• *Database Records:* ${metrics.totalTasks} total tasks (${metrics.activeTasks} active, ${metrics.urgentTasks} urgent, ${metrics.overdueCount} overdue)\n` +
      `• *Graphics Roster:* ${teamCount} artists registered\n` +
      `• *Active Projects:* ${projectCount} projects\n` +
      `• *Workspaces:* Abbay TV (${metrics.byWorkspace.abbay_tv.active} active) | Client (${metrics.byWorkspace.client_work.active} active) | Personal (${metrics.byWorkspace.personal_projects.active} active)\n` +
      `• *Telegram Security:* Private 1-to-1 Verified`;
    await reply(text);
    return { handled: true, status: "ok", replyText: text };
  }

  // 9. Built-in Command: /tasks
  if (lower.startsWith("/tasks")) {
    const parts = lower.split(/\s+/);
    let filterWorkspace = parts[1];
    if (filterWorkspace === "abbay" || filterWorkspace === "abbaytv") filterWorkspace = "abbay_tv";
    if (filterWorkspace === "client") filterWorkspace = "client_work";
    if (filterWorkspace === "personal") filterWorkspace = "personal_projects";

    const validWorkspace = ["abbay_tv", "client_work", "personal_projects"].includes(filterWorkspace)
      ? filterWorkspace
      : undefined;

    const { tasks, total, hasMore } = await getActiveTasks({
      workspace: validWorkspace,
      limit: 30,
    });

    if (tasks.length === 0) {
      const text = `🎉 *No active tasks found* for ${filterWorkspace || "any workspace"}. All caught up!`;
      await reply(text);
      return { handled: true, status: "ok", replyText: text };
    }

    const priorityEmoji: Record<string, string> = {
      urgent: "🔴",
      high: "🟠",
      medium: "🟡",
      low: "⚪",
    };

    let text = `📋 *Active Tasks (${tasks.length}${hasMore ? ` of ${total}` : ""}):*\n\n`;
    for (const t of tasks) {
      const p = priorityEmoji[t.priority] || "🟡";
      const due = t.dueDate ? ` | Due: ${t.dueDate.toISOString().split("T")[0]}` : "";
      const assigned = t.assignedTo ? ` | 👤 ${t.assignedTo}` : "";
      const ws = t.workspace === "abbay_tv" ? "📺 Abbay TV" : t.workspace === "client_work" ? "💼 Client" : "🚀 Personal";
      text += `${p} *${t.title}*\n   _${ws}${assigned}${due}_\n\n`;
    }

    if (hasMore) {
      text += `_Showing top ${tasks.length} of ${total} active tasks. Use filters like /tasks abbay or /tasks client to narrow down._\n\n`;
    }

    text += `_To create or modify tasks, simply type your request naturally!_`;
    await reply(text);
    return { handled: true, status: "ok", replyText: text };
  }

  // 10. Built-in Command: /briefing
  if (lower === "/briefing" || lower.startsWith("/briefing")) {
    const { metrics, workloadReport, activeProjects } = await getBriefingData();

    let text = `☀️ *Abbay AI Command Center — Daily Executive Briefing*\n\n`;

    // 1. Critical Deadlines & Overdue Tasks
    text += `🎯 *Priority Deliverables:*\n`;
    const priorityItems = [...metrics.overdueTasks.map((t) => ({ ...t, isOverdue: true })), ...metrics.todayTasks];
    // Deduplicate by ID
    const seenIds = new Set<string>();
    const uniquePriorities = priorityItems.filter((item) => {
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });

    if (uniquePriorities.length > 0) {
      for (const item of uniquePriorities.slice(0, 6)) {
        const badge = item.isOverdue ? "⚠️ *[OVERDUE]*" : item.priority === "urgent" ? "🔴" : "🟠";
        const assignee = item.assignedTo ? ` (👤 ${item.assignedTo})` : "";
        const due = item.dueDate ? ` — Due: ${new Date(item.dueDate).toISOString().split("T")[0]}` : "";
        text += `• ${badge} *${item.title}*${assignee}${due}\n`;
      }
    } else {
      text += `• No critical urgent or overdue items pending today.\n`;
    }

    // 2. Live Graphics Department Load
    text += `\n👥 *Graphics Department Load:*\n`;
    for (const m of workloadReport.team) {
      const statusIcon = m.isOverloaded ? "🔴 *OVERLOADED*" : m.status === "BUSY" ? "🟡 Busy" : "🟢 Available";
      text += `• *${m.name}*: ${m.assignedHours}h assigned / ${m.capacityHours}h capacity (${m.loadPercent}%) — ${statusIcon}\n`;
    }

    // 3. Balancing Recommendation
    if (workloadReport.recommendations.length > 0) {
      text += `\n⚖️ *Workload Strategy:* ${workloadReport.recommendations[0]}\n`;
    }

    // 4. Project Highlights
    if (activeProjects.length > 0) {
      text += `\n🚀 *Active Projects:*\n`;
      for (const p of activeProjects.slice(0, 3)) {
        text += `• *${p.title}* (${p.workspace}): \`${p.progress}%\` completed\n`;
      }
    }

    text += `\n💡 _Reply with any instruction or question to adjust assignments or update records._`;
    await reply(text);
    return { handled: true, status: "ok", replyText: text };
  }

  // 11. Built-in Command: /scheduled
  if (lower === "/scheduled" || lower === "scheduled" || lower === "my scheduled messages") {
    const list = await listScheduledMessages({ status: "pending" });
    if (list.length === 0) {
      const text = `📅 *No Pending Scheduled Messages*\n\nYou have no upcoming messages or reports scheduled.\n\n_To schedule one, text or say: "Tomorrow at 5 PM, remind Dani to finish thumbnails" or "Every weekday at 8 AM, send me a summary of today's deadlines"._`;
      await reply(text);
      return { handled: true, status: "ok", replyText: text };
    }

    let text = `📅 *Upcoming Scheduled Actions (${list.length}):*\n\n`;
    for (const m of list) {
      const rec = m.recurrence !== "one-time" ? ` 🔁 _[${m.recurrence}]_` : "";
      text += `• *${m.recipient}* (${m.actionType})${rec}\n  ⏰ ${m.scheduledFor}\n  📝 ${m.content}\n  🆔 \`${m.id}\`\n\n`;
    }
    text += `_To cancel or edit, say: "Cancel scheduled message <ID>" or "Move <ID> to 6 PM"._`;
    await reply(text);
    return { handled: true, status: "ok", replyText: text };
  }

  // 11. Consequential Action Confirmation: /confirm and /cancel
  const conversationId = `telegram_${fromId}`;
  if (lower === "/confirm" || lower === "/cancel") {
    // Find the latest assistant message with a pending confirmation
    const lastMsgWithConfirm = await db.chatMessage.findFirst({
      where: {
        conversationId,
        pendingConfirmation: { not: null },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!lastMsgWithConfirm || !lastMsgWithConfirm.pendingConfirmation) {
      const text = `ℹ️ No pending action is currently awaiting your confirmation.`;
      await reply(text);
      return { handled: true, status: "ok", replyText: text };
    }

    // Check expiration safeguard (15-minute window)
    const confirmationAgeMs = Date.now() - new Date(lastMsgWithConfirm.createdAt).getTime();
    const MAX_CONFIRM_AGE_MS = 15 * 60 * 1000; // 15 minutes

    if (confirmationAgeMs > MAX_CONFIRM_AGE_MS) {
      await db.chatMessage.update({
        where: { id: lastMsgWithConfirm.id },
        data: { pendingConfirmation: null },
      });
      const text = `⚠️ *Confirmation Expired*: The pending action timed out (15-minute safeguard window). Please reissue your request.`;
      await reply(text);
      return { handled: true, status: "ok", replyText: text };
    }

    const confirmation = JSON.parse(lastMsgWithConfirm.pendingConfirmation);

    if (lower === "/cancel") {
      await db.chatMessage.update({
        where: { id: lastMsgWithConfirm.id },
        data: { pendingConfirmation: null },
      });
      const text = `🛡️ *Action Cancelled*: The pending ${confirmation.actionType || "action"} was rejected safely.`;
      await reply(text);
      return { handled: true, status: "ok", replyText: text };
    }

    // Execute approved action
    let resultMsg = "";
    if (confirmation.actionType === "delete_task" && confirmation.payload?.taskId) {
      const task = await db.task.findUnique({ where: { id: confirmation.payload.taskId } });
      if (task) {
        await db.task.delete({ where: { id: task.id } });
        await db.activityLog.create({
          data: {
            taskId: null,
            action: "deleted",
            details: `Telegram confirmed deletion of "${task.title}" (ID: ${task.id})`,
          },
        });
        resultMsg = `✅ *Confirmed & Deleted*: Task "${task.title}" has been permanently removed from SQLite.`;
      } else {
        resultMsg = `ℹ️ Task was already removed or not found.`;
      }
    } else if (confirmation.actionType === "send_personal_telegram_message" && confirmation.payload?.peerId) {
      try {
        const sendRes = await sendPersonalMessage(
          confirmation.payload.peerId,
          confirmation.payload.messageText
        );
        resultMsg = `✅ *Confirmed & Sent*: Message dispatched to *${confirmation.payload.recipientName}* from your personal Telegram account.\n\n📝 _"${confirmation.payload.messageText}"_`;
      } catch (err: any) {
        resultMsg = `❌ *Failed to Send from Personal Account*: ${err.message}\n\n(Safety notice: Your message was NOT sent through the bot).`;
      }
    } else {
      resultMsg = `✅ Action was confirmed and executed.`;
    }

    await db.chatMessage.update({
      where: { id: lastMsgWithConfirm.id },
      data: {
        pendingConfirmation: null,
        content: `${lastMsgWithConfirm.content}\n\n*(Safely confirmed via Telegram)*`,
      },
    });

    await reply(resultMsg);
    return { handled: true, status: "ok", replyText: resultMsg };
  }

  // 12. Ordinary Messages (Voice or Text) -> Route to Full AI Assistant (Gemini / Tools)
  try {
    // 1. Record user message in DB
    await db.chatMessage.create({
      data: {
        conversationId,
        role: "user",
        content: isVoice ? `🎤 [Voice Note] ${rawText}` : rawText,
      },
    });

    // 2. Process with AI Engine
    const aiResponse = await processUserMessage(rawText, conversationId);

    // 3. Format response text
    let replyContent = isVoice
      ? `🎤 _"${rawText}"_\n\n${aiResponse.content}`
      : aiResponse.content;

    // If confirmation is required, add Telegram prompt
    if (aiResponse.pendingConfirmation) {
      replyContent +=
        `\n\n⚠️ *Confirmation Required*\n` +
        `This is a consequential action. Reply with */confirm* to execute or */cancel* to abort.`;
    }

    // 4. Record assistant response in DB
    await db.chatMessage.create({
      data: {
        conversationId,
        role: "assistant",
        content: replyContent,
        toolCalls: aiResponse.toolCalls ? JSON.stringify(aiResponse.toolCalls) : null,
        toolResults: aiResponse.toolResults ? JSON.stringify(aiResponse.toolResults) : null,
        pendingConfirmation: aiResponse.pendingConfirmation
          ? JSON.stringify(aiResponse.pendingConfirmation)
          : null,
      },
    });

    await reply(replyContent);
    return { handled: true, status: "ok", replyText: replyContent };
  } catch (err: any) {
    console.error("Telegram message handling error:", err);
    const errNotice =
      `⚠️ *Assistant Error*: Unable to process request (${err.message}).\n` +
      `Your command center remains operational. Try /tasks or /briefing.`;
    await reply(errNotice);
    return { handled: true, status: "error", error: err.message };
  }
}
