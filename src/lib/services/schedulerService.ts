import { db } from "../db";
import { getTaskMetrics, getDepartmentWorkload, getActiveTasks } from "./taskService";
import { sendTelegramMessage } from "../telegram/bot";
import {
  getPersonalAccountStatus,
  sendPersonalMessage,
  resolvePersonalRecipient,
} from "../telegram/personalClient";

const ADDIS_ABABA_TZ_OFFSET_HOURS = 3; // Africa/Addis_Ababa is always UTC+3

export interface ScheduleParseResult {
  scheduledDate: Date; // UTC date for storing
  localFormatted: string; // Formatted in Africa/Addis_Ababa time
  recurrenceRule: string | null; // 'daily' | 'weekdays' | 'weekly' | 'monthly' | null
  warning?: string;
  clarificationRequired?: boolean;
}

/**
 * Parses natural language scheduling instructions into a concrete UTC Date object
 * anchored in the Africa/Addis_Ababa (UTC+3) timezone.
 */
export function resolveScheduledTime(
  input: string,
  options: {
    anchorDate?: Date; // Defaults to current date/time
  } = {}
): ScheduleParseResult {
  const anchor = options.anchorDate || new Date();
  const trimmed = input.trim().toLowerCase();

  // Calculate local Addis Ababa time components for anchor
  const localAnchorTime = new Date(anchor.getTime() + ADDIS_ABABA_TZ_OFFSET_HOURS * 60 * 60 * 1000);
  const localYear = localAnchorTime.getUTCFullYear();
  const localMonth = localAnchorTime.getUTCMonth();
  const localDay = localAnchorTime.getUTCDate();
  const localHours = localAnchorTime.getUTCHours();
  const localMinutes = localAnchorTime.getUTCMinutes();

  let targetYear = localYear;
  let targetMonth = localMonth;
  let targetDay = localDay;
  let targetHour = 9; // Default to 9:00 AM
  let targetMinute = 0;
  let recurrenceRule: string | null = null;
  let isRelativeOffset = false;

  // 1. Detect recurrence rules
  if (trimmed.includes("every weekday") || trimmed.includes("weekdays")) {
    recurrenceRule = "weekdays";
  } else if (trimmed.includes("every day") || trimmed.includes("daily")) {
    recurrenceRule = "daily";
  } else if (trimmed.includes("every monday")) {
    recurrenceRule = "weekly";
  } else if (trimmed.includes("every month") || trimmed.includes("monthly")) {
    recurrenceRule = "monthly";
  }

  // 2. Parse time-of-day (e.g. "5 PM", "5:30 PM", "9 AM", "17:00", "noon", "midnight")
  const timeRegex = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
  const militaryTimeRegex = /\b([01]?\d|2[0-3]):([0-5]\d)\b/;

  const timeMatch = trimmed.match(timeRegex);
  const milMatch = trimmed.match(militaryTimeRegex);

  if (timeMatch) {
    let hr = parseInt(timeMatch[1], 10);
    const min = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const ampm = timeMatch[3].toLowerCase();
    if (ampm === "pm" && hr < 12) hr += 12;
    if (ampm === "am" && hr === 12) hr = 0;
    targetHour = hr;
    targetMinute = min;
  } else if (milMatch) {
    targetHour = parseInt(milMatch[1], 10);
    targetMinute = parseInt(milMatch[2], 10);
  } else if (trimmed.includes("noon")) {
    targetHour = 12;
    targetMinute = 0;
  } else if (trimmed.includes("midnight")) {
    targetHour = 0;
    targetMinute = 0;
  } else if (trimmed.includes("morning")) {
    targetHour = 9;
    targetMinute = 0;
  } else if (trimmed.includes("evening")) {
    targetHour = 18;
    targetMinute = 0;
  } else if (trimmed.includes("afternoon")) {
    targetHour = 15;
    targetMinute = 0;
  }

  // 3. Parse relative offsets ("in 5 minutes", "in 2 hours", "in 30 seconds", "in an hour", "in half an hour")
  const inMinutesMatch = trimmed.match(/\bin\s+(\d+)\s*(?:minutes?|mins?|min\b)/i);
  const inHoursMatch = trimmed.match(/\bin\s+(\d+)\s*(?:hours?|hrs?|hr\b)/i);
  const inSecondsMatch = trimmed.match(/\bin\s+(\d+)\s*(?:seconds?|secs?|sec\b)/i);
  const inAnHour = /\bin\s+(?:an?|one)\s+hour\b/i.test(trimmed);
  const inHalfHour = /\bin\s+(?:half\s+an?\s+hour|30\s*(?:mins?|minutes?))\b/i.test(trimmed);

  let relativeMs = 0;
  if (inMinutesMatch) {
    relativeMs = parseInt(inMinutesMatch[1], 10) * 60 * 1000;
  } else if (inHoursMatch) {
    relativeMs = parseInt(inHoursMatch[1], 10) * 3600 * 1000;
  } else if (inSecondsMatch) {
    relativeMs = parseInt(inSecondsMatch[1], 10) * 1000;
  } else if (inAnHour) {
    relativeMs = 3600 * 1000;
  } else if (inHalfHour) {
    relativeMs = 30 * 60 * 1000;
  }

  if (relativeMs > 0) {
    const scheduledDate = new Date(anchor.getTime() + relativeMs);
    const localTarget = new Date(scheduledDate.getTime() + ADDIS_ABABA_TZ_OFFSET_HOURS * 3600 * 1000);
    const y = localTarget.getUTCFullYear();
    const m = String(localTarget.getUTCMonth() + 1).padStart(2, "0");
    const d = String(localTarget.getUTCDate()).padStart(2, "0");
    const hr = String(localTarget.getUTCHours()).padStart(2, "0");
    const min = String(localTarget.getUTCMinutes()).padStart(2, "0");
    const localFormatted = `${y}-${m}-${d} ${hr}:${min} (Addis Ababa EAT)`;

    return {
      scheduledDate,
      localFormatted,
      recurrenceRule: null,
    };
  }

  // 4. Parse day component ("tomorrow", "today", "next monday", "this friday", etc.)
  if (trimmed.includes("tomorrow")) {
    targetDay += 1;
  } else if (trimmed.includes("today")) {
    // If target time today has already elapsed, move to tomorrow
    if (targetHour < localHours || (targetHour === localHours && targetMinute <= localMinutes)) {
      targetDay += 1;
    }
  } else if (recurrenceRule === "weekdays") {
    // If anchor is weekend or time has passed, find next weekday
    const dayOfWeek = localAnchorTime.getUTCDay(); // 0 is Sun, 6 is Sat
    if (dayOfWeek === 5) {
      // Friday: if time passed, next is Monday (+3 days)
      if (targetHour < localHours || (targetHour === localHours && targetMinute <= localMinutes)) {
        targetDay += 3;
      }
    } else if (dayOfWeek === 6) {
      // Saturday -> Monday (+2 days)
      targetDay += 2;
    } else if (dayOfWeek === 0) {
      // Sunday -> Monday (+1 day)
      targetDay += 1;
    } else {
      // Mon-Thu: if time passed, next day
      if (targetHour < localHours || (targetHour === localHours && targetMinute <= localMinutes)) {
        targetDay += 1;
      }
    }
  } else if (trimmed.includes("monday") || trimmed.includes("tuesday") || trimmed.includes("wednesday") || trimmed.includes("thursday") || trimmed.includes("friday")) {
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const currentDayOfWeek = localAnchorTime.getUTCDay();
    let targetDayOfWeek = -1;
    for (let i = 0; i < dayNames.length; i++) {
      if (trimmed.includes(dayNames[i])) {
        targetDayOfWeek = i;
        break;
      }
    }
    if (targetDayOfWeek !== -1) {
      let diff = targetDayOfWeek - currentDayOfWeek;
      if (diff < 0 || (diff === 0 && (targetHour < localHours || (targetHour === localHours && targetMinute <= localMinutes)))) {
        diff += 7;
      }
      targetDay += diff;
    }
  } else {
    // Check if an explicit ISO date is provided
    const isoMatch = trimmed.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      targetYear = parseInt(isoMatch[1], 10);
      targetMonth = parseInt(isoMatch[2], 10) - 1;
      targetDay = parseInt(isoMatch[3], 10);
    } else {
      // Default: if no day keyword specified, if target hour is past, default to tomorrow
      if (targetHour < localHours || (targetHour === localHours && targetMinute <= localMinutes)) {
        targetDay += 1;
      }
    }
  }

  // Construct target Date in UTC by subtracting the Addis Ababa offset (+3h)
  const targetUtcMs = Date.UTC(targetYear, targetMonth, targetDay, targetHour - ADDIS_ABABA_TZ_OFFSET_HOURS, targetMinute, 0);
  const scheduledDate = new Date(targetUtcMs);

  const localFormatted = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")} ${String(targetHour).padStart(2, "0")}:${String(targetMinute).padStart(2, "0")} (Addis Ababa EAT)`;

  return {
    scheduledDate,
    localFormatted,
    recurrenceRule,
  };
}

