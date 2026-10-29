"use client";

import React, { useState, useEffect } from "react";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Users,
  Sparkles,
  TrendingUp,
  Plus,
  Tv,
  Calendar,
  Layers,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { TaskItem, WorkspaceType } from "@/types";
import { formatDate, formatCurrency } from "@/lib/utils";

interface DashboardViewProps {
  onOpenTaskModal: (task?: Partial<TaskItem>, workspace?: WorkspaceType) => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenTaskModal,
  onNavigateTab,
}) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/analytics");
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleToggleTaskStatus = async (task: TaskItem) => {
    const newStatus = task.status === "completed" ? "todo" : "completed";
    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status: newStatus }),
      });
      fetchAnalytics();
    } catch (err) {
      console.error("Failed to toggle task:", err);
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading command center dashboard...</span>
      </div>
    );
  }

  const {
    overdueCount = 0,
    todayCount = 0,
    todayTasks = [],
    overdueTasks = [],
    upcomingDeadlines = [],
    financials = { totalQuoted: 0, totalPaid: 0, pendingBalance: 0, currency: "ETB" },
    teamWorkload = [],
    workspaceStats = {},
  } = stats || {};

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 bg-slate-50 dark:bg-slate-950">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-2xl p-6 text-white shadow-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-md">
              Abbay TV Graphics Department
            </span>
            <span className="text-xs text-white/70">• Broadcast Operations</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Personal Command Center</h1>
          <p className="text-sm text-blue-100 mt-1 max-w-xl">
            Welcome, Bereket. Lead your 4 broadcast artists (Dani, Sura, Simon, Kiru) and department deliverables at Abbay TV, coordinate on-air graphics, and manage team workload.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onNavigateTab("chat")}
            className="px-4 py-2.5 rounded-xl bg-white text-blue-900 font-semibold text-sm hover:bg-blue-50 transition shadow-sm flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-blue-600" />
            AI Assistant
          </button>
          <button
            onClick={() => onOpenTaskModal(undefined, "abbay_tv")}
            className="px-4 py-2.5 rounded-xl bg-blue-500/30 hover:bg-blue-500/40 text-white font-medium text-sm transition border border-white/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>
      </div>

      {/* Overdue Alert Banner (if any) */}
      {overdueCount > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-900 dark:text-red-200">
                {overdueCount} task{overdueCount > 1 ? "s are" : " is"} overdue
              </p>
              <p className="text-xs text-red-700 dark:text-red-400">
                Action required to avoid broadcast promo or on-air delivery delays.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab("tasks")}
            className="text-xs font-medium text-red-700 dark:text-red-300 hover:underline px-3 py-1.5"
          >
            View Overdue Tasks
          </button>
        </div>
      )}

      {/* Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Today's Focus</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {todayCount} <span className="text-xs font-normal text-slate-500">priority tasks</span>
          </div>
          <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
            {todayCount === 0 ? "Ready for new deliverables" : "Abbay TV Graphics queue"}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Abbay TV Team</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {teamWorkload.length}{" "}
            <span className="text-xs font-normal text-slate-500">artists active</span>
          </div>
          <div className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
            Dani, Sura, Simon, Kiru, Bereket
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Broadcast Queue</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
              <Tv className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {workspaceStats.abbay_tv?.active || 0} <span className="text-xs font-normal text-slate-500">active items</span>
          </div>
          <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            {workspaceStats.abbay_tv?.completed || 0} completed on-air items
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Personal Goals</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {workspaceStats.personal_projects?.active || 0}{" "}
            <span className="text-xs font-normal text-slate-500">active items</span>
          </div>
          <div className="mt-2 text-xs text-purple-600 dark:text-purple-400 font-medium">
            Masterclass & AI Pipelines
          </div>
        </div>
      </div>

      {/* Main Grid: Today's Priorities & Team Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Priority List (2 Cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Today's Priority Deliverables
              </h2>
            </div>
            <button
              onClick={() => onNavigateTab("tasks")}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
            >
              All Tasks <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {todayTasks.length === 0 ? (
            <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-sm">
              No tasks due today. Excellent! All daily quotas are cleared.
            </div>
          ) : (
            <div className="space-y-3">
              {todayTasks.slice(0, 6).map((task: TaskItem) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 transition group"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleTaskStatus(task)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                        task.status === "completed"
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "border-slate-300 dark:border-slate-600 hover:border-blue-500"
                      }`}
                    >
                      {task.status === "completed" && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-semibold ${
                            task.status === "completed"
                              ? "line-through text-slate-400"
                              : "text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          {task.title}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                            task.priority === "urgent"
                              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          }`}
                        >
                          {task.priority.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {task.assignedTo || "Unassigned"}
                        </span>
                        {task.deliverableType && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-700/60 text-[10px]">
                            {task.deliverableType}
                          </span>
                        )}
                        <span>{formatDate(task.dueDate)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onOpenTaskModal(task, task.workspace)}
                    className="opacity-0 group-hover:opacity-100 text-xs px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Graphics Department Team Workload Overview (1 Col) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Tv className="w-4 h-4 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Team Workload
              </h2>
            </div>
            <button
              onClick={() => onNavigateTab("abbay_tv")}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Manage
            </button>
          </div>

          <p className="text-xs text-slate-500 mb-4">
            Current assigned hours vs weekly capacity for Graphics Department artists.
          </p>

          <div className="space-y-4">
            {teamWorkload.map((m: any) => (
              <div key={m.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {m.name}
                  </span>
                  <span
                    className={`font-mono text-[11px] ${
                      m.isOverloaded
                        ? "text-red-600 dark:text-red-400 font-bold"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {m.assignedHours}h / {m.capacity}h ({m.loadPercentage}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      m.isOverloaded
                        ? "bg-red-500"
                        : m.loadPercentage > 70
                        ? "bg-amber-500"
                        : "bg-blue-600"
                    }`}
                    style={{ width: `${Math.min(m.loadPercentage, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button
              onClick={() => onNavigateTab("chat")}
              className="w-full text-center text-xs py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 font-medium transition"
            >
              Ask AI to Balance Workload
            </button>
          </div>
        </div>
      </div>

      {/* Upcoming Deadlines in 7 Days */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Deadlines Approaching (Next 7 Days)
            </h2>
          </div>
          <span className="text-xs text-slate-500">{upcomingDeadlines.length} deliverables queued</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {upcomingDeadlines.slice(0, 6).map((t: TaskItem) => (
            <div
              key={t.id}
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                      t.workspace === "abbay_tv"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        : "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                    }`}
                  >
                    {t.workspace.replace("_", " ")}
                  </span>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {formatDate(t.dueDate)}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">
                  {t.title}
                </h4>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500">
                <span>{t.assignedTo || "Unassigned"}</span>
                <span className="capitalize">{t.status.replace("_", " ")}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
