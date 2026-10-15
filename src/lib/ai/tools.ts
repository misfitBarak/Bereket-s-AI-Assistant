import { db } from "../db";
import {
  getTaskMetrics,
  getDepartmentWorkload,
  createTaskSafe,
  checkTaskDuplicate,
  resolveDateDetailed,
  resolveDateWithAnchor,
} from "../services/taskService";
import {
  createScheduledMessage,
  listScheduledMessages,
  updateScheduledMessage,
  cancelScheduledMessage,
  resolveRecipient,
  registerRecipient,
} from "../services/schedulerService";
import {
  getPersonalAccountStatus,
  getPersonalContacts,
  searchPersonalContacts,
  resolvePersonalRecipient,
  getPersonalConversationMessages,
  sendPersonalMessage,
  setContactAlias,
} from "../telegram/personalClient";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export const AI_TOOLS: ToolDefinition[] = [
  {
    name: "get_today_focus",
    description: "Get today's high-priority and urgent tasks across Abbay TV, client projects, and personal work.",
    parameters: {
      type: "object",
      properties: {
        workspace: {
          type: "string",
          enum: ["all", "abbay_tv", "client_work", "personal_projects"],
          description: "Optional workspace filter.",
        },
      },
    },
  },
  {
    name: "get_overdue_tasks",
    description: "Find all tasks that have passed their due date and are not yet completed.",
    parameters: {
      type: "object",
      properties: {
        workspace: {
          type: "string",
          enum: ["all", "abbay_tv", "client_work", "personal_projects"],
        },
      },
    },
  },
  {
    name: "get_department_workload",
    description: "Inspect the Graphics Department team (Dani, Sura, Simon, Kiru, Bereket, Abbay), active tasks, and identify who is overloaded or has free capacity.",
    parameters: {
      type: "object",
      properties: {
        includeNotes: {
          type: "boolean",
          description: "Optional: whether to include detailed notes on artist assignments.",
        },
      },
    },
  },
  {
    name: "balance_workload",
    description: "Analyze the current department load and urgent deliverables, and generate a balanced task distribution recommendation across team members.",
    parameters: {
      type: "object",
      properties: {
        urgentTaskTitles: {
          type: "array",
          items: { type: "string" },
          description: "Optional list of urgent task titles or deliverables to distribute.",
        },
      },
    },
  },
  {
    name: "create_task",
    description: "Create a new task in the database for Abbay TV, client work, or personal projects.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title of the task" },
        workspace: {
          type: "string",
          enum: ["abbay_tv", "client_work", "personal_projects"],
          description: "Target workspace",
        },
        assignedTo: { type: "string", description: "Team member name (Dani, Sura, Simon, Kiru, Bereket, or Abbay)" },
        dueDate: { type: "string", description: "Due date in YYYY-MM-DD format" },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "urgent"],
          description: "Task priority",
        },
        deliverableType: {
          type: "string",
          description: "Type of deliverable (e.g. Promo, Advert, Lower Third, L-Shape, Media Pack, Thumbnail, YouTube)",
        },
        estimatedHours: { type: "number", description: "Estimated hours to complete" },
        description: { type: "string", description: "Detailed description of requirements" },
      },
      required: ["title", "workspace"],
    },
  },
  {
    name: "update_task",
    description: "Update an existing task's status, assignee, priority, or due date.",
    parameters: {
      type: "object",
      properties: {
        taskTitleOrId: { type: "string", description: "Task ID or approximate title" },
        status: {
          type: "string",
          enum: ["backlog", "todo", "in_progress", "in_review", "blocked", "completed"],
        },
        assignedTo: { type: "string", description: "New assignee" },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
        dueDate: { type: "string", description: "New due date in YYYY-MM-DD" },
      },
      required: ["taskTitleOrId"],
    },
  },
  {
    name: "request_task_deletion",
    description: "Propose deleting a task. Since deletion is a consequential action, this tool prepares a confirmation prompt for user approval before anything is deleted.",
    parameters: {
      type: "object",
      properties: {
        taskTitleOrId: { type: "string", description: "Task ID or exact title to delete" },
        reason: { type: "string", description: "Reason for deletion" },
      },
      required: ["taskTitleOrId"],
    },
  },
  {
    name: "search_memories",
    description: "Search stored personal memories, team preferences, client rules, and past decisions.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search keyword or topic" },
        category: {
          type: "string",
          enum: [
            "all",
            "role_responsibilities",
            "team_profiles",
            "client_preferences",
            "decisions",
            "workflows",
            "long_term_goals",
          ],
        },
      },
      required: ["query"],
    },
  },
  {
    name: "save_memory",
    description: "Save a new persistent memory, decision, client preference, or workflow instruction.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: [
            "role_responsibilities",
            "team_profiles",
            "client_preferences",
            "decisions",
            "workflows",
            "long_term_goals",
            "general_notes",
          ],
        },
        title: { type: "string", description: "Short summary title of the memory" },
        content: { type: "string", description: "The detailed knowledge or rule to store" },
        importance: { type: "number", description: "1 (minor) to 5 (critical)" },
      },
      required: ["category", "title", "content"],
    },
  },
  {
    name: "generate_daily_plan",
    description: "Generate a realistic daily plan balancing Abbay TV responsibilities, freelance client milestones, and personal projects without burnout.",
    parameters: {
      type: "object",
      properties: {
        focusArea: {
          type: "string",
          description: "Optional focus area (e.g. all, broadcast, freelance, personal)",
        },
      },
    },
  },
  {
    name: "generate_weekly_report",
    description: "Generate a professional management report of the Graphics Department's weekly output for Abbay TV leadership.",
    parameters: {
      type: "object",
      properties: {
        department: {
          type: "string",
          description: "Department name (default: Abbay TV Graphics Department)",
        },
      },
    },
  },
  {
    name: "detect_neglected_projects",
    description: "Identify any personal or client projects that have had no recent task activity or progress.",
    parameters: {
      type: "object",
      properties: {
        workspace: {
          type: "string",
          description: "Optional workspace filter (e.g. all, client_work, personal_projects)",
        },
      },
    },
  },
  {
    name: "schedule_telegram_message",
    description: "Schedule a future message, reminder, or live report. You can specify whether to send from the assistant bot (@BereketAssistantBot) or from Abbay's personal Telegram account ('personal'). Operates in Africa/Addis_Ababa timezone (e.g. 'Tomorrow at 5 PM', 'Every weekday at 8 AM').",
    parameters: {
      type: "object",
      properties: {
        recipient: { type: "string", description: "Recipient name, e.g. 'Dani', 'Sura', 'Simon', 'wife', 'my wife', 'Graphics Department', 'Self', 'Abbay'" },
        actionType: {
          type: "string",
          enum: ["direct_message", "task_report", "deadline_summary", "custom_reminder"],
          description: "Type of message: direct_message (custom text), task_report (live pending tasks), deadline_summary (today's deadlines), or custom_reminder",
        },
        scheduledTime: { type: "string", description: "When to send in natural language or ISO (e.g. 'Tomorrow at 5 PM', 'Tomorrow at 9 AM', 'Every weekday at 8 AM')" },
        content: { type: "string", description: "Message text for reminders or direct messages (e.g. 'Please finish the thumbnails for the broadcast')" },
        senderAccount: {
          type: "string",
          enum: ["bot", "personal"],
          description: "Account to send from: 'bot' (assistant bot @BereketAssistantBot) or 'personal' (Abbay's personal Telegram identity). Default is 'bot'.",
        },
        reportType: {
          type: "string",
          enum: ["pending_tasks", "today_deadlines", "department_workload"],
          description: "Optional report type if actionType is task_report or deadline_summary",
        },
        recurrence: {
          type: "string",
          enum: ["none", "daily", "weekdays", "weekly", "monthly"],
          description: "Optional recurrence frequency (e.g. 'weekdays' for 'every weekday at 8 AM')",
        },
      },
      required: ["recipient", "actionType", "scheduledTime"],
    },
  },
  {
    name: "list_scheduled_messages",
    description: "List all scheduled messages, reminders, and recurring reports with their execution time, status, and sending account identity.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["all", "pending", "sent", "cancelled", "failed"],
          description: "Filter by status (default: all)",
        },
        recipient: { type: "string", description: "Filter by recipient name" },
        senderAccount: {
          type: "string",
          enum: ["all", "bot", "personal"],
          description: "Filter by sender account: 'all', 'bot', or 'personal'",
        },
      },
    },
  },
  {
    name: "update_scheduled_message",
    description: "Change the time, date, or content of a pending scheduled message or report (e.g. 'Move the scheduled report to 6 PM').",
    parameters: {
      type: "object",
      properties: {
        messageIdOrKeyword: { type: "string", description: "ID of the scheduled message or keywords to match (e.g. 'Dani reminder', 'report', 'tomorrow')" },
        newScheduledTime: { type: "string", description: "New scheduled time in natural language (e.g. '6 PM', 'Tomorrow at 10 AM')" },
        newContent: { type: "string", description: "New message content" },
      },
      required: ["messageIdOrKeyword"],
    },
  },
  {
    name: "cancel_scheduled_message",
    description: "Cancel a pending scheduled message or report so it will not be sent.",
    parameters: {
      type: "object",
      properties: {
        messageIdOrKeyword: { type: "string", description: "ID of the scheduled message or keywords (e.g. 'tomorrow's message', 'Dani reminder', 'report')" },
        reason: { type: "string", description: "Reason for cancellation" },
      },
      required: ["messageIdOrKeyword"],
    },
  },
  {
    name: "check_personal_telegram_status",
    description: "Check if Abbay's personal Telegram account (GramJS) is connected, view account name, username, phone, or connection state.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "search_personal_contacts",
    description: "Search contacts and recent conversations in Abbay's personal Telegram account by name, username, or phone number.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Name, username, or phone to search for (e.g. 'Dani', 'wife', 'Sura')" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_personal_conversation_messages",
    description: "Retrieve recent messages from a conversation in Abbay's personal Telegram account (identifies sender, incoming/outgoing, and timestamps).",
    parameters: {
      type: "object",
      properties: {
        contactOrPeer: { type: "string", description: "Contact name, username, or alias (e.g. 'Dani', 'wife', 'my wife', '@username')" },
        limit: { type: "number", description: "Number of recent messages to retrieve (default: 10, max: 30)" },
      },
      required: ["contactOrPeer"],
    },
  },
  {
    name: "summarize_personal_conversation",
    description: "Summarize recent messages from a personal Telegram conversation, distinguishing what the contact said, what Abbay said, decisions, unanswered questions, and action items.",
    parameters: {
      type: "object",
      properties: {
        contactOrPeer: { type: "string", description: "Contact name, username, or alias (e.g. 'Dani', 'wife')" },
        limit: { type: "number", description: "Number of recent messages to analyze (default: 15, max: 30)" },
      },
      required: ["contactOrPeer"],
    },
  },
  {
    name: "draft_personal_reply",
    description: "Draft a context-aware reply to the latest message in a personal Telegram conversation without sending it immediately.",
    parameters: {
      type: "object",
      properties: {
        contactOrPeer: { type: "string", description: "Contact name, username, or alias (e.g. 'Dani', 'wife')" },
        instructionsOrKeyPoints: { type: "string", description: "What the reply should say or key points to convey (e.g. 'Say I will finish the advert tomorrow')" },
      },
      required: ["contactOrPeer", "instructionsOrKeyPoints"],
    },
  },
  {
    name: "prepare_personal_telegram_send",
    description: "Prepare to send an immediate message from Abbay's personal Telegram account (as Abbay, NOT @BereketAssistantBot). Prompts for explicit user confirmation before dispatching.",
    parameters: {
      type: "object",
      properties: {
        contactOrPeer: { type: "string", description: "Recipient name, username, or alias (e.g. 'wife', 'Dani', 'Sura')" },
        messageText: { type: "string", description: "The exact message text to send from your personal account" },
      },
      required: ["contactOrPeer", "messageText"],
    },
  },
  {
    name: "confirm_personal_telegram_send",
    description: "Confirm and execute sending a previously prepared personal Telegram message using its confirmation token.",
    parameters: {
      type: "object",
      properties: {
        confirmationToken: { type: "string", description: "The confirmation token generated by prepare_personal_telegram_send" },
      },
      required: ["confirmationToken"],
    },
  },
  {
    name: "set_contact_alias",
    description: "Associate an alias (e.g. 'wife' -> 'Tigist') with a specific Telegram contact in your personal account.",
    parameters: {
      type: "object",
      properties: {
        alias: { type: "string", description: "Alias keyword (e.g. 'wife', 'dani')" },
        contactName: { type: "string", description: "Real contact name or username in Telegram" },
      },
      required: ["alias", "contactName"],
    },
  },
];

