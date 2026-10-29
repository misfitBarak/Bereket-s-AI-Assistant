"use client";

import React, { useState, useEffect } from "react";
import {
  Tv,
  Users,
  Plus,
  Filter,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Copy,
  Check,
  Edit2,
  Trash2,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { TaskItem, TeamMemberItem } from "@/types";
import { formatDate } from "@/lib/utils";

interface AbbayTvViewProps {
  onOpenTaskModal: (task?: Partial<TaskItem>, workspace?: "abbay_tv") => void;
  onNavigateTab: (tab: string) => void;
}

export const AbbayTvView: React.FC<AbbayTvViewProps> = ({ onOpenTaskModal, onNavigateTab }) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [team, setTeam] = useState<TeamMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDeliverable, setFilterDeliverable] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [activeTab, setActiveTab] = useState<"board" | "roster" | "recurring" | "report">("board");

  // Report state
  const [reportMarkdown, setReportMarkdown] = useState<string>("");
  const [copiedReport, setCopiedReport] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // New team member modal state
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Partial<TeamMemberItem> | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tasksRes, teamRes] = await Promise.all([
        fetch("/api/tasks?workspace=abbay_tv"),
        fetch("/api/team"),
      ]);
      const tasksData = await tasksRes.json();
      const teamData = await teamRes.json();

      if (tasksData.success) setTasks(tasksData.tasks);
      if (teamData.success) setTeam(teamData.team);
    } catch (err) {
      console.error("Failed to load Abbay TV workspace data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });
      fetchData();
    } catch (err) {
      console.error("Failed to update task status:", err);
    }
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember?.name?.trim() || !editingMember?.role?.trim()) return;

    try {
      const method = editingMember.id ? "PUT" : "POST";
      await fetch("/api/team", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingMember),
      });
      setIsMemberModalOpen(false);
      setEditingMember(null);
      fetchData();
    } catch (err) {
      console.error("Failed to save team member:", err);
    }
  };

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const completed = tasks.filter((t) => t.status === "completed");
      const inProgress = tasks.filter((t) => t.status === "in_progress" || t.status === "in_review");
      const urgent = tasks.filter((t) => t.priority === "urgent" && t.status !== "completed");

      const now = new Date();
      const weekDate = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

      const md = `# Abbay TV — Graphics Department Weekly Management Report
**Date:** ${weekDate}  
**Lead:** Bereket (Graphics Department Lead)  
**Broadcast Week Status:** Active & On Air  

---

### 1. Executive Summary
The Graphics Department maintained uninterrupted on-air deliverables for Abbay TV's weekly broadcast lineup.
Production Team:
• Graphic Designers: Dani, Sura
• Motion Graphic Designers: Kiru, Simon

Output was evaluated based on deliverable creative weight (sponsorship media packs, 3D broadcast packages, promotional teasers, and digital posters) to ensure balanced department execution without punch-clock distortion.

---

### 2. Completed Deliverables (${completed.length})
${completed.length === 0 ? "*No deliverables marked completed this cycle yet.*" : completed.map((t) => `- **[${t.deliverableType || "Graphics"}]** ${t.title} — *Delivered by ${t.assignedTo || "Team"}*`).join("\n")}

---

### 3. Active & In-Progress Production Queue (${inProgress.length})
${inProgress.length === 0 ? "*No active production deliverables queued.*" : inProgress.map((t) => `- **${t.title}** (${t.deliverableType || "Deliverable"})  
  Assigned: \`${t.assignedTo || "Unassigned"}\` | Priority: \`${t.priority.toUpperCase()}\` | Due: \`${formatDate(t.dueDate)}\``).join("\n")}

---

### 4. Urgent Deliverables Under Scrutiny (${urgent.length})
${urgent.length === 0 ? "✅ No urgent bottlenecks detected." : urgent.map((u) => `- ⚠️ **${u.title}** (Assigned to: ${u.assignedTo}) — Target Due: ${formatDate(u.dueDate)}`).join("\n")}

---