/**
 * Resolves a recipient name or description to a known Telegram chat ID.
 */
export async function resolveRecipient(recipientName: string): Promise<{
  name: string;
  chatId: string | null;
  type: "user" | "group" | "self";
  isConfigured: boolean;
  notes?: string;
}> {
  const norm = recipientName.trim().toLowerCase();
  const cleanNorm = norm.replace(/^(the|my)\s+/i, "");

  // 1. Self / Bereket
  if (norm === "me" || norm === "myself" || norm === "self" || norm === "bereket" || norm === "barakat" || norm === "abbay" || norm === "admin") {
    const setting = await db.appSetting.findUnique({ where: { key: "TELEGRAM_ALLOWED_USER_ID" } });
    const chatId = setting?.value || process.env.TELEGRAM_ALLOWED_USER_ID || "375975361";
    return {
      name: "Bereket (Self)",
      chatId,
      type: "self",
      isConfigured: true,
      notes: "Station Graphics Lead (Primary Authorized Account)",
    };
  }

  // 1b. Check configured contact aliases in AppSetting (e.g. "wife" / "the wife" / "my wife" -> "Tigist Haile")
  let effectiveName = recipientName;
  const aliasSetting = await db.appSetting.findUnique({ where: { key: "TELEGRAM_CONTACT_ALIASES" } });
  if (aliasSetting?.value) {
    try {
      const aliases = JSON.parse(aliasSetting.value);
      if (aliases[cleanNorm]) {
        effectiveName = aliases[cleanNorm];
      } else if (aliases[norm]) {
        effectiveName = aliases[norm];
      }
    } catch {}
  }

  // 2. Query TelegramRecipient directory in database
  const rec = await db.telegramRecipient.findFirst({
    where: {
      OR: [
        { name: { equals: effectiveName } },
        { name: { contains: effectiveName } },
        { name: { equals: recipientName } },
        { name: { contains: recipientName } },
        { username: { equals: effectiveName.replace("@", "") } },
        { username: { equals: recipientName.replace("@", "") } },
        { aliases: { contains: cleanNorm } },
        { aliases: { contains: norm } },
      ],
    },
  });

  if (rec && rec.chatId) {
    return {
      name: rec.name,
      chatId: rec.chatId,
      type: rec.type as "user" | "group",
      isConfigured: true,
      notes: rec.notes || undefined,
    };
  }

  // If alias was resolved but not yet registered in TelegramRecipient table:
  if (effectiveName.toLowerCase() !== recipientName.toLowerCase()) {
    return {
      name: effectiveName,
      chatId: rec?.chatId || null,
      type: "user",
      isConfigured: !!rec?.chatId,
      notes: `Configured alias for ${recipientName}`,
    };
  }

  // 3. Fallback check for known Graphics Department team members
  const teamMember = await db.teamMember.findFirst({
    where: {
      OR: [
        { name: { equals: recipientName } },
        { name: { contains: recipientName } },
      ],
    },
  });

  if (teamMember) {
    return {
      name: teamMember.name,
      chatId: null, // Chat ID not yet registered
      type: "user",
      isConfigured: false,
      notes: `${teamMember.role} - Chat ID not yet connected`,
    };
  }

  // 4. Fallback check for Graphics Department group
  if (norm.includes("group") || norm.includes("department") || norm.includes("graphics team")) {
    return {
      name: "Graphics Department (Group)",
      chatId: null,
      type: "group",
      isConfigured: false,
      notes: "Telegram group chat ID not yet connected",
    };
  }

  return {
    name: recipientName,
    chatId: null,
    type: "user",
    isConfigured: false,
  };
}

