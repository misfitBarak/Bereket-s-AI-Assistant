import { db } from "../db";

export interface TaskMetrics {
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  urgentTasks: number;
  overdueTasks: Array<any>;
  overdueCount: number;
  todayTasks: Array<any>;
  todayCount: number;
  upcomingDeadlines: Array<any>;
  upcomingCount: number;
  byWorkspace: {
    abbay_tv: { total: number; active: number; completed: number; urgent: number };
    client_work: { total: number; active: number; completed: number; urgent: number };
    personal_projects: { total: number; active: number; completed: number; urgent: number };
  };
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

export interface TeamWorkloadMember {
  id: string;
  name: string;
  role: string;
  skills: string;
  capacityHours: number;
  assignedHours: number;
  taskCount: number;
  loadPercent: number;
  status: "OVERLOADED" | "BUSY" | "AVAILABLE";
  isOverloaded: boolean;
  tasks: Array<{ id: string; title: string; priority: string; estimatedHours: number; dueDate: string | null }>;
}


export interface ArtistOutputReport {
  id: string;
  name: string;
  role: string;
  group: "Graphic Designer" | "Motion Graphic Designer";
  outputScore: number;
  relativePercent: number;
  completedCount: number;
  activeCount: number;
  heavyDeliverablesCount: number;
  mediumDeliverablesCount: number;
  lightDeliverablesCount: number;
  status: "DEEP_FOCUS" | "BALANCED" | "AVAILABLE";
  isTopPerformer: boolean;
  recentDeliverables: Array<{
    title: string;
    tier: "heavy" | "medium" | "light";
    points: number;
    status: string;
    completedAt?: string | null;
  }>;
}

export interface SevenDayTeamPerformanceReport {
  startDate: string;
  endDate: string;
  artists: ArtistOutputReport[];
  topPerformerName: string | null;
  totalDepartmentScore: number;
  totalCompletedLast7Days: number;
}

export interface DepartmentWorkloadReport {
  department: string;
  lead: string;
  totalActiveTasks: number;
  totalAssignedHours: number;
  team: TeamWorkloadMember[];
  overloadedMembers: TeamWorkloadMember[];
  availableMembers: TeamWorkloadMember[];
  recommendations: string[];
}

/**
 * Single source of truth for task metrics across Dashboard, Telegram, and AI Tools.
 */
export async function getTaskMetrics(anchorDate: Date = new Date()): Promise<TaskMetrics> {
  const startOfToday = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
  const endOfToday = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate(), 23, 59, 59, 999);
  const in7Days = new Date(anchorDate.getTime() + 7 * 24 * 60 * 60 * 1000);

  const allTasks = await db.task.findMany({
    include: {
      project: { select: { id: true, title: true, clientName: true, workspace: true } },
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });

  const activeTasks = allTasks.filter((t) => t.status !== "completed");
  const completedTasks = allTasks.filter((t) => t.status === "completed");

  const overdueTasks = activeTasks.filter((t) => t.dueDate && new Date(t.dueDate) < startOfToday);

  const todayTasks = activeTasks.filter((t) => {
    if (t.priority === "urgent") return true;
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    return due >= startOfToday && due <= endOfToday;
  });

  const upcomingDeadlines = activeTasks
    .filter((t) => {
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      return due >= startOfToday && due <= in7Days;
    })
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

  const byWorkspace = {
    abbay_tv: {
      total: allTasks.filter((t) => t.workspace === "abbay_tv").length,
      active: activeTasks.filter((t) => t.workspace === "abbay_tv").length,
      completed: completedTasks.filter((t) => t.workspace === "abbay_tv").length,
      urgent: activeTasks.filter((t) => t.workspace === "abbay_tv" && t.priority === "urgent").length,
    },
    client_work: {
      total: allTasks.filter((t) => t.workspace === "client_work").length,
      active: activeTasks.filter((t) => t.workspace === "client_work").length,
      completed: completedTasks.filter((t) => t.workspace === "client_work").length,
      urgent: activeTasks.filter((t) => t.workspace === "client_work" && t.priority === "urgent").length,
    },
    personal_projects: {
      total: allTasks.filter((t) => t.workspace === "personal_projects").length,
      active: activeTasks.filter((t) => t.workspace === "personal_projects").length,
      completed: completedTasks.filter((t) => t.workspace === "personal_projects").length,
      urgent: activeTasks.filter((t) => t.workspace === "personal_projects" && t.priority === "urgent").length,
    },
  };

  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};

  allTasks.forEach((t) => {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
  });

