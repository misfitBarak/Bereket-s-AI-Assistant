"use client";

import React, { useState, useEffect } from "react";
import {
  Briefcase,
  Plus,
  Eye,
  EyeOff,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  User,
  Phone,
  FileText,
  AlertCircle,
  Tag,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { ProjectItem, TaskItem } from "@/types";
import { formatDate, formatCurrency } from "@/lib/utils";

interface ClientWorkViewProps {
  onOpenTaskModal: (task?: Partial<TaskItem>, workspace?: "client_work") => void;
  onNavigateTab: (tab: string) => void;
}

export const ClientWorkView: React.FC<ClientWorkViewProps> = ({
  onOpenTaskModal,
  onNavigateTab,
}) => {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideFinancials, setHideFinancials] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);

  // New project state
  const [newTitle, setNewTitle] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientContact, setNewClientContact] = useState("");
  const [newQuotedAmount, setNewQuotedAmount] = useState("");
  const [newClientNotes, setNewClientNotes] = useState("");
  const [newTargetDate, setNewTargetDate] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const [projRes, tasksRes] = await Promise.all([
        fetch("/api/projects?workspace=client_work"),
        fetch("/api/tasks?workspace=client_work"),
      ]);
      const projData = await projRes.json();
      const tasksData = await tasksRes.json();

      if (projData.success) setProjects(projData.projects);
      if (tasksData.success) setTasks(tasksData.tasks);
    } catch (err) {
      console.error("Failed to load client work:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newClientName.trim()) return;

    try {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          workspace: "client_work",
          clientName: newClientName.trim(),
          clientContact: newClientContact.trim() || null,
          clientNotes: newClientNotes.trim() || null,
          quotedAmount: parseFloat(newQuotedAmount) || 0,
          paidAmount: 0,
          currency: "ETB",
          invoiceStatus: "pending",
          targetDate: newTargetDate ? new Date(newTargetDate).toISOString() : null,
          status: "active",
        }),
      });

      setIsNewProjectModalOpen(false);
      setNewTitle("");
      setNewClientName("");
      setNewClientContact("");
      setNewQuotedAmount("");
      setNewClientNotes("");
      setNewTargetDate("");
      fetchData();
    } catch (err) {
      console.error("Failed to create project:", err);
    }
  };

  const totalQuoted = projects.reduce((acc, p) => acc + (p.quotedAmount || 0), 0);
  const totalPaid = projects.reduce((acc, p) => acc + (p.paidAmount || 0), 0);
  const pendingBalance = totalQuoted - totalPaid;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Freelance & Client Work
            </h1>
            <p className="text-xs text-slate-500">
              Deliverables, revision cycles, client brand guidelines, and private financial tracking.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setHideFinancials(!hideFinancials)}
            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5 text-slate-700 dark:text-slate-300"
            title="Toggle financial numbers when screen sharing"
          >
            {hideFinancials ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {hideFinancials ? "Show Financials" : "Hide Financials"}
          </button>
          <button
            onClick={() => onOpenTaskModal(undefined, "client_work")}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add Client Task
          </button>
          <button
            onClick={() => setIsNewProjectModalOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs font-medium transition"
          >
            New Client Project
          </button>
        </div>
      </div>

      {/* Financial Pipeline Snapshot */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Quoted Scope
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {hideFinancials ? "••••••••" : formatCurrency(totalQuoted, "ETB")}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">Across {projects.length} client projects</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Deposits & Paid Invoices
          </span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {hideFinancials ? "••••••••" : formatCurrency(totalPaid, "ETB")}
          </div>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 block">Remitted to account</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Pending Balance Due
          </span>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {hideFinancials ? "••••••••" : formatCurrency(pendingBalance, "ETB")}
          </div>
          <span className="text-xs text-amber-600 dark:text-amber-400 mt-1 block">Upon delivery sign-off</span>
        </div>
      </div>

      {/* Projects List */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Active Client Projects</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {projects.map((proj) => {
            const projectTasks = tasks.filter((t) => t.projectId === proj.id);
            let parsedMilestones: any[] = [];
            if (proj.milestones) {
              try {
                parsedMilestones = JSON.parse(proj.milestones);
              } catch {
                parsedMilestones = [];
              }
            }

            return (
              <div
                key={proj.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {proj.clientName}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="text-xs text-slate-500 uppercase tracking-wider">
                        {proj.category || "Commercial Campaign"}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {proj.title}
                    </h3>
                  </div>

                  <span
                    className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                      proj.status === "in_review"
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    }`}
                  >
                    {proj.status.replace("_", " ")}
                  </span>
                </div>

                {proj.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {proj.description}
                  </p>
                )}

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Milestone Progress:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {proj.progress}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                      style={{ width: `${proj.progress}%` }}
                    />
                  </div>
                </div>

                {/* Milestones checklist */}
                {parsedMilestones.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Project Milestones:
                    </span>
                    <div className="space-y-1.5">
                      {parsedMilestones.map((m: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <CheckCircle2
                            className={`w-3.5 h-3.5 ${
                              m.completed ? "text-emerald-600" : "text-slate-300 dark:text-slate-600"
                            }`}
                          />
                          <span
                            className={
                              m.completed
                                ? "line-through text-slate-400"
                                : "text-slate-700 dark:text-slate-300"
                            }
                          >
                            {m.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Technical Preferences & Client Rules */}
                {proj.clientNotes && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs space-y-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                      📌 Client Preferences & Delivery Rules:
                    </span>
                    <p className="text-slate-600 dark:text-slate-400 italic">
                      {proj.clientNotes}
                    </p>
                  </div>
                )}

                {/* Financial bar & actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Contract Value:
                    </span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {hideFinancials
                        ? "••••••••"
                        : `${formatCurrency(proj.quotedAmount, proj.currency || "ETB")} (Paid: ${formatCurrency(proj.paidAmount, proj.currency || "ETB")})`}
                    </span>
                  </div>

                  <button
                    onClick={() => onOpenTaskModal({ projectId: proj.id }, "client_work")}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 font-semibold transition"
                  >
                    + Add Task
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* New Project Modal */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              Add New Client Project
            </h2>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Project Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. 60s TV Commercial / Brand Launch"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="e.g. EthioTelecom"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Quoted Amount (ETB)
                  </label>
                  <input
                    type="number"
                    value={newQuotedAmount}
                    onChange={(e) => setNewQuotedAmount(e.target.value)}
                    placeholder="75000"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Client Contact / Email
                </label>
                <input
                  type="text"
                  value={newClientContact}
                  onChange={(e) => setNewClientContact(e.target.value)}
                  placeholder="Abebe (Lead Marketing) - abebe@agency.et"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Client Delivery Preferences & Technical Rules
                </label>
                <textarea
                  rows={3}
                  value={newClientNotes}
                  onChange={(e) => setNewClientNotes(e.target.value)}
                  placeholder="Brand color codes, DaVinci Resolve delivery format, max 3 revision rounds..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsNewProjectModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