/**
 * Creates and persists a new scheduled action in SQLite.
 */
export async function createScheduledMessage(data: {
  recipient: string;
  actionType: "direct_message" | "task_report" | "deadline_summary" | "custom_reminder";
  scheduledTimeText: string;
  content?: string;
  reportType?: "pending_tasks" | "today_deadlines" | "department_workload";
  anchorDate?: Date;
  senderAccount?: "bot" | "personal";
  authorizedAt?: Date;
}) {
  const parsedTime = resolveScheduledTime(data.scheduledTimeText, { anchorDate: data.anchorDate });
  const senderAccount = data.senderAccount === "personal" ? "personal" : "bot";

  let recipientName = data.recipient;
  let targetChatId: string | null = null;
  let recipientType: "user" | "group" | "self" = "user";
  let isConfigured = false;

  if (senderAccount === "personal") {
    // Attempt to resolve via personal account directory & aliases
    const personalRes = await resolvePersonalRecipient(data.recipient);
    if (personalRes.resolved && personalRes.peer) {
      recipientName = personalRes.peer.name;
      targetChatId = personalRes.peer.id;
      recipientType = personalRes.peer.isUser ? "user" : "group";
      isConfigured = true;
    } else {
      const fallbackRec = await resolveRecipient(data.recipient);
      recipientName = fallbackRec.name;
      targetChatId = fallbackRec.chatId;
      recipientType = fallbackRec.type;
      isConfigured = fallbackRec.isConfigured;
    }
  } else {
    const recipient = await resolveRecipient(data.recipient);
    recipientName = recipient.name;
    targetChatId = recipient.chatId;
    recipientType = recipient.type;
    isConfigured = recipient.isConfigured;
  }

  const senderBadge = senderAccount === "personal" ? "👤 Personal Account (as you)" : "🤖 Assistant Bot (@BereketAssistantBot)";

  // Idempotency check: prevent duplicate pending jobs across API retries or fallback invocations
  const toleranceMs = 90 * 1000;
  const existingJob = await db.scheduledMessage.findFirst({
    where: {
      status: "pending",
      senderAccount,
      actionType: data.actionType,
      recipientName,
      content: data.content || null,
      scheduledFor: {
        gte: new Date(parsedTime.scheduledDate.getTime() - toleranceMs),
        lte: new Date(parsedTime.scheduledDate.getTime() + toleranceMs),
      },
    },
  });

  if (existingJob) {
    let confirmationMessage = `ℹ️ Reused existing scheduled ${existingJob.actionType.replace("_", " ")} for *${recipientName}* at *${parsedTime.localFormatted}* (Idempotent: duplicate prevented).\n• *Sender Account:* ${senderBadge}`;
    if (parsedTime.recurrenceRule) {
      confirmationMessage += `\n• *Recurrence:* ${parsedTime.recurrenceRule}`;
    }
    if (!isConfigured) {
      confirmationMessage += `\n\n⚠️ *Recipient Notice*: ${recipientName} does not have an active Telegram chat ID configured yet.`;
    }

    return {
      scheduledAction: existingJob,
      confirmationMessage,
      recipient: {
        name: recipientName,
        chatId: targetChatId,
        type: recipientType,
        isConfigured,
      },
      parsedTime,
      isExisting: true,
    };
  }

  const action = await db.scheduledMessage.create({
    data: {
      senderAccount,
      actionType: data.actionType,
      recipientType,
      recipientName,
      targetChatId,
      content: data.content || null,
      reportType: data.reportType || (data.actionType === "task_report" ? "pending_tasks" : data.actionType === "deadline_summary" ? "today_deadlines" : null),
      scheduledFor: parsedTime.scheduledDate,
      timezone: "Africa/Addis_Ababa",
      recurrenceRule: parsedTime.recurrenceRule,
      status: "pending",
      authorizedAt: data.authorizedAt || new Date(),
    },
  });

  let confirmationMessage = `✅ Scheduled ${action.actionType.replace("_", " ")} for *${recipientName}* at *${parsedTime.localFormatted}*\n• *Sender Account:* ${senderBadge}`;
  if (parsedTime.recurrenceRule) {
    confirmationMessage += `\n• *Recurrence:* ${parsedTime.recurrenceRule}`;
  }
  if (!isConfigured) {
    confirmationMessage += `\n\n⚠️ *Recipient Notice*: ${recipientName} does not have an active Telegram chat ID configured yet.`;
  }

  return {
    scheduledAction: action,
    confirmationMessage,
    recipient: {
      name: recipientName,
      chatId: targetChatId,
      type: recipientType,
      isConfigured,
    },
    parsedTime,
  };
}