  return {
    totalTasks: allTasks.length,
    activeTasks: activeTasks.length,
    completedTasks: completedTasks.length,
    urgentTasks: activeTasks.filter((t) => t.priority === "urgent").length,
    overdueTasks,
    overdueCount: overdueTasks.length,
    todayTasks,
    todayCount: todayTasks.length,
    upcomingDeadlines,
    upcomingCount: upcomingDeadlines.length,
    byWorkspace,
    byStatus,
    byPriority,
  };
}

/**
 * Retrieve active tasks with pagination, search, and filtering.
 */
export async function getActiveTasks(options: {
  workspace?: string;
  status?: string;
  priority?: string;
  assignedTo?: string;
  search?: string;
  page?: number;
  limit?: number;
} = {}) {
  const page = Math.max(1, options.page || 1);
  const limit = Math.max(1, Math.min(100, options.limit || 50));
  const skip = (page - 1) * limit;

  const where: any = {};

  if (options.status && options.status !== "all") {
    where.status = options.status;
  } else {
    where.status = { not: "completed" };
  }

  if (options.workspace && options.workspace !== "all") {
    where.workspace = options.workspace;
  }

  if (options.priority && options.priority !== "all") {
    where.priority = options.priority;
  }

  if (options.assignedTo && options.assignedTo !== "all") {
    where.assignedTo = options.assignedTo;
  }

  if (options.search) {
    const s = options.search.trim();
    where.OR = [
      { title: { contains: s } },
      { description: { contains: s } },
      { deliverableType: { contains: s } },
    ];
  }

  const [total, tasks] = await Promise.all([
    db.task.count({ where }),
    db.task.findMany({
      where,
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      skip,
      take: limit,
      include: {
        project: { select: { id: true, title: true, workspace: true, clientName: true } },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;
  const hasMore = page < totalPages;

  return {
    tasks,
    total,
    page,
    limit,
    totalPages,
    hasMore,
  };
}

/**
 * Calculates live department workload strictly from database records.
 * Generates data-driven balancing recommendations based on real capacity and open tasks.
 */

/**
 * Calculates the creative weight and effort points for a deliverable.
 * - Heavy (8 pts): Multi-page sponsorship media packs, 3D broadcast packages, station idents.
 * - Medium (4 pts): 15-30s promos, lower thirds, L-shapes, show bumpers, video cutdowns.
 * - Light (2 pts): Social media posters, YouTube thumbnails, digital flyers, quick resizes.
 */
export function getTaskWeightPoints(task: {
  title: string;
  deliverableType?: string | null;
  priority?: string | null;
}): {
  points: number;
  tier: "heavy" | "medium" | "light";
  label: string;
} {
  const text = `${task.title} ${task.deliverableType || ""}`.toLowerCase();

  // Heavy: 8 points
  if (
    text.includes("media pack") ||
    text.includes("sponsorship") ||
    text.includes("ident") ||
    text.includes("3d") ||
    text.includes("title sequence") ||
    text.includes("rebrand") ||
    text.includes("package")
  ) {
    return { points: 8, tier: "heavy", label: "Heavy (Multi-Page / 3D Package)" };
  }

  // Medium: 4 points
  if (
    text.includes("promo") ||
    text.includes("advert") ||
    text.includes("teaser") ||
    text.includes("lower third") ||
    text.includes("l-shape") ||
    text.includes("bumper") ||
    text.includes("strap") ||
    text.includes("reel") ||
    text.includes("cutdown") ||
    text.includes("short")
  ) {
    return { points: 4, tier: "medium", label: "Medium (Broadcast Promo / Template)" };
  }

  // Light: 2 points
  if (
    text.includes("poster") ||
    text.includes("thumbnail") ||
    text.includes("banner") ||
    text.includes("flyer") ||
    text.includes("social") ||
    text.includes("resize")
  ) {
    return { points: 2, tier: "light", label: "Light (Single Artboard / Graphic)" };
  }

  if (task.priority === "urgent") {
    return { points: 6, tier: "heavy", label: "Urgent Priority Deliverable" };
  }

  return { points: 3, tier: "medium", label: "Standard Deliverable" };
}

/**
 * Generates rolling last 7 days team output & performance metrics.
 * Evaluates Dani, Sura, Kiru, Simon in exact order without punch-clock hours.
 */
export async function getRollingSevenDayTeamOutput(
  anchorDate: Date = new Date()
): Promise<SevenDayTeamPerformanceReport> {
  const sevenDaysAgo = new Date(anchorDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  const team = await db.teamMember.findMany();
  // Filter out Bereket (Lead) so only production artists are evaluated
  const artistsOnly = team.filter((m) => m.name.toLowerCase() !== "bereket");

  // Exact custom ordering requested by Bereket:
  // Dani, Sura (Graphic Designers)
  // Kiru, Simon (Motion Graphic Designers)
  const ARTIST_ORDER = ["Dani", "Sura", "Kiru", "Simon"];
  artistsOnly.sort((a, b) => {
    const idxA = ARTIST_ORDER.indexOf(a.name);
    const idxB = ARTIST_ORDER.indexOf(b.name);
    return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
  });

  const allTvTasks = await db.task.findMany({
    where: {
      workspace: "abbay_tv",
      OR: [
        { status: "completed", completedAt: { gte: sevenDaysAgo } },
        { status: { not: "completed" } },
      ],
    },
    orderBy: [{ completedAt: "desc" }, { priority: "desc" }, { updatedAt: "desc" }],
  });

  let maxPoints = 1;
  let totalDepartmentScore = 0;
  let totalCompletedLast7Days = 0;

  const artistReports: ArtistOutputReport[] = artistsOnly.map((member) => {
    const nameLower = member.name.toLowerCase();
    const assignedTasks = allTvTasks.filter(
      (t) => t.assignedTo && t.assignedTo.toLowerCase().includes(nameLower)
    );

    const completedLast7Days = assignedTasks.filter(
      (t) => t.status === "completed" && t.completedAt && new Date(t.completedAt) >= sevenDaysAgo
    );
    const activeTasks = assignedTasks.filter((t) => t.status !== "completed");

    let completedPoints = 0;
    let heavyCount = 0;
    let mediumCount = 0;
    let lightCount = 0;

    const recentDeliverables: Array<{
      title: string;
      tier: "heavy" | "medium" | "light";
      points: number;
      status: string;
      completedAt?: string | null;
    }> = [];

    completedLast7Days.forEach((t) => {
      const weight = getTaskWeightPoints(t);
      completedPoints += weight.points;
      if (weight.tier === "heavy") heavyCount++;
      else if (weight.tier === "medium") mediumCount++;
      else lightCount++;

      recentDeliverables.push({
        title: t.title,
        tier: weight.tier,
        points: weight.points,
        status: "completed",
        completedAt: t.completedAt ? t.completedAt.toISOString() : null,
      });
    });

    let activePoints = 0;
    activeTasks.forEach((t) => {
      const weight = getTaskWeightPoints(t);
      activePoints += Math.round(weight.points * 0.5);
      if (weight.tier === "heavy") heavyCount++;
      else if (weight.tier === "medium") mediumCount++;
      else lightCount++;

      recentDeliverables.push({
        title: t.title,
        tier: weight.tier,
        points: weight.points,
        status: t.status,
      });
    });

    const outputScore = completedPoints + activePoints;
    if (outputScore > maxPoints) maxPoints = outputScore;
    totalDepartmentScore += outputScore;
    totalCompletedLast7Days += completedLast7Days.length;

    const isGraphicDesigner = member.name.toLowerCase() === "dani" || member.name.toLowerCase() === "sura";
    const group: "Graphic Designer" | "Motion Graphic Designer" = isGraphicDesigner
      ? "Graphic Designer"
      : "Motion Graphic Designer";

    let status: "DEEP_FOCUS" | "BALANCED" | "AVAILABLE" = "AVAILABLE";
    if (activeTasks.some((t) => getTaskWeightPoints(t).tier === "heavy")) {
      status = "DEEP_FOCUS";
    } else if (activeTasks.length >= 2 || outputScore >= 6) {
      status = "BALANCED";
    }

    return {
      id: member.id,
      name: member.name,
      role: member.role,
      group,
      outputScore,
      relativePercent: 0,
      completedCount: completedLast7Days.length,
      activeCount: activeTasks.length,
      heavyDeliverablesCount: heavyCount,
      mediumDeliverablesCount: mediumCount,
      lightDeliverablesCount: lightCount,
      status,
      isTopPerformer: false,
      recentDeliverables: recentDeliverables.slice(0, 3),
    };
  });

  let topPerformerName: string | null = null;
  let highestScore = 0;
  artistReports.forEach((a) => {
    if (a.outputScore > highestScore) {
      highestScore = a.outputScore;
      topPerformerName = a.name;
    }
  });

  artistReports.forEach((a) => {
    a.relativePercent = maxPoints > 0 ? Math.round((a.outputScore / Math.max(maxPoints, 10)) * 100) : 0;
    if (topPerformerName && a.name === topPerformerName && highestScore > 0) {
      a.isTopPerformer = true;
    }
  });

  return {
    startDate: sevenDaysAgo.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    endDate: anchorDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    artists: artistReports,
    topPerformerName,
    totalDepartmentScore,
    totalCompletedLast7Days,
  };
}

export async function getDepartmentWorkload(anchorDate: Date = new Date()): Promise<DepartmentWorkloadReport> {
  const ARTIST_ORDER = ["Dani", "Sura", "Kiru", "Simon"];
  const allTeam = await db.teamMember.findMany();
  const team = allTeam
    .filter((m) => m.name.toLowerCase() !== "bereket")
    .sort((a, b) => {
      const idxA = ARTIST_ORDER.indexOf(a.name);
      const idxB = ARTIST_ORDER.indexOf(b.name);
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });

  const activeTvTasks = await db.task.findMany({
    where: {
      workspace: "abbay_tv",
      status: { not: "completed" },
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
  });

  let totalAssignedHours = 0;

  const teamReport: TeamWorkloadMember[] = team.map((member) => {
    const memberTasks = activeTvTasks.filter(
      (t) => t.assignedTo?.trim().toLowerCase() === member.name.trim().toLowerCase()
    );

    const assignedHours = memberTasks.reduce((sum, t) => sum + (t.estimatedHours !== null && t.estimatedHours !== undefined ? t.estimatedHours : 4.0), 0);
    totalAssignedHours += assignedHours;

    const capacity = typeof member.currentCapacityHours === "number" ? member.currentCapacityHours : 40.0;
    const loadPercent = capacity > 0 ? Math.round((assignedHours / capacity) * 100) : (assignedHours > 0 ? 100 : 0);
    const isOverloaded = loadPercent > 100;
    const status: "OVERLOADED" | "BUSY" | "AVAILABLE" = isOverloaded ? "OVERLOADED" : loadPercent > 70 ? "BUSY" : "AVAILABLE";

    return {
      id: member.id,
      name: member.name,
      role: member.role,
      skills: member.skills,
      capacityHours: capacity,
      assignedHours: Math.round(assignedHours * 10) / 10,
      taskCount: memberTasks.length,
      loadPercent,
      status,
      isOverloaded,
      tasks: memberTasks.map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        estimatedHours: t.estimatedHours !== null && t.estimatedHours !== undefined ? t.estimatedHours : 4.0,
        dueDate: t.dueDate ? t.dueDate.toISOString().split("T")[0] : null,
      })),
    };
  });

  const overloadedMembers = teamReport.filter((m) => m.isOverloaded);
  const availableMembers = teamReport.filter((m) => m.status === "AVAILABLE");

  // Dynamic recommendations based on actual workload and skills
  const recommendations: string[] = [];

  for (const overloaded of overloadedMembers) {
    const excessHours = Math.round((overloaded.assignedHours - overloaded.capacityHours) * 10) / 10;
    // Find candidate tasks to reassign (prefer medium or high tasks that aren't already completed)
    const candidates = overloaded.tasks.slice(1); // Keep the top priority task
    if (candidates.length > 0 && availableMembers.length > 0) {
      const targetAssignee = availableMembers[0];
      recommendations.push(
        `${overloaded.name} is currently loaded at ${overloaded.loadPercent}% (${overloaded.assignedHours}h assigned / ${overloaded.capacityHours}h weekly capacity, +${excessHours}h over capacity). Consider reassigning "${candidates[0].title}" to ${targetAssignee.name} (${targetAssignee.name} has available capacity: ${targetAssignee.capacityHours - targetAssignee.assignedHours}h free).`
      );
    } else {
      recommendations.push(
        `${overloaded.name} is loaded at ${overloaded.loadPercent}% (${overloaded.assignedHours}h / ${overloaded.capacityHours}h capacity). Prioritize urgent deliverables and defer lower-priority items.`
      );
    }
  }

  if (recommendations.length === 0) {
    recommendations.push("Department workload is well-balanced across all team members within their weekly capacity limits.");
  }

  return {
    department: "Abbay TV Graphics Department",
    lead: "Bereket",
    totalActiveTasks: activeTvTasks.length,
    totalAssignedHours: Math.round(totalAssignedHours * 10) / 10,
    team: teamReport,
    overloadedMembers,
    availableMembers,
    recommendations,
  };
}

/**
 * Normalizes a task title for fuzzy duplicate detection.
 */
export function normalizeTaskTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
    .replace(/\b(a|an|the|to|for|by|on|at|and|or|in|of|task|deliver|delivery|finish|create|render)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts version numbers, episode identifiers, and differentiating qualifiers.
 */
export function extractDifferentiatingTokens(title: string): {
  numbers: string[];
  qualifiers: string[];
} {
  const norm = title.toLowerCase();
  const numberMatches = norm.match(/\b(episode|ep|part|pt|round|cut|v|version)?\s*(\d+)\b/gi) || [];
  const numbers = numberMatches.map((n) => n.replace(/\s+/g, "").toLowerCase());

  const qualifiers: string[] = [];
  const keywords = ["teaser", "final", "rough", "main", "full", "short", "long", "morning", "evening", "prime-time", "sports", "news", "special", "bank"];
  for (const q of keywords) {
    if (new RegExp(`\\b${q.replace("-", "[- ]?")}\\b`, "i").test(norm)) {
      qualifiers.push(q);
    }
  }

  return { numbers, qualifiers };
}

/**
 * Checks if a task with an identical or very similar title is already active in the same workspace.
 * Non-destructive: protects against confusing distinct episodes, parts, or distinct show types.
 */
export async function checkTaskDuplicate(title: string, workspace: string): Promise<{
  isDuplicate: boolean;
  duplicateTask?: any;
  reason?: string;
  confidence?: "exact" | "high" | "none";
}> {
  const normTitle = normalizeTaskTitle(title);
  if (!normTitle) return { isDuplicate: false, confidence: "none" };

  const candTokens = extractDifferentiatingTokens(title);

  const activeInWorkspace = await db.task.findMany({
    where: {
      workspace,
      status: { not: "completed" },
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      assignedTo: true,
      dueDate: true,
      createdAt: true,
    },
  });

  for (const existing of activeInWorkspace) {
    const existingNorm = normalizeTaskTitle(existing.title);
    if (!existingNorm) continue;

    // 1. Exact match on raw trimmed title
    if (title.trim().toLowerCase() === existing.title.trim().toLowerCase()) {
      return {
        isDuplicate: true,
        duplicateTask: existing,
        confidence: "exact",
        reason: `An active task with exact identical title already exists: "${existing.title}" (Assigned: ${existing.assignedTo || "Unassigned"}, Status: ${existing.status})`,
      };
    }

    const exTokens = extractDifferentiatingTokens(existing.title);

    // If numbers differ (e.g. Episode 1 vs Episode 2, Part 1 vs Part 2), they are DISTINCT!
    if (
      candTokens.numbers.length > 0 &&
      exTokens.numbers.length > 0 &&
      candTokens.numbers.some((num) => !exTokens.numbers.includes(num))
    ) {
      continue;
    }

    // If qualifiers conflict (e.g. "teaser" vs "final", "morning" vs "evening"), they are DISTINCT!
    const hasConflictingQualifier =
      (candTokens.qualifiers.includes("teaser") && exTokens.qualifiers.includes("final")) ||
      (candTokens.qualifiers.includes("final") && exTokens.qualifiers.includes("teaser")) ||
      (candTokens.qualifiers.includes("morning") && exTokens.qualifiers.includes("evening")) ||
      (candTokens.qualifiers.includes("evening") && exTokens.qualifiers.includes("morning"));
    if (hasConflictingQualifier) {
      continue;
    }

    // 2. Exact match on normalized title
    if (normTitle === existingNorm) {
      return {
        isDuplicate: true,
        duplicateTask: existing,
        confidence: "high",
        reason: `An active task with identical intent already exists: "${existing.title}" (Assigned: ${existing.assignedTo || "Unassigned"}, Status: ${existing.status})`,
      };
    }

    // 3. High word token overlap
    const candWords = normTitle.split(" ").filter((w) => w.length > 2);
    const exWords = existingNorm.split(" ").filter((w) => w.length > 2);

    if (candWords.length >= 2 && exWords.length >= 2) {
      const common = candWords.filter((w) => exWords.includes(w));
      const overlapRatio = (2 * common.length) / (candWords.length + exWords.length);

      if (overlapRatio >= 0.8 && Math.abs(candWords.length - exWords.length) <= 1) {
        return {
          isDuplicate: true,
          duplicateTask: existing,
          confidence: "high",
          reason: `A highly similar active task already exists: "${existing.title}" (Assigned: ${existing.assignedTo || "Unassigned"}, Status: ${existing.status})`,
        };
      }
    }
  }

  return { isDuplicate: false, confidence: "none" };
}

export type DateResolutionCategory =
  | "relative"
  | "month_day_no_year"
  | "explicit_future"
  | "explicit_past_allowed"
  | "suspicious_ai_past"
  | "invalid"
  | "none";

export interface DateResolutionOptions {
  anchorDate?: Date;
  allowHistorical?: boolean;
  isNewTaskCreation?: boolean;
  defaultCutoffHour?: number;
}

export interface DateResolutionResult {
  date: Date | null;
  category: DateResolutionCategory;
  isNormalized: boolean;
  warning?: string;
  clarificationRequired?: boolean;
  details: {
    originalInput?: string | null;
    parsedYear?: number;
    parsedMonth?: number;
    parsedDay?: number;
    resolvedYear?: number;
  };
}

/**
 * Resolves task deadlines with explicit rules for relative, month/day, explicit future,
 * intentional historical, and suspicious AI dates.
 */
export function resolveDateDetailed(
  dateInput?: string | null,
  options: DateResolutionOptions = {}
): DateResolutionResult {
  if (!dateInput) {
    return {
      date: null,
      category: "none",
      isNormalized: false,
      details: { originalInput: dateInput },
    };
  }

  const trimmed = dateInput.trim();
  if (!trimmed) {
    return {
      date: null,
      category: "none",
      isNormalized: false,
      details: { originalInput: dateInput },
    };
  }

  const anchor = options.anchorDate ? new Date(options.anchorDate) : new Date();
  const anchorYear = anchor.getFullYear();
  const cutoffHour = options.defaultCutoffHour !== undefined ? options.defaultCutoffHour : 17; // 5:00 PM station cutoff
  const startOfToday = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 0, 0, 0, 0);

  const lower = trimmed.toLowerCase();

  // 1. Relative Dates
  if (lower === "today") {
    const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), cutoffHour, 0, 0, 0);
    return {
      date: d,
      category: "relative",
      isNormalized: false,
      details: { originalInput: trimmed, resolvedYear: d.getFullYear() },
    };
  }

  if (lower === "tomorrow") {
    const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 1, cutoffHour, 0, 0, 0);
    return {
      date: d,
      category: "relative",
      isNormalized: false,
      details: { originalInput: trimmed, resolvedYear: d.getFullYear() },
    };
  }

  if (lower === "day after tomorrow") {
    const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 2, cutoffHour, 0, 0, 0);
    return {
      date: d,
      category: "relative",
      isNormalized: false,
      details: { originalInput: trimmed, resolvedYear: d.getFullYear() },
    };
  }

  // Days of the week relative parsing
  const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const isNextWeek = lower.startsWith("next ");
  const cleanDay = lower.replace(/^(this|next)\s+/, "").trim();
  const targetDayIdx = daysOfWeek.indexOf(cleanDay);

  if (targetDayIdx !== -1) {
    const currentDayIdx = anchor.getDay();
    let diff = (targetDayIdx - currentDayIdx + 7) % 7;
    if (diff === 0) diff = 7;
    if (isNextWeek) diff += 7;

    const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + diff, cutoffHour, 0, 0, 0);
    return {
      date: d,
      category: "relative",
      isNormalized: false,
      details: { originalInput: trimmed, resolvedYear: d.getFullYear() },
    };
  }

  // In X days
  const inDaysMatch = lower.match(/^(?:in\s+)?\+?(\d+)\s*days?$/);
  if (inDaysMatch) {
    const numDays = parseInt(inDaysMatch[1], 10);
    const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + numDays, cutoffHour, 0, 0, 0);
    return {
      date: d,
      category: "relative",
      isNormalized: false,
      details: { originalInput: trimmed, resolvedYear: d.getFullYear() },
    };
  }

  // 2. Month and Day without a year (e.g. "Nov 5", "November 5", "March 6", "11/05", "11-05")
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const fullMonths = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

  const monthWordMatch = lower.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/);
  if (monthWordMatch) {
    const mStr = monthWordMatch[1];
    const day = parseInt(monthWordMatch[2], 10);
    let mIdx = months.indexOf(mStr.slice(0, 3));
    if (mIdx === -1) mIdx = fullMonths.indexOf(mStr);

    if (mIdx !== -1 && day >= 1 && day <= 31) {
      const candidateThisYear = new Date(anchorYear, mIdx, day, cutoffHour, 0, 0, 0);
      if (candidateThisYear >= startOfToday) {
        return {
          date: candidateThisYear,
          category: "month_day_no_year",
          isNormalized: false,
          details: { originalInput: trimmed, parsedMonth: mIdx + 1, parsedDay: day, resolvedYear: anchorYear },
        };
      } else {
        const nextYearDate = new Date(anchorYear + 1, mIdx, day, cutoffHour, 0, 0, 0);
        return {
          date: nextYearDate,
          category: "month_day_no_year",
          isNormalized: true,
          warning: `Date "${trimmed}" has already passed in ${anchorYear}; scheduled for next annual occurrence on ${nextYearDate.toISOString().split("T")[0]}.`,
          details: { originalInput: trimmed, parsedMonth: mIdx + 1, parsedDay: day, resolvedYear: anchorYear + 1 },
        };
      }
    }
  }

  // MM/DD or MM-DD without year
  const mmDdMatch = trimmed.match(/^(\d{1,2})[-\/](\d{1,2})$/);
  if (mmDdMatch) {
    const mIdx = parseInt(mmDdMatch[1], 10) - 1;
    const day = parseInt(mmDdMatch[2], 10);
    if (mIdx >= 0 && mIdx <= 11 && day >= 1 && day <= 31) {
      const candidateThisYear = new Date(anchorYear, mIdx, day, cutoffHour, 0, 0, 0);
      if (candidateThisYear >= startOfToday) {
        return {
          date: candidateThisYear,
          category: "month_day_no_year",
          isNormalized: false,
          details: { originalInput: trimmed, parsedMonth: mIdx + 1, parsedDay: day, resolvedYear: anchorYear },
        };
      } else {
        const nextYearDate = new Date(anchorYear + 1, mIdx, day, cutoffHour, 0, 0, 0);
        return {
          date: nextYearDate,
          category: "month_day_no_year",
          isNormalized: true,
          warning: `Date "${trimmed}" has already passed in ${anchorYear}; scheduled for next occurrence on ${nextYearDate.toISOString().split("T")[0]}.`,
          details: { originalInput: trimmed, parsedMonth: mIdx + 1, parsedDay: day, resolvedYear: anchorYear + 1 },
        };
      }
    }
  }

  // 3. Explicit Date with a Year
  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;

  const ymdMatch = trimmed.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:T.*)?$/);
  if (ymdMatch) {
    year = parseInt(ymdMatch[1], 10);
    month = parseInt(ymdMatch[2], 10) - 1;
    day = parseInt(ymdMatch[3], 10);
  } else {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      year = parsed.getFullYear();
      month = parsed.getMonth();
      day = parsed.getDate();
    }
  }

  if (year !== null && month !== null && day !== null) {
    const targetDate = new Date(year, month, day, cutoffHour, 0, 0, 0);

    // Case 3A: Future or Today
    if (targetDate >= startOfToday) {
      return {
        date: targetDate,
        category: "explicit_future",
        isNormalized: false,
        details: { originalInput: trimmed, parsedYear: year, parsedMonth: month + 1, parsedDay: day, resolvedYear: year },
      };
    }

    // Case 3B: Past Date (< startOfToday)
    // If historical dates are explicitly allowed (e.g. reading existing task or intentional historical record):
    if (options.allowHistorical) {
      return {
        date: targetDate,
        category: "explicit_past_allowed",
        isNormalized: false,
        details: { originalInput: trimmed, parsedYear: year, parsedMonth: month + 1, parsedDay: day, resolvedYear: year },
      };
    }

    // If new task creation (or updating deadline with a past date):
    if (options.isNewTaskCreation) {
      // Check if year is a retired AI year before anchorYear (e.g. 2024 or 2025 when anchor is 2026)
      if (year < anchorYear) {
        const candidateInAnchorYear = new Date(anchorYear, month, day, cutoffHour, 0, 0, 0);

        // Subcase 3B1: Month/Day is upcoming in anchor year (e.g. 2024-10-18 when anchor is 2026-10-14)
        if (candidateInAnchorYear >= startOfToday) {
          return {
            date: candidateInAnchorYear,
            category: "suspicious_ai_past",
            isNormalized: true,
            warning: `⚠️ Suspicious Year Corrected: Input "${trimmed}" contained retired year ${year}; unambiguously normalized to upcoming date "${candidateInAnchorYear.toISOString().split("T")[0]}".`,
            details: { originalInput: trimmed, parsedYear: year, parsedMonth: month + 1, parsedDay: day, resolvedYear: anchorYear },
          };
        } else {
          // Subcase 3B2: Month/Day has ALREADY passed in anchor year as well (e.g. 2025-03-06 when anchor is 2026-10-14)
          // Flag clarification required rather than silently rescheduling!
          const candidateNextYear = new Date(anchorYear + 1, month, day, cutoffHour, 0, 0, 0);
          return {
            date: candidateNextYear,
            category: "suspicious_ai_past",
            isNormalized: true,
            clarificationRequired: true,
            warning: `⚠️ Ambiguous Stale Deadline: Date "${trimmed}" is in the past (both in ${year} and ${anchorYear}). If intended for the upcoming annual cycle, target is ${candidateNextYear.toISOString().split("T")[0]}; otherwise please specify a valid deadline.`,
            details: { originalInput: trimmed, parsedYear: year, parsedMonth: month + 1, parsedDay: day, resolvedYear: anchorYear + 1 },
          };
        }
      }

      // Year is current anchor year but date is in the past (e.g. 2026-10-10 on 2026-10-14)
      if (year === anchorYear) {
        return {
          date: targetDate,
          category: "explicit_past_allowed",
          isNormalized: false,
          warning: `⚠️ Past Date Recorded: Deadline ${targetDate.toISOString().split("T")[0]} is in the past relative to today (${anchor.toISOString().split("T")[0]}). Task created as overdue.`,
          details: { originalInput: trimmed, parsedYear: year, parsedMonth: month + 1, parsedDay: day, resolvedYear: year },
        };
      }
    }

    return {
      date: targetDate,
      category: "explicit_past_allowed",
      isNormalized: false,
      details: { originalInput: trimmed, parsedYear: year, parsedMonth: month + 1, parsedDay: day, resolvedYear: year },
    };
  }

  return {
    date: null,
    category: "invalid",
    isNormalized: false,
    warning: `Unable to parse date string "${trimmed}".`,
    details: { originalInput: trimmed },
  };
}

