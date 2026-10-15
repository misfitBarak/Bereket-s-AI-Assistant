"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  Trash2,
  Edit2,
  AlertCircle,
  Layers,
  ArrowUpDown,
  RefreshCw,
} from "lucide-react";
import { TaskItem, WorkspaceType, TaskStatus, TaskPriority } from "@/types";
import { formatDate } from "@/lib/utils";

interface TasksViewProps {
  onOpenTaskModal: (task?: Partial<TaskItem>, workspace?: WorkspaceType) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({ onOpenTaskModal }) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedWorkspace !== "all") params.append("workspace", selectedWorkspace);
      if (selectedStatus !== "all") params.append("status", selectedStatus);
      if (selectedPriority !== "all") params.append("priority", selectedPriority);
      if (search.trim()) params.append("search", search.trim());

      const res = await fetch(`/api/tasks?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks);
      }
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [selectedWorkspace, selectedStatus, selectedPriority]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTasks();
  };

  const handleToggleTaskStatus = async (task: TaskItem) => {
    const newStatus: TaskStatus = task.status === "completed" ? "todo" : "completed";
    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status: newStatus }),
      });
      fetchTasks();
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleDeleteTask = async (task: TaskItem) => {
    if (!confirm(`Are you sure you want to delete task "${task.title}"?`)) return;
    try {
      await fetch(`/api/tasks?id=${task.id}`, { method: "DELETE" });
      fetchTasks();
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Task & Deliverables Master Registry
          </h1>
          <p className="text-xs text-slate-500">
            View, filter, edit, and organize all tasks across Abbay TV Graphics, Client Projects, and Personal Goals.
          </p>
        </div>

        <button
          onClick={() => onOpenTaskModal(undefined, "abbay_tv")}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition shadow-sm flex items-center gap-1.5 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> Add Task
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, description, or tags..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Workspace:</span>
            <select
              value={selectedWorkspace}
              onChange={(e) => setSelectedWorkspace(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Workspaces</option>
              <option value="abbay_tv">Abbay TV Graphics</option>
              <option value="client_work">Client Work</option>
              <option value="personal_projects">Personal Projects</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Statuses</option>
              <option value="backlog">Backlog</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="blocked">Blocked</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Priority:</span>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="ml-auto text-xs text-slate-500 font-mono">
            {tasks.length} task{tasks.length !== 1 ? "s" : ""} found
          </div>
        </div>
      </div>

      {/* Tasks Table / Cards */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            <span>Loading tasks...</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            No tasks match the active filters.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition flex items-center justify-between gap-4 group"
              >
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                  <button
                    onClick={() => handleToggleTaskStatus(task)}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                      task.status === "completed"
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : "border-slate-300 dark:border-slate-600 hover:border-blue-500"
                    }`}
                  >
                    {task.status === "completed" && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-sm font-semibold truncate ${
                          task.status === "completed"
                            ? "line-through text-slate-400"
                            : "text-slate-900 dark:text-white"
                        }`}
                      >
                        {task.title}
                      </span>

                      {/* Workspace badge */}
                      <span
                        className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                          task.workspace === "abbay_tv"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                            : task.workspace === "client_work"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                        }`}
                      >
                        {task.workspace.replace("_", " ")}
                      </span>

                      {/* Priority badge */}
                      <span
                        className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          task.priority === "urgent"
                            ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                            : task.priority === "high"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {task.priority}
                      </span>

                      {/* Deliverable Type */}
                      {task.deliverableType && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {task.deliverableType}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> {task.assignedTo || "Unassigned"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {formatDate(task.dueDate)}
                      </span>
                      {task.estimatedHours && (
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" /> {task.estimatedHours}h
                        </span>
                      )}
                      <span className="capitalize text-slate-400">
                        Status: {task.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Action buttons */}
                <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                  <button
                    onClick={() => onOpenTaskModal(task, task.workspace)}
                    title="Edit task"
                    className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task)}
                    title="Delete task"
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