/**
 * Lists persistent scheduled messages with optional status, recipient, and senderAccount filters.
 */
export async function listScheduledMessages(filter?: {
  status?: string;
  recipient?: string;
  senderAccount?: string;
  limit?: number;
}) {
  const where: any = {};
  if (filter?.status && filter.status !== "all") {
    where.status = filter.status;
  }
  if (filter?.recipient) {
    where.recipientName = { contains: filter.recipient };
  }
  if (filter?.senderAccount && filter.senderAccount !== "all") {
    where.senderAccount = filter.senderAccount;
  }

  const messages = await db.scheduledMessage.findMany({
    where,
    orderBy: { scheduledFor: "asc" },
    take: filter?.limit || 20,
  });

  return messages.map((m) => {
    const localTime = new Date(m.scheduledFor.getTime() + ADDIS_ABABA_TZ_OFFSET_HOURS * 3600 * 1000);
    const timeFormatted = localTime.toISOString().replace("T", " ").slice(0, 16) + " (EAT)";
    return {
      id: m.id,
      senderAccount: m.senderAccount || "bot",
      actionType: m.actionType,
      recipient: m.recipientName,
      status: m.status,
      scheduledFor: timeFormatted,
      recurrence: m.recurrenceRule || "one-time",
      content: m.content || `[Dynamic ${m.reportType || "report"}]`,
      isConfigured: Boolean(m.targetChatId),
    };
  });
}