/**
 * Resolves dates safely against a reference anchor date (backward compatible helper).
 */
export function resolveDateWithAnchor(
  dateInput?: string | null,
  optionsOrAnchor: DateResolutionOptions | Date = new Date()
): Date | null {
  const options: DateResolutionOptions =
    optionsOrAnchor instanceof Date ? { anchorDate: optionsOrAnchor } : optionsOrAnchor;
  return resolveDateDetailed(dateInput, options).date;
}

/**
 * Safe task creation with duplicate warning and date normalization.
 */
export async function createTaskSafe(data: {
  title: string;
  workspace?: string;
  description?: string;
  assignedTo?: string;
  dueDate?: string;
  priority?: string;
  deliverableType?: string;
  estimatedHours?: number;
  projectId?: string;
  tags?: string;
  anchorDate?: Date;
  allowHistorical?: boolean;
  allowDuplicate?: boolean;
}) {
  const workspace = data.workspace || "abbay_tv";
  const anchor = data.anchorDate || new Date();

  // Duplicate check
  const duplicateCheck = await checkTaskDuplicate(data.title, workspace);
  let duplicateWarning: string | undefined;

  if (duplicateCheck.isDuplicate) {
    duplicateWarning = `⚠️ Duplicate Detected: ${duplicateCheck.reason}. The task was still recorded, but you may want to consolidate.`;
  }

  // Refined date resolution
  const dateRes = resolveDateDetailed(data.dueDate, {
    anchorDate: anchor,
    isNewTaskCreation: true,
    allowHistorical: data.allowHistorical,
  });

  const parsedDueDate = dateRes.date;
  let combinedWarning = duplicateWarning;
  if (dateRes.warning) {
    combinedWarning = combinedWarning ? `${combinedWarning} | ${dateRes.warning}` : dateRes.warning;
  }

  const task = await db.task.create({
    data: {
      title: data.title.trim(),
      workspace,
      description: data.description?.trim() || null,
      status: "todo",
      priority: data.priority || "medium",
      deliverableType: data.deliverableType || null,
      assignedTo: data.assignedTo || null,
      dueDate: parsedDueDate,
      estimatedHours: data.estimatedHours ? Number(data.estimatedHours) : 4.0,
      projectId: data.projectId || null,
      tags: data.tags || null,
    },
    include: {
      project: { select: { id: true, title: true, workspace: true } },
    },
  });

  await db.activityLog.create({
    data: {
      taskId: task.id,
      action: "created",
      details: `Created task "${task.title}" in ${task.workspace}${task.assignedTo ? ` for ${task.assignedTo}` : ""}${combinedWarning ? ` (${combinedWarning})` : ""}`,
    },
  });

  return {
    task,
    duplicateWarning,
    dateWarning: dateRes.warning,
    clarificationRequired: dateRes.clarificationRequired,
    dateCategory: dateRes.category,
  };
}

/**
 * Generates an executive briefing data object grounded strictly in actual database records.
 */
export async function getBriefingData(anchorDate: Date = new Date()) {
  const [metrics, workloadReport, activeProjects] = await Promise.all([
    getTaskMetrics(anchorDate),
    getDepartmentWorkload(anchorDate),
    db.project.findMany({
      where: { status: { not: "completed" } },
      select: {
        id: true,
        title: true,
        workspace: true,
        progress: true,
        nextAction: true,
        targetDate: true,
        clientName: true,
      },
    }),
  ]);

  return {
    anchorDate,
    metrics,
    workloadReport,
    activeProjects,
  };
}