// Tool Execution Handlers
export async function executeTool(name: string, args: any): Promise<{ result: any; pendingConfirmation?: any }> {
  const now = new Date();

  switch (name) {
    case "get_today_focus": {
      const workspace = args.workspace || "all";
      const metrics = await getTaskMetrics(now);
      let tasks = metrics.todayTasks;
      if (workspace !== "all") {
        tasks = tasks.filter((t) => t.workspace === workspace);
      }

      return {
        result: {
          count: tasks.length,
          tasks: tasks.slice(0, 15).map((t) => ({
            id: t.id,
            title: t.title,
            workspace: t.workspace,
            priority: t.priority,
            status: t.status,
            assignedTo: t.assignedTo || "Unassigned",
            dueDate: t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "No date",
            deliverableType: t.deliverableType,
          })),
        },
      };
    }

    case "get_overdue_tasks": {
      const metrics = await getTaskMetrics(now);
      let tasks = metrics.overdueTasks;
      if (args.workspace && args.workspace !== "all") {
        tasks = tasks.filter((t) => t.workspace === args.workspace);
      }

      return {
        result: {
          overdueCount: tasks.length,
          tasks: tasks.map((t) => ({
            id: t.id,
            title: t.title,
            workspace: t.workspace,
            assignedTo: t.assignedTo || "Unassigned",
            dueDate: t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "No date",
            priority: t.priority,
          })),
        },
      };
    }

    case "get_department_workload": {
      const report = await getDepartmentWorkload(now);
      return {
        result: {
          department: report.department,
          lead: report.lead,
          totalActiveTasks: report.totalActiveTasks,
          totalAssignedHours: report.totalAssignedHours,
          workload: report.team,
          team: report.team,
          overloadedMembers: report.overloadedMembers.map((m) => `${m.name} (${m.assignedHours}h assigned / ${m.capacityHours}h capacity, ${m.loadPercent}%)`),
          availableMembers: report.availableMembers.map((m) => `${m.name} (${m.capacityHours - m.assignedHours}h available capacity)`),
          recommendations: report.recommendations,
        },
      };
    }

    case "balance_workload": {
      const report = await getDepartmentWorkload(now);
      return {
        result: {
          status: "analysis_complete",
          overloadedMembers: report.overloadedMembers.map(
            (o) => `${o.name} (${o.assignedHours}h assigned / ${o.capacityHours}h weekly capacity, ${o.loadPercent}% load)`
          ),
          availableMembers: report.availableMembers.map(
            (a) => `${a.name} (${a.capacityHours - a.assignedHours}h free capacity remaining)`
          ),
          recommendations: report.recommendations,
        },
      };
    }

    case "create_task": {
      const { task, duplicateWarning, dateWarning, clarificationRequired } = await createTaskSafe({
        title: args.title,
        workspace: args.workspace || "abbay_tv",
        description: args.description || null,
        assignedTo: args.assignedTo || null,
        dueDate: args.dueDate,
        priority: args.priority || "medium",
        deliverableType: args.deliverableType || null,
        estimatedHours: args.estimatedHours ? Number(args.estimatedHours) : 4.0,
        anchorDate: now,
      });

      let message = `Created task "${task.title}" in workspace ${task.workspace}`;
      if (duplicateWarning) {
        message += `\n${duplicateWarning}`;
      }
      if (dateWarning) {
        message += `\n${dateWarning}`;
      }
      if (clarificationRequired) {
        message += `\n⚠️ Clarification recommended: The provided deadline appears to be a historical date.`;
      }

      return {
        result: {
          success: true,
          message,
          warning: duplicateWarning,
          dateWarning,
          clarificationRequired,
          task: {
            id: task.id,
            title: task.title,
            assignedTo: task.assignedTo,
            dueDate: task.dueDate?.toISOString().split("T")[0],
            priority: task.priority,
            workspace: task.workspace,
          },
        },
      };
    }

    case "update_task": {
      const search = args.taskTitleOrId;
      const task = await db.task.findFirst({
        where: {
          OR: [{ id: search }, { title: { contains: search } }],
        },
      });

      if (!task) {
        return { result: { success: false, error: `Could not find task matching "${search}"` } };
      }

      const data: any = {};
      if (args.status) data.status = args.status;
      if (args.assignedTo) data.assignedTo = args.assignedTo;
      if (args.priority) data.priority = args.priority;
      if (args.dueDate) {
        data.dueDate = resolveDateDetailed(args.dueDate, { anchorDate: now, allowHistorical: true }).date;
      }

      const updated = await db.task.update({
        where: { id: task.id },
        data,
      });

      await db.activityLog.create({
        data: {
          taskId: task.id,
          action: "updated",
          details: `AI updated task: ${JSON.stringify(data)}`,
        },
      });

      return {
        result: {
          success: true,
          message: `Updated task "${updated.title}"`,
          task: updated,
        },
      };
    }

    case "request_task_deletion": {
      const search = args.taskTitleOrId;
      const task = await db.task.findFirst({
        where: {
          OR: [{ id: search }, { title: { contains: search } }],
        },
      });

      if (!task) {
        return { result: { success: false, error: `Task matching "${search}" not found.` } };
      }

      // Consequential action safeguard: return confirmation required payload
      const confirmation = {
        id: `confirm_${Date.now()}`,
        actionType: "delete_task",
        title: `Confirm Deletion: "${task.title}"`,
        description: `Are you sure you want to delete this task? This action cannot be undone. Reason: ${args.reason || "User requested deletion"}`,
        payload: { taskId: task.id, taskTitle: task.title },
        status: "pending",
      };

      return {
        result: {
          status: "confirmation_required",
          message: `Deleting "${task.title}" requires your explicit confirmation. Please review the confirmation prompt below.`,
        },
        pendingConfirmation: confirmation,
      };
    }

    case "search_memories": {
      const memories = await db.memory.findMany({
        where: {
          OR: [
            { title: { contains: args.query } },
            { content: { contains: args.query } },
            { tags: { contains: args.query } },
          ],
        },
        take: 5,
      });

      return {
        result: {
          foundCount: memories.length,
          memories: memories.map((m) => ({
            id: m.id,
            title: m.title,
            category: m.category,
            content: m.content,
            importance: m.importance,
          })),
        },
      };
    }

    case "save_memory": {
      const memory = await db.memory.create({
        data: {
          category: args.category || "general_notes",
          title: args.title,
          content: args.content,
          importance: args.importance || 3,
          source: "chat_extracted",
        },
      });

      return {
        result: {
          success: true,
          message: `Stored memory: "${memory.title}" in category ${memory.category}`,
          memoryId: memory.id,
        },
      };
    }

    case "generate_daily_plan": {
      const [tvTasks, clientTasks, personalTasks] = await Promise.all([
        db.task.findMany({
          where: { workspace: "abbay_tv", status: { not: "completed" } },
          orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
          take: 3,
        }),
        db.task.findMany({
          where: { workspace: "client_work", status: { not: "completed" } },
          orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
          take: 3,
        }),
        db.task.findMany({
          where: { workspace: "personal_projects", status: { not: "completed" } },
          orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
          take: 3,
        }),
      ]);

      const tvSummary =
        tvTasks.length > 0
          ? tvTasks.map((t) => `${t.title} (${t.assignedTo || "Unassigned"}, ${t.priority})`).join("; ")
          : "Routine broadcast queue monitoring & team support";

      const clientSummary =
        clientTasks.length > 0
          ? clientTasks.map((t) => `${t.title} (${t.priority})`).join("; ")
          : "No immediate client deadlines pending; buffer for outreach or pipeline review";

      const personalSummary =
        personalTasks.length > 0
          ? personalTasks.map((t) => `${t.title} (${t.priority})`).join("; ")
          : "Personal skill development & tutorial recording";

      const allActive = [...tvTasks, ...clientTasks, ...personalTasks];

      const plan = {
        date: now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "short", day: "numeric" }),
        morningBlock: `09:00 - 12:30: Abbay TV High-Impact Review & Team Coordination (Focus: ${tvSummary}).`,
        middayBlock: `13:30 - 15:30: Client Deliverables & Revisions (Focus: ${clientSummary}).`,
        afternoonBlock: `16:00 - 17:30: Broadcast Production Wrap & Station Quality Check (Finalizing daily transmissions).`,
        eveningBlock: `18:00 - 19:30: Personal Creative Projects & Long-Term Assets (Focus: ${personalSummary}).`,
        priorities: allActive.map((t) => `• [${t.workspace.toUpperCase()}] ${t.title} (${t.assignedTo || "You"})`),
      };

      return { result: plan };
    }

    case "generate_weekly_report": {
      const [completedThisWeek, activeTvTasks, tvProjects, workloadReport] = await Promise.all([
        db.task.findMany({
          where: {
            workspace: "abbay_tv",
            status: "completed",
          },
        }),
        db.task.findMany({
          where: {
            workspace: "abbay_tv",
            status: { not: "completed" },
          },
          orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
        }),
        db.project.findMany({
          where: { workspace: "abbay_tv" },
        }),
        getDepartmentWorkload(now),
      ]);

      const projectHighlights = tvProjects.map(
        (p) => `${p.title} currently at ${p.progress}% progress (${p.status}, Target: ${p.targetDate ? p.targetDate.toISOString().split("T")[0] : "TBD"}).`
      );

      const highlights = [
        `Completed ${completedThisWeek.length} broadcast graphics deliverable(s) on record.`,
        ...projectHighlights,
      ];

      const report = {
        department: "Abbay TV Graphics Department",
        lead: "Abbay (Graphics Department Lead)",
        period: `Current Broadcast Week (${now.toLocaleDateString("en-US", { month: "short", year: "numeric" })})`,
        highlights,
        completedDeliverables:
          completedThisWeek.length > 0
            ? completedThisWeek.map((t) => `${t.title} - ${t.deliverableType || "Graphics"} (${t.assignedTo || "Team"})`)
            : ["No completed tasks logged this cycle."],
        inProgressProduction: activeTvTasks.map(
          (t) => `${t.title} - Assigned: ${t.assignedTo || "Unassigned"} (Due: ${t.dueDate ? t.dueDate.toISOString().split("T")[0] : "TBD"}, Priority: ${t.priority})`
        ),
        teamStatusSummary: workloadReport.team
          .map((m) => `${m.name}: ${m.assignedHours}h assigned / ${m.capacityHours}h capacity (${m.loadPercent}% load - ${m.status})`)
          .join(" | "),
        recommendations: workloadReport.recommendations,
      };

      return { result: report };
    }

    case "detect_neglected_projects": {
      const projects = await db.project.findMany({
        where: { status: { not: "completed" } },
        include: { tasks: true },
      });

      const neglected = projects.filter((p) => {
        const hasOpenTasks = p.tasks.some((t) => t.status === "in_progress" || t.status === "todo");
        return !hasOpenTasks || p.progress < 50;
      });

      return {
        result: {
          count: neglected.length,
          neglectedProjects: neglected.map((p) => ({
            id: p.id,
            title: p.title,
            workspace: p.workspace,
            progress: `${p.progress}%`,
            nextAction: p.nextAction || "No next action defined",
            recommendation: `Schedule a 2-hour milestone block to advance "${p.title}"`,
          })),
        },
      };
    }

    case "schedule_telegram_message": {
      const { recipient, actionType, scheduledTime, content, reportType, senderAccount } = args;
      const res = await createScheduledMessage({
        recipient,
        actionType,
        scheduledTimeText: scheduledTime,
        content,
        reportType,
        senderAccount: senderAccount || "bot",
        anchorDate: now,
      });

      return {
        result: {
          success: true,
          message: res.confirmationMessage,
          scheduledAction: {
            id: res.scheduledAction.id,
            recipient: res.recipient.name,
            senderAccount: res.scheduledAction.senderAccount,
            actionType: res.scheduledAction.actionType,
            scheduledFor: res.parsedTime.localFormatted,
            recurrence: res.parsedTime.recurrenceRule || "one-time",
            targetChatConfigured: res.recipient.isConfigured,
          },
        },
      };
    }

    case "list_scheduled_messages": {
      const messages = await listScheduledMessages({
        status: args.status,
        recipient: args.recipient,
        senderAccount: args.senderAccount,
      });

      return {
        result: {
          count: messages.length,
          scheduledMessages: messages,
        },
      };
    }

    case "update_scheduled_message": {
      const updateRes = await updateScheduledMessage(args.messageIdOrKeyword, {
        newScheduledTimeText: args.newScheduledTime,
        newContent: args.newContent,
        anchorDate: now,
      });

      return { result: updateRes };
    }

    case "cancel_scheduled_message": {
      const cancelRes = await cancelScheduledMessage(args.messageIdOrKeyword, args.reason);
      return { result: cancelRes };
    }

    case "check_personal_telegram_status": {
      const status = await getPersonalAccountStatus();
      return {
        result: {
          isConfigured: status.isConfigured,
          isConnected: status.isConnected,
          user: status.user
            ? {
                name: `${status.user.firstName} ${status.user.lastName || ""}`.trim(),
                username: status.user.username ? `@${status.user.username}` : undefined,
                phone: status.user.phone
                  ? status.user.phone.replace(/(\+\d{3})\d+(\d{2})/, "$1****$2")
                  : undefined,
              }
            : null,
          error: status.error,
          guidance: !status.isConnected
            ? "Personal Telegram account is not connected. Use 'npm run telegram:personal-auth' or open Settings in the dashboard to connect."
            : "Personal Telegram account is connected and ready to send/receive as your personal identity.",
        },
      };
    }

    case "search_personal_contacts": {
      try {
        const results = await searchPersonalContacts(args.query);
        return {
          result: {
            query: args.query,
            count: results.length,
            contacts: results.slice(0, 10).map((c) => ({
              id: c.id,
              name: c.name,
              username: c.username ? `@${c.username}` : undefined,
              type: c.isUser ? "User" : c.isGroup ? "Group" : "Channel",
              snippet: c.lastMessageSnippet,
            })),
          },
        };
      } catch (err: any) {
        return { result: { error: err.message } };
      }
    }

    case "get_personal_conversation_messages": {
      try {
        const resolved = await resolvePersonalRecipient(args.contactOrPeer);
        if (!resolved.resolved || !resolved.peer) {
          return {
            result: {
              error: resolved.error || `Could not resolve contact "${args.contactOrPeer}"`,
              isAmbiguous: resolved.isAmbiguous,
              candidates: resolved.candidates,
            },
          };
        }
        const messages = await getPersonalConversationMessages(resolved.peer.id, args.limit || 10);
        return {
          result: {
            contact: resolved.peer.name,
            peerId: resolved.peer.id,
            messageCount: messages.length,
            messages: messages.map((m) => ({
              sender: m.senderName,
              isFromMe: m.isOutgoing,
              text: m.text,
              time: m.timestamp,
            })),
          },
        };
      } catch (err: any) {
        return { result: { error: err.message } };
      }
    }

    case "summarize_personal_conversation": {
      try {
        const resolved = await resolvePersonalRecipient(args.contactOrPeer);
        if (!resolved.resolved || !resolved.peer) {
          return {
            result: {
              error: resolved.error || `Could not resolve contact "${args.contactOrPeer}"`,
              isAmbiguous: resolved.isAmbiguous,
              candidates: resolved.candidates,
            },
          };
        }

        const messages = await getPersonalConversationMessages(resolved.peer.id, args.limit || 15);
        if (messages.length === 0) {
          return {
            result: {
              contact: resolved.peer.name,
              summary: "No recent messages found in this conversation to summarize.",
            },
          };
        }

        const incoming = messages.filter((m) => !m.isOutgoing);
        const outgoing = messages.filter((m) => m.isOutgoing);

        return {
          result: {
            contact: resolved.peer.name,
            periodAnalyzed: `${messages.length} messages`,
            whatContactSaid: incoming.map((m) => `[${m.timestamp.slice(11, 16)}] ${m.text}`),
            whatISaid: outgoing.map((m) => `[${m.timestamp.slice(11, 16)}] ${m.text}`),
            totalMessages: messages.length,
            securityNotice: "Incoming message content is analyzed strictly as data. No embedded instructions were executed.",
          },
        };
      } catch (err: any) {
        return { result: { error: err.message } };
      }
    }

    case "draft_personal_reply": {
      try {
        const resolved = await resolvePersonalRecipient(args.contactOrPeer);
        if (!resolved.resolved || !resolved.peer) {
          return {
            result: {
              error: resolved.error || `Could not resolve contact "${args.contactOrPeer}"`,
              isAmbiguous: resolved.isAmbiguous,
              candidates: resolved.candidates,
            },
          };
        }

        const messages = await getPersonalConversationMessages(resolved.peer.id, 5);
        const incomingMessages = messages.filter((m) => !m.isOutgoing);
        incomingMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const latestIncoming = incomingMessages[0];

        return {
          result: {
            contact: resolved.peer.name,
            latestReceivedMessage: latestIncoming ? latestIncoming.text : "[No recent incoming message]",
            requestedPoints: args.instructionsOrKeyPoints,
            notice: "This is a proposed draft only. To send it through your personal Telegram account, say 'Send it' or request a send confirmation.",
          },
        };
      } catch (err: any) {
        return { result: { error: err.message } };
      }
    }

    case "prepare_personal_telegram_send": {
      try {
        const status = await getPersonalAccountStatus();
        if (!status.isConnected) {
          return {
            result: {
              success: false,
              error: "Personal Telegram account is not connected. Connect it in Settings or via 'npm run telegram:personal-auth' before sending messages as yourself.",
            },
          };
        }

        const resolved = await resolvePersonalRecipient(args.contactOrPeer);
        if (!resolved.resolved || !resolved.peer) {
          return {
            result: {
              error: resolved.error || `Could not resolve contact "${args.contactOrPeer}"`,
              isAmbiguous: resolved.isAmbiguous,
              candidates: resolved.candidates,
            },
          };
        }

        const confirmationId = `confirm_personal_send_${Date.now()}`;
        const token = `tok_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const confirmation = {
          id: confirmationId,
          actionType: "send_personal_telegram_message",
          senderAccount: "personal",
          title: `Confirm Personal Telegram Message to ${resolved.peer.name}`,
          description: `Send as your personal Telegram identity (not @BereketAssistantBot):\n\n• Recipient: ${resolved.peer.name} (${resolved.peer.id})\n• Message: "${args.messageText}"\n• Sending Account: Personal (${status.user?.firstName || "You"})\n\nReply /confirm or click Approve to send. Reply /cancel to discard.`,
          payload: {
            peerId: resolved.peer.id,
            recipientName: resolved.peer.name,
            messageText: args.messageText,
            senderAccount: "personal",
            token,
            expiresAt: Date.now() + 15 * 60 * 1000,
          },
          status: "pending",
        };

        return {
          result: {
            status: "confirmation_required",
            senderAccount: "personal",
            recipient: resolved.peer.name,
            messageText: args.messageText,
            instructions: "Explicit confirmation is required before this message can be sent from your personal account.",
          },
          pendingConfirmation: confirmation,
        };
      } catch (err: any) {
        return { result: { error: err.message } };
      }
    }

    case "confirm_personal_telegram_send": {
      try {
        const token = args.confirmationToken;
        const lastMsg = await db.chatMessage.findFirst({
          where: { pendingConfirmation: { contains: token } },
          orderBy: { createdAt: "desc" },
        });

        if (!lastMsg || !lastMsg.pendingConfirmation) {
          return { result: { success: false, error: "Invalid or expired confirmation token." } };
        }

        const confirmData = JSON.parse(lastMsg.pendingConfirmation);
        if (confirmData.payload.expiresAt < Date.now()) {
          return {
            result: {
              success: false,
              error: "Confirmation expired (15-minute safeguard window). Please re-request your message.",
            },
          };
        }

        const sendRes = await sendPersonalMessage(
          confirmData.payload.peerId,
          confirmData.payload.messageText
        );

        await db.chatMessage.update({
          where: { id: lastMsg.id },
          data: { pendingConfirmation: null },
        });

        return {
          result: {
            success: true,
            message: `Sent message to ${confirmData.payload.recipientName} from your personal Telegram account.`,
            messageId: sendRes.messageId,
          },
        };
      } catch (err: any) {
        return { result: { error: err.message } };
      }
    }

    case "set_contact_alias": {
      const res = await setContactAlias(args.alias, args.contactName);
      return {
        result: {
          success: res.success,
          message: `Configured alias: "${args.alias}" now maps to "${args.contactName}".`,
        },
      };
    }

    default:
      return { result: { error: `Tool ${name} not recognized` } };
  }
}