/**
 * Updates an existing scheduled message's time or content.
 */
export async function updateScheduledMessage(
  idOrKeyword: string,
  updates: {
    newScheduledTimeText?: string;
    newContent?: string;
    anchorDate?: Date;
  }
) {
  const job = await db.scheduledMessage.findFirst({
    where: {
      OR: [
        { id: idOrKeyword },
        { recipientName: { contains: idOrKeyword } },
        { content: { contains: idOrKeyword } },
      ],
      status: { in: ["pending", "failed"] },
    },
    orderBy: { scheduledFor: "asc" },
  });

  if (!job) {
    return { success: false, error: `No pending scheduled message found matching "${idOrKeyword}".` };
  }

  const data: any = {};
  let formattedTime = "";

  if (updates.newScheduledTimeText) {
    const parsed = resolveScheduledTime(updates.newScheduledTimeText, { anchorDate: updates.anchorDate });
    data.scheduledFor = parsed.scheduledDate;
    if (parsed.recurrenceRule !== undefined) data.recurrenceRule = parsed.recurrenceRule;
    formattedTime = parsed.localFormatted;
  }

  if (updates.newContent) {
    data.content = updates.newContent;
  }

  const updated = await db.scheduledMessage.update({
    where: { id: job.id },
    data,
  });

  return {
    success: true,
    message: `Updated scheduled action for ${updated.recipientName}${formattedTime ? ` to ${formattedTime}` : ""}.`,
    scheduledAction: updated,
  };
}

/**
 * Cancels a pending scheduled message.
 */
export async function cancelScheduledMessage(idOrKeyword: string, reason?: string) {
  const job = await db.scheduledMessage.findFirst({
    where: {
      OR: [
        { id: idOrKeyword },
        { recipientName: { contains: idOrKeyword } },
        { content: { contains: idOrKeyword } },
      ],
      status: "pending",
    },
    orderBy: { scheduledFor: "asc" },
  });

  if (!job) {
    return { success: false, error: `No pending scheduled message found matching "${idOrKeyword}".` };
  }

  const cancelled = await db.scheduledMessage.update({
    where: { id: job.id },
    data: {
      status: "cancelled",
      lastError: reason ? `Cancelled: ${reason}` : "Cancelled by user",
    },
  });

  return {
    success: true,
    message: `Cancelled scheduled ${cancelled.actionType} for ${cancelled.recipientName} (ID: ${cancelled.id}).`,
    scheduledAction: cancelled,
  };
}

