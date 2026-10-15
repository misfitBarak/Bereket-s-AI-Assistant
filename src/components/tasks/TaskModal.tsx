"use client";

import React, { useState, useEffect } from "react";
import { X, Calendar, Clock, User, Tag, Layers, AlertCircle } from "lucide-react";
import { TaskItem, WorkspaceType, TaskStatus, TaskPriority } from "@/types";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: Partial<TaskItem>) => Promise<void>;
  initialTask?: Partial<TaskItem> | null;
  defaultWorkspace?: WorkspaceType;
  teamMembers?: Array<{ name: string; role: string }>;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTask,
  defaultWorkspace = "abbay_tv",
  teamMembers = [],
}) => {
  const [title, setTitle] = useState("");
  const [workspace, setWorkspace] = useState<WorkspaceType>(defaultWorkspace);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [deliverableType, setDeliverableType] = useState("Promo");
  const [assignedTo, setAssignedTo] = useState("Dani");
  const [dueDate, setDueDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("4.0");
  const [tags, setTags] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title || "");
      setWorkspace(initialTask.workspace || defaultWorkspace);
      setDescription(initialTask.description || "");
      setStatus(initialTask.status || "todo");
      setPriority(initialTask.priority || "medium");
      setDeliverableType(initialTask.deliverableType || "Promo");
      setAssignedTo(initialTask.assignedTo || "Abbay");
      setDueDate(
        initialTask.dueDate ? new Date(initialTask.dueDate).toISOString().split("T")[0] : ""
      );
      setEstimatedHours(initialTask.estimatedHours ? String(initialTask.estimatedHours) : "4.0");
      setTags(initialTask.tags || "");
    } else {
      setTitle("");
      setWorkspace(defaultWorkspace);
      setDescription("");
      setStatus("todo");
      setPriority("medium");
      setDeliverableType("Promo");
      setAssignedTo(defaultWorkspace === "abbay_tv" ? "Dani" : "Abbay");
      setDueDate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
      setEstimatedHours("4.0");
      setTags("");
    }
    setError("");
  }, [initialTask, defaultWorkspace, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please enter a task title");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      await onSave({
        ...(initialTask?.id ? { id: initialTask.id } : {}),
        title: title.trim(),
        workspace,
        description: description.trim() || null,
        status,
        priority,
        deliverableType,
        assignedTo,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        estimatedHours: parseFloat(estimatedHours) || 4.0,
        tags: tags.trim() || null,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deliverableOptions = [
    "Promo",
    "Advert",
    "Lower Third",
    "L-Shape",
    "Thumbnail",
    "Poster",
    "Media Pack",
    "Broadcast Graphic",
    "Freelance Video",
    "Reel / Short",
    "YouTube Video",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4 mb-5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {initialTask?.id ? "Edit Task" : "Create New Task"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              Task Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Deliver MMA Media Pack & Promo Cutdown"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Workspace
              </label>
              <select
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value as WorkspaceType)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="abbay_tv">Abbay TV Graphics</option>
                <option value="client_work">Client Work</option>
                <option value="personal_projects">Personal Projects</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Assigned Person
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Abbay">Abbay (Me - Lead)</option>
                <option value="Dani">Dani (3D / Motion)</option>
                <option value="Sura">Sura (Promos / DaVinci)</option>
                <option value="Simon">Simon (Broadcast / L-Shapes)</option>
                <option value="Kiru">Kiru (Thumbnails / Graphics)</option>
                <option value="Bereket">Bereket (Junior / Cutdowns)</option>
                {teamMembers
                  .filter((m) => !["Abbay", "Dani", "Sura", "Simon", "Kiru", "Bereket"].includes(m.name))
                  .map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name} ({m.role})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="backlog">Backlog</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="blocked">Blocked</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Deliverable Type
              </label>
              <select
                value={deliverableType}
                onChange={(e) => setDeliverableType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {deliverableOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Estimated Hours
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="4.0"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              Description & Requirements
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add key deliverable specs, DaVinci Resolve settings, safe margins, or audio notes..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" /> Tags (Comma separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Broadcast, 3D, Promo, Revision"
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : initialTask?.id ? "Update Task" : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
