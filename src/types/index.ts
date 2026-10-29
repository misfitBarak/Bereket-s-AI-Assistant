export type WorkspaceType = "abbay_tv" | "client_work" | "personal_projects";

export type TaskStatus = "backlog" | "todo" | "in_progress" | "in_review" | "blocked" | "completed";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface TaskItem {
  id: string;
  workspace: WorkspaceType;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  deliverableType?: string | null;
  assignedTo?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
  recurringSchedule?: string | null;
  dependencies?: string | null;
  tags?: string | null;
  projectId?: string | null;
  project?: {
    id: string;
    title: string;
    workspace: string;
    clientName?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectItem {
  id: string;
  workspace: WorkspaceType;
  title: string;
  description?: string | null;
  status: "planning" | "active" | "in_review" | "completed" | "on_hold";
  category?: string | null;
  targetDate?: string | null;
  progress: number;
  milestones?: string | null;
  nextAction?: string | null;
  clientName?: string | null;
  clientContact?: string | null;
  clientNotes?: string | null;
  quotedAmount?: number | null;
  paidAmount?: number | null;
  currency?: string | null;
  invoiceStatus?: "pending" | "sent" | "partial" | "paid" | "overdue" | null;
  tasks?: TaskItem[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamMemberItem {
  id: string;
  name: string;
  role: string;
  skills: string;
  currentCapacityHours: number;
  status: "available" | "busy" | "overloaded" | "on_leave";
  email?: string | null;
  notes?: string | null;
  activeTaskCount?: number;
  totalAssignedHours?: number;
}

export interface AchievementItem {
  id: string;
  title: string;
  description?: string | null;
  category: "abbay_tv" | "personal_projects" | "career";
  type: "milestone" | "deliverable" | "revenue" | "breakthrough";
  metric?: string | null;
  impact: "medium" | "high" | "major" | "breakthrough";
  achievedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface GrowthMetrics {
  totalCompletedDeliverables: number;
  totalProjectsCompleted: number;
  totalClientRevenue: number;
  majorBreakthroughsCount: number;
  recentMilestones: AchievementItem[];
  recentProgress: {
    id: string;
    type: "task" | "project" | "achievement";
    title: string;
    workspace: string;
    date: string;
    detail: string;
    badge?: string;
  }[];
}

export interface MemoryItem {
  id: string;
  category:
    | "role_responsibilities"
    | "team_profiles"
    | "client_preferences"
    | "decisions"
    | "workflows"
    | "long_term_goals"
    | "general_notes";
  title: string;
  content: string;
  tags?: string | null;
  source: string;
  importance: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageItem {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: any[] | string | null;
  toolResults?: any[] | string | null;
  pendingConfirmation?: ActionConfirmation | null;
  createdAt: string;
}

export interface ActionConfirmation {
  id: string;
  actionType: "delete_task" | "delete_project" | "bulk_reassign" | "clear_memories" | "send_personal_telegram_message";
  title: string;
  description: string;
  payload: Record<string, any>;
  status: "pending" | "approved" | "rejected";
}

export interface TelegramConfig {
  configured: boolean;
  hasToken: boolean;
  hasAllowedUser: boolean;
  hasWebhookSecret: boolean;
  webhookEndpoint: string;
}

export interface TelegramPersonalConfig {
  isConfigured: boolean;
  isConnected: boolean;
  user?: {
    id: string;
    firstName: string;
    lastName?: string;
    username?: string;
    phone?: string;
  } | null;
  error?: string;
}

export interface AIProviderConfig {
  provider: "auto" | "gemini" | "openai" | "anthropic" | "groq" | "ollama" | "demo";
  hasGeminiKey: boolean;
  hasOpenAIKey: boolean;
  hasAnthropicKey: boolean;
  hasGroqKey: boolean;
  ollamaBaseUrl: string;
  activeProviderName: string;
  isDemoMode: boolean;
  telegram?: TelegramConfig;
  telegramPersonal?: TelegramPersonalConfig;
}