/**
 * Generates dynamic reports at execution time using live database records.
 */
export async function generateReportContent(reportType: string): Promise<string> {
  const now = new Date();

  if (reportType === "pending_tasks" || reportType === "task_report") {
    const { tasks, total } = await getActiveTasks({ limit: 25 });
    let text = `📋 *Abbay TV Graphics — Pending Tasks Report*\n`;
    text += `_Generated live at ${now.toISOString().replace("T", " ").slice(0, 16)} UTC_\n\n`;

    if (tasks.length === 0) {
      text += `🎉 All tasks are currently completed!`;
      return text;
    }

    const priorityEmoji: Record<string, string> = { urgent: "🔴", high: "🟠", medium: "🟡", low: "⚪" };
    for (const t of tasks) {
      const p = priorityEmoji[t.priority] || "🟡";
      const due = t.dueDate ? `Due: ${t.dueDate.toISOString().split("T")[0]}` : "No due date";
      const assignee = t.assignedTo ? `👤 ${t.assignedTo}` : "Unassigned";
      text += `${p} *${t.title}*\n   _${assignee} | ${due}_\n`;
    }
    return text;
  }

  if (reportType === "today_deadlines" || reportType === "deadline_summary") {
    const metrics = await getTaskMetrics(now);
    let text = `🎯 *Today's Focus & Critical Deadlines Summary*\n\n`;

    if (metrics.overdueTasks.length > 0) {
      text += `⚠️ *Overdue Tasks (${metrics.overdueTasks.length}):*\n`;
      for (const t of metrics.overdueTasks.slice(0, 5)) {
        text += `• 🔴 *${t.title}* (${t.assignedTo || "Unassigned"})\n`;
      }
      text += `\n`;
    }

    if (metrics.todayTasks.length > 0) {
      text += `📌 *Due Today (${metrics.todayTasks.length}):*\n`;
      for (const t of metrics.todayTasks.slice(0, 5)) {
        text += `• 🟠 *${t.title}* (${t.assignedTo || "Unassigned"})\n`;
      }
    } else {
      text += `• No urgent tasks due today.\n`;
    }

    return text;
  }

  if (reportType === "department_workload") {
    const workload = await getDepartmentWorkload(now);
    let text = `👥 *Graphics Department Live Workload Summary*\n\n`;
    for (const m of workload.team) {
      const badge = m.isOverloaded ? "🔴 OVERLOADED" : m.status === "BUSY" ? "🟡 Busy" : "🟢 Available";
      text += `• *${m.name}*: ${m.assignedHours}h assigned / ${m.capacityHours}h (${m.loadPercent}%) — ${badge}\n`;
    }
    if (workload.recommendations.length > 0) {
      text += `\n⚖️ *Strategy:* ${workload.recommendations[0]}`;
    }
    return text;
  }

  return `📊 *Scheduled Update*\nYour scheduled automated report was executed successfully.`;
}

/**
 * Worker tick: Inspects SQLite for due jobs and executes them safely.
 */
