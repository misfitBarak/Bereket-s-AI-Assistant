"use client";

import React, { useState, useEffect } from "react";
import {
  Award,
  Plus,
  Search,
  Filter,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  Tv,
  Briefcase,
  Target,
  Clock,
  Trash2,
  RefreshCw,
  Zap,
  ArrowUpRight,
  History,
  Layers,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface AccomplishmentItem {
  id: string;
  title: string;
  description?: string | null;
  category: "abbay_tv" | "personal_projects" | "career";
  type: "milestone" | "deliverable" | "revenue" | "breakthrough";
  metric?: string | null;
  impact: "medium" | "high" | "major" | "breakthrough";
  achievedAt: string;
  isDerived?: boolean;
}

export const GrowthView: React.FC = () => {
  const [accomplishments, setAccomplishments] = useState<AccomplishmentItem[]>([]);
  const [metrics, setMetrics] = useState({
    totalAccomplishments: 0,
    totalCompletedDeliverables: 0,
    totalProjectsCompleted: 0,
    totalClientRevenue: 0,
    majorBreakthroughsCount: 0,
  });
  const [progressTimeline, setProgressTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "timeline">("cards");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState<"abbay_tv" | "personal_projects" | "career">("abbay_tv");
  const [newType, setNewType] = useState<"milestone" | "deliverable" | "revenue" | "breakthrough">("milestone");
  const [newMetric, setNewMetric] = useState("");
  const [newImpact, setNewImpact] = useState<"medium" | "high" | "major" | "breakthrough">("high");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchGrowthData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      if (search.trim()) params.append("search", search.trim());

      const res = await fetch(`/api/growth?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setAccomplishments(data.accomplishments || []);
        setMetrics(
          data.metrics || {
            totalAccomplishments: 0,
            totalCompletedDeliverables: 0,
            totalProjectsCompleted: 0,
            totalClientRevenue: 0,
            majorBreakthroughsCount: 0,
          }
        );
        setProgressTimeline(data.progressTimeline || []);
      }
    } catch (err) {
      console.error("Failed to load growth & achievements:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrowthData();
  }, [selectedCategory, search]);

  const handleCreateAccomplishment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setIsSubmitting(true);
      await fetch("/api/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || null,
          category: newCategory,
          type: newType,
          metric: newMetric.trim() || null,
          impact: newImpact,
          achievedAt: new Date(newDate).toISOString(),
        }),
      });

      setIsModalOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewMetric("");
      fetchGrowthData();
    } catch (err) {
      console.error("Failed to save accomplishment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccomplishment = async (item: AccomplishmentItem) => {
    if (item.isDerived) {
      alert("This accomplishment is synced with a completed task/project. Manage it directly from its workspace board.");
      return;
    }
    if (!confirm(`Remove accomplishment "${item.title}"?`)) return;

    try {
      await fetch(`/api/growth?id=${item.id}`, { method: "DELETE" });
      fetchGrowthData();
    } catch (err) {
      console.error("Failed to delete accomplishment:", err);
    }
  };

  const categories = [
    { id: "all", label: "All Sectors" },
    { id: "abbay_tv", label: "Abbay TV Graphics" },
    { id: "personal_projects", label: "Personal Ambitions" },
    { id: "career", label: "Career Milestones" },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-sm">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Growth & Accomplishments
            </h1>
            <p className="text-xs text-slate-500">
              Live progress tracking, deliverable breakthroughs, milestones, and what changed across your command center.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-100 dark:bg-slate-800">
            <button
              onClick={() => setViewMode("cards")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === "cards"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Milestones
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                viewMode === "timeline"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <History className="w-3 h-3" /> What Changed
            </button>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs transition shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Record Accomplishment
          </button>
          <button
            onClick={fetchGrowthData}
            title="Refresh growth records"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Growth Metric Spotlight */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Major Breakthroughs</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {metrics.majorBreakthroughsCount}{" "}
            <span className="text-xs font-normal text-slate-500">breakthroughs</span>
          </div>
          <span className="text-xs text-amber-600 dark:text-amber-400 mt-1 block">High-impact milestones</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Completed Deliverables</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {metrics.totalCompletedDeliverables}{" "}
            <span className="text-xs font-normal text-slate-500">broadcast deliverables</span>
          </div>
          <span className="text-xs text-blue-600 dark:text-blue-400 mt-1 block">Promos, media packs & idents</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Projects Completed</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {metrics.totalProjectsCompleted}{" "}
            <span className="text-xs font-normal text-slate-500">finished campaigns</span>
          </div>
          <span className="text-xs text-purple-600 dark:text-purple-400 mt-1 block">TV shows & personal assets</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Logged Milestones</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {accomplishments.length}{" "}
            <span className="text-xs font-normal text-slate-500">recorded</span>
          </div>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 block">Team & career achievements</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                selectedCategory === c.id
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accomplishments..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-16 text-center text-slate-500 flex items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
          <span>Analyzing command center achievements & progress updates...</span>
        </div>
      ) : accomplishments.length === 0 ? (
        /* Empty State */
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-500 flex items-center justify-center mx-auto">
            <Award className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              No accomplishments or progress recorded yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              As you deliver Abbay TV broadcasts, coordinate team deliverables, and advance your personal masterclass projects, your achievements and growth timeline will automatically compile here.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs transition shadow-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Record First Milestone
          </button>
        </div>
      ) : viewMode === "cards" ? (
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accomplishments.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs hover:border-amber-300 dark:hover:border-amber-700 transition flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                      item.category === "abbay_tv"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        : item.category === "personal_projects"
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    }`}
                  >
                    {item.category.replace("_", " ")}
                  </span>

                  <span
                    className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      item.impact === "breakthrough" || item.impact === "major"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {item.impact}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                  {item.title}
                </h3>

                {item.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                    {item.description}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatDate(item.achievedAt)}</span>
                </div>

                {item.metric && (
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-[11px] bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">
                    {item.metric}
                  </span>
                )}

                {!item.isDerived && (
                  <button
                    onClick={() => handleDeleteAccomplishment(item)}
                    title="Delete milestone"
                    className="p-1 text-slate-400 hover:text-red-500 rounded transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Timeline "What Changed" Stream */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <History className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Progress Changelog & Major Updates
            </h2>
          </div>

          <div className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-800 space-y-6">
            {progressTimeline.map((item) => (
              <div key={item.id} className="relative group">
                <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-amber-500 border-2 border-white dark:border-slate-900" />
                <div className="text-xs text-slate-400 mb-0.5">{formatDate(item.date)}</div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {item.title}
                </h4>
                {item.detail && (
                  <p className="text-xs text-slate-500 mt-1">{item.detail}</p>
                )}
                {item.metric && (
                  <span className="inline-block mt-2 font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-600">
                    {item.metric}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Record Accomplishment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" /> Record Major Accomplishment
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateAccomplishment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Accomplishment Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Delivered Station Prime-Time Rebrand Package"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Sector / Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e: any) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="abbay_tv">Abbay TV Graphics</option>
                    <option value="personal_projects">Personal Ambitions</option>
                    <option value="career">Career Milestone</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Impact Level
                  </label>
                  <select
                    value={newImpact}
                    onChange={(e: any) => setNewImpact(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="medium">Medium Impact</option>
                    <option value="high">High Impact</option>
                    <option value="major">Major Milestone</option>
                    <option value="breakthrough">Career Breakthrough</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Key Metric / Outcome
                  </label>
                  <input
                    type="text"
                    value={newMetric}
                    onChange={(e) => setNewMetric(e.target.value)}
                    placeholder="e.g. 100% Broadcast Safe / +50,000 ETB"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Date Achieved
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Description & Context
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Details of the deliverable breakthrough, management sign-off, or milestone significance..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition"
                >
                  {isSubmitting ? "Recording..." : "Save Accomplishment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
