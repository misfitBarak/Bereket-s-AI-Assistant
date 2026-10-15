"use client";

import React, { useState, useEffect } from "react";
import {
  Brain,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Tag,
  Star,
  CheckCircle2,
  X,
  RefreshCw,
  Sliders,
} from "lucide-react";
import { MemoryItem } from "@/types";

export const MemoryView: React.FC = () => {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Partial<MemoryItem> | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<any>("general_notes");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [importance, setImportance] = useState(3);
  const [isSaving, setIsSaving] = useState(false);

  const fetchMemories = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      if (search.trim()) params.append("search", search.trim());

      const res = await fetch(`/api/memories?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setMemories(data.memories);
      }
    } catch (err) {
      console.error("Failed to load memories:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, [selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMemories();
  };

  const handleOpenModal = (mem?: MemoryItem) => {
    if (mem) {
      setEditingMemory(mem);
      setTitle(mem.title);
      setCategory(mem.category);
      setContent(mem.content);
      setTags(mem.tags || "");
      setImportance(mem.importance || 3);
    } else {
      setEditingMemory(null);
      setTitle("");
      setCategory("general_notes");
      setContent("");
      setTags("");
      setImportance(3);
    }
    setIsModalOpen(true);
  };

  const handleSaveMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setIsSaving(true);
    try {
      if (editingMemory?.id) {
        await fetch("/api/memories", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingMemory.id,
            title: title.trim(),
            category,
            content: content.trim(),
            tags: tags.trim() || null,
            importance,
          }),
        });
      } else {
        await fetch("/api/memories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            category,
            content: content.trim(),
            tags: tags.trim() || null,
            importance,
            source: "user_explicit",
          }),
        });
      }
      setIsModalOpen(false);
      fetchMemories();
    } catch (err) {
      console.error("Failed to save memory:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMemory = async (mem: MemoryItem) => {
    if (!confirm(`Are you sure you want to permanently delete memory "${mem.title}"?`)) return;
    try {
      await fetch(`/api/memories?id=${mem.id}`, { method: "DELETE" });
      fetchMemories();
    } catch (err) {
      console.error("Failed to delete memory:", err);
    }
  };

  const categories = [
    { id: "all", label: "All Categories" },
    { id: "role_responsibilities", label: "Role & Leadership" },
    { id: "team_profiles", label: "Team Strengths" },
    { id: "client_preferences", label: "Client Preferences" },
    { id: "decisions", label: "Planning Decisions" },
    { id: "workflows", label: "Broadcast Standards & Workflows" },
    { id: "long_term_goals", label: "Long-term Goals" },
    { id: "general_notes", label: "General Notes" },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Personal Memory System
            </h1>
            <p className="text-xs text-slate-500">
              Persistent, inspectable repository of your leadership guidelines, team dynamics, client rules, and decisions.
            </p>
          </div>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition shadow-sm flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add Memory
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search memories, rules, client preferences, or past decisions..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                selectedCategory === cat.id
                  ? "bg-indigo-600 text-white shadow-xs font-bold"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Memories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-12 text-center text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Retrieving stored memories...</span>
          </div>
        ) : memories.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            No memories found matching this query.
          </div>
        ) : (
          memories.map((mem) => (
            <div
              key={mem.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs flex flex-col justify-between hover:border-indigo-400 dark:hover:border-indigo-600 transition group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                    {mem.category.replace("_", " ")}
                  </span>
                  <div className="flex items-center gap-0.5 text-amber-500">
                    {Array.from({ length: mem.importance || 3 }).map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                </div>

                <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-2">
                  {mem.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed line-clamp-6">
                  {mem.content}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span className="text-[10px] truncate max-w-[150px]">
                  {mem.tags ? `#${mem.tags.split(",").join(" #")}` : "Direct Stored"}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenModal(mem)}
                    title="Edit memory"
                    className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteMemory(mem)}
                    title="Delete memory"
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Memory Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {editingMemory ? "Edit Stored Memory" : "Create New Memory"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMemory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Memory Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Abbay TV Broadcast Color Safe Margin Rules"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="role_responsibilities">Role & Responsibilities</option>
                    <option value="team_profiles">Team Profiles & Strengths</option>
                    <option value="client_preferences">Client Preferences</option>
                    <option value="decisions">Decisions</option>
                    <option value="workflows">Workflows & Standards</option>
                    <option value="long_term_goals">Long-term Goals</option>
                    <option value="general_notes">General Notes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Importance Level (1-5)
                  </label>
                  <select
                    value={importance}
                    onChange={(e) => setImportance(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    <option value={1}>1 - Low</option>
                    <option value={2}>2 - Minor</option>
                    <option value={3}>3 - Standard</option>
                    <option value={4}>4 - High</option>
                    <option value={5}>5 - Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Knowledge / Content *
                </label>
                <textarea
                  rows={4}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="State the facts, standards, decisions, or preferences clearly. The assistant will reference this verbatim."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Tags (Comma separated)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="Broadcast, DaVinci, Standard, MMA"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm"
                >
                  {isSaving ? "Saving..." : "Save Memory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