export async function executeDueScheduledMessages(options?: {
  botToken?: string;
  now?: Date;
}): Promise<{ executed: number; failed: number; skipped: number }> {
  const now = options?.now || new Date();
  const dbSettings = await db.appSetting.findMany();
  const settingsMap = new Map(dbSettings.map((s) => [s.key, s.value]));
  const botToken = options?.botToken || settingsMap.get("TELEGRAM_BOT_TOKEN") || process.env.TELEGRAM_BOT_TOKEN || "";

  // Find all pending jobs that are due for execution
  const dueJobs = await db.scheduledMessage.findMany({
    where: {
      status: "pending",
      scheduledFor: { lte: now },
    },
    take: 10,
  });

  let executed = 0;
  let failed = 0;
  let skipped = 0;

  for (const job of dueJobs) {
    // Atomic lock: mark as processing to prevent overlapping worker dispatch
    await db.scheduledMessage.update({
      where: { id: job.id },
      data: { status: "processing" },
    });

    try {
      // 1. Resolve content (dynamic report vs static message)
      let messageText = job.content || "";
      if (job.actionType === "task_report" || job.actionType === "deadline_summary" || job.reportType) {
        messageText = await generateReportContent(job.reportType || job.actionType);
      }

      if (!messageText) {
        messageText = `⏰ Scheduled reminder for ${job.recipientName}.`;
      }

      // 2. Resolve destination chat ID
      let targetChatId = job.targetChatId;
      if (!targetChatId) {
        // Try re-resolving in case recipient was recently connected
        const resolved = await resolveRecipient(job.recipientName);
        targetChatId = resolved.chatId;
      }

      if (!targetChatId) {
        // Recipient cannot be messaged; fail gracefully with clear explanation
        await db.scheduledMessage.update({
          where: { id: job.id },
          data: {
            status: "failed",
            lastError: `Recipient "${job.recipientName}" does not have a configured Telegram chat ID.`,
          },
        });
        failed++;
        continue;
      }

      // 3. Dispatch based on sending identity
      if (job.senderAccount === "personal") {
        const personalStatus = await getPersonalAccountStatus();
        if (!personalStatus.isConnected) {
          throw new Error("Personal Telegram account is not authenticated or connected. Scheduled personal messages cannot be dispatched. (Strict privacy: never fallback to bot)");
        }

        const sendRes = await sendPersonalMessage(targetChatId, messageText);
        if (!sendRes.success) {
          throw new Error("Personal Telegram sendMessage failed.");
        }
      } else {
        // Bot dispatch
        if (!botToken) {
          throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
        }

        const sendRes = await sendTelegramMessage(botToken, targetChatId, messageText);
        if (!sendRes.success) {
          throw new Error(sendRes.error || "Telegram sendMessage failed.");
        }
      }

      // 4. Update status and handle recurrence
      if (job.recurrenceRule) {
        // Calculate next execution in Africa/Addis_Ababa time
        let nextScheduledFor = new Date(job.scheduledFor.getTime());
        if (job.recurrenceRule === "daily") {
          nextScheduledFor = new Date(nextScheduledFor.getTime() + 24 * 3600 * 1000);
        } else if (job.recurrenceRule === "weekdays") {
          const day = nextScheduledFor.getUTCDay();
          const addDays = day === 5 ? 3 : day === 6 ? 2 : 1; // Friday -> Monday (+3d)
          nextScheduledFor = new Date(nextScheduledFor.getTime() + addDays * 24 * 3600 * 1000);
        } else if (job.recurrenceRule === "weekly") {
          nextScheduledFor = new Date(nextScheduledFor.getTime() + 7 * 24 * 3600 * 1000);
        } else if (job.recurrenceRule === "monthly") {
          nextScheduledFor = new Date(nextScheduledFor.getTime() + 30 * 24 * 3600 * 1000);
        }

        await db.scheduledMessage.update({
          where: { id: job.id },
          data: {
            status: "pending",
            scheduledFor: nextScheduledFor,
            sentAt: now,
            lastError: null,
            retryCount: 0,
          },
        });
      } else {
        await db.scheduledMessage.update({
          where: { id: job.id },
          data: {
            status: "sent",
            sentAt: now,
            lastError: null,
          },
        });
      }

      executed++;
    } catch (err: any) {
      console.error(`Scheduled job #${job.id} execution error:`, err.message);
      const newRetries = job.retryCount + 1;
      const isExhausted = newRetries >= job.maxRetries;

      await db.scheduledMessage.update({
        where: { id: job.id },
        data: {
          status: isExhausted ? "failed" : "pending",
          retryCount: newRetries,
          lastError: err.message,
        },
      });

      failed++;
    }
  }

  return { executed, failed, skipped };
}

/**
 * Registers or updates a Telegram recipient in the recipient directory.
 */
export async function registerRecipient(data: {
  name: string;
  type: "user" | "group";
  chatId: string;
  username?: string;
  notes?: string;
}) {
  return await db.telegramRecipient.upsert({
    where: { name: data.name },
    create: {
      name: data.name,
      type: data.type,
      chatId: data.chatId,
      username: data.username || null,
      notes: data.notes || null,
    },
    update: {
      type: data.type,
      chatId: data.chatId,
      username: data.username || null,
      notes: data.notes || null,
    },
  });
}