### 5. Graphics Department Roster & Capacity
${team.map((m) => `- **${m.name}** (${m.role}): Assigned ${m.totalAssignedHours || 0} hrs / ${m.currentCapacityHours} hrs capacity (${m.status.toUpperCase()})`).join("\n")}

---
*Generated by Abbay AI Command Center for Abbay TV Station Management.*`;

      setReportMarkdown(md);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const copyReportToClipboard = () => {
    navigator.clipboard.writeText(reportMarkdown);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (filterDeliverable !== "all" && t.deliverableType !== filterDeliverable) return false;
    if (filterAssignee !== "all" && t.assignedTo?.toLowerCase() !== filterAssignee.toLowerCase()) return false;
    return true;
  });

  const deliverableTypes = [
    "all",
    "Promo",
    "Advert",
    "Lower Third",
    "L-Shape",
    "Thumbnail",
    "Poster",
    "Media Pack",
    "Broadcast Graphic",
  ];

  const columns = [
    { id: "backlog", label: "Backlog", color: "border-slate-400" },
    { id: "todo", label: "To Do", color: "border-blue-500" },
    { id: "in_progress", label: "In Progress", color: "border-amber-500" },
    { id: "in_review", label: "In Review", color: "border-purple-500" },
    { id: "blocked", label: "Blocked", color: "border-red-500" },
    { id: "completed", label: "Completed", color: "border-emerald-500" },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Abbay TV — Graphics Department
            </h1>
            <p className="text-xs text-slate-500">
              Shared team board, broadcast deliverables, promos, lower thirds, and weekly management reporting.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenTaskModal(undefined, "abbay_tv")}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add TV Task
          </button>
        </div>
      </div>

      {/* Workspace Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("board")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === "board"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Shared Team Board
        </button>
        <button
          onClick={() => setActiveTab("roster")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === "roster"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Artist Roster ({team.filter((m: any) => m.name !== "Bereket").length})
        </button>
        <button
          onClick={() => {
            setActiveTab("report");
            handleGenerateReport();
          }}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
            activeTab === "report"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Management Weekly Report
        </button>
      </div>

      {/* 1. SHARED TEAM BOARD VIEW */}
      {activeTab === "board" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Deliverable:
              </span>
              <div className="flex flex-wrap gap-1">
                {deliverableTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterDeliverable(type)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition ${
                      filterDeliverable === type
                        ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-500">Artist:</span>
              <select
                value={filterAssignee}
                onChange={(e) => setFilterAssignee(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="all">All Team Members</option>
                {team.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Kanban Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {columns.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.id);
              return (
                <div
                  key={col.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs flex flex-col min-h-[500px]"
                >
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full border-2 ${col.color}`} />
                      {col.label}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {colTasks.length}
                    </span>
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto">
                    {colTasks.length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-xs italic">
                        No deliverables
                      </div>
                    )}
                    {colTasks.map((t) => (
                      <div
                        key={t.id}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-blue-400 dark:hover:border-blue-600 transition group flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span
                              className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                                t.priority === "urgent"
                                  ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                                  : t.priority === "high"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                              }`}
                            >
                              {t.priority}
                            </span>
                            {t.deliverableType && (
                              <span className="text-[10px] font-medium text-slate-500">
                                {t.deliverableType}
                              </span>
                            )}
                          </div>
                          <h4
                            onClick={() => onOpenTaskModal(t, "abbay_tv")}
                            className="text-xs font-bold text-slate-900 dark:text-slate-100 cursor-pointer hover:text-blue-600"
                          >
                            {t.title}
                          </h4>
                          {t.description && (
                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                              {t.description}
                            </p>
                          )}
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <Users className="w-3 h-3" /> {t.assignedTo || "Unassigned"}
                          </span>
                          <span>{formatDate(t.dueDate)}</span>
                        </div>

                        {/* Quick move dropdown */}
                        <div className="mt-2 pt-1 flex items-center justify-between">
                          <select
                            value={t.status}
                            onChange={(e) => handleStatusChange(t.id, e.target.value)}
                            className="w-full text-[10px] py-1 px-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          >
                            <option value="backlog">Move to Backlog</option>
                            <option value="todo">Move to To Do</option>
                            <option value="in_progress">Move to In Progress</option>
                            <option value="in_review">Move to In Review</option>
                            <option value="blocked">Move to Blocked</option>
                            <option value="completed">Move to Completed</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. TEAM ROSTER & WORKLOAD VIEW */}
      {activeTab === "roster" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Graphics Department Roster
              </h2>
              <p className="text-xs text-slate-500">
                Manage team artist profiles, skills, weekly capacity hours, and live task allocations.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingMember({ currentCapacityHours: 40, status: "available" });
                setIsMemberModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Team Member
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...team]
              .filter((m) => m.name.toLowerCase() !== "bereket")
              .sort((a, b) => {
                const order = ["Dani", "Sura", "Kiru", "Simon"];
                const idxA = order.indexOf(a.name);
                const idxB = order.indexOf(b.name);
                return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
              })
              .map((member) => (
              <div
                key={member.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300">
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                        {member.name}
                      </h3>
                      <p className="text-xs text-slate-500">{member.role}</p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      member.status === "overloaded"
                        ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                        : member.status === "busy"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    }`}
                  >
                    {member.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Core Specialties:
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug">
                    {member.skills}
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Department Role:</span>
                    <span className="font-semibold text-xs text-blue-600 dark:text-blue-400">
                      {member.name === "Dani" || member.name === "Sura" ? "Graphic Designer" : "Motion Graphic Designer"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Active Queue:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {member.activeTaskCount || 0} assigned deliverable{(member.activeTaskCount || 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                {member.notes && (
                  <p className="text-[11px] text-slate-500 italic bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl">
                    "{member.notes}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. MANAGEMENT WEEKLY REPORT GENERATOR */}
      {activeTab === "report" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Executive Management Weekly Report
              </h2>
              <p className="text-xs text-slate-500">
                Formatted markdown summary for Abbay TV leadership. Includes broadcast deliverables, promo output, and team workload.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerateReport}
                disabled={isGeneratingReport}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingReport ? "animate-spin" : ""}`} />
                Regenerate Report
              </button>
              <button
                onClick={copyReportToClipboard}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
              >
                {copiedReport ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedReport ? "Copied to Clipboard!" : "Copy Markdown"}
              </button>
            </div>
          </div>

          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
            {reportMarkdown}
          </div>
        </div>
      )}

      {/* Team Member Modal */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              {editingMember?.id ? "Edit Team Member" : "Add Graphics Team Member"}
            </h2>
            <form onSubmit={handleSaveMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Artist Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingMember?.name || ""}
                  onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                  placeholder="e.g. Dani, Sura, Simon, Kiru, Bereket"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Role / Specialization *
                </label>
                <input
                  type="text"
                  required
                  value={editingMember?.role || ""}
                  onChange={(e) => setEditingMember({ ...editingMember, role: e.target.value })}
                  placeholder="e.g. Senior Motion Designer, 3D Artist, Video Editor"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Skills & Broadcast Deliverables
                </label>
                <input
                  type="text"
                  value={editingMember?.skills || ""}
                  onChange={(e) => setEditingMember({ ...editingMember, skills: e.target.value })}
                  placeholder="e.g. After Effects, Blender, Lower Thirds, Promos"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Weekly Capacity (Hours)
                  </label>
                  <input
                    type="number"
                    value={editingMember?.currentCapacityHours || 40}
                    onChange={(e) => setEditingMember({ ...editingMember, currentCapacityHours: parseFloat(e.target.value) || 40 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Status
                  </label>
                  <select
                    value={editingMember?.status || "available"}
                    onChange={(e) => setEditingMember({ ...editingMember, status: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="available">Available</option>
                    <option value="busy">Busy</option>
                    <option value="overloaded">Overloaded</option>
                    <option value="on_leave">On Leave</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Notes & Guidelines
                </label>
                <textarea
                  rows={2}
                  value={editingMember?.notes || ""}
                  onChange={(e) => setEditingMember({ ...editingMember, notes: e.target.value })}
                  placeholder="e.g. Needs dedicated rendering blocks for 3D deliverables..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsMemberModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm"
                >
                  Save Artist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
