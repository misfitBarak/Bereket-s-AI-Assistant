"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Plus,
  Target,
  CheckCircle2,
  Calendar,
  Sparkles,
  Youtube,
  Cpu,
  Bookmark,
  ArrowRight,
  Clock,
  Layers,
  ChevronRight,
} from "lucide-react";
import { ProjectItem, TaskItem } from "@/types";
import { formatDate } from "@/lib/utils";

interface PersonalProjectsViewProps {
  onOpenTaskModal: (task?: Partial<TaskItem>, workspace?: "personal_projects") => void;
  onNavigateTab: (tab: string) => void;
}

export const PersonalProjectsView: React.FC<PersonalProjectsViewProps> = ({
  onOpenTaskModal,
  onNavigateTab,
}) => {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [projRes, tasksRes] = await Promise.all([
        fetch("/api/projects?workspace=personal_projects"),
        fetch("/api/tasks?workspace=personal_projects"),
      ]);
      const projData = await projRes.json();
      const tasksData = await tasksRes.json();

      if (projData.success) setProjects(projData.projects);
      if (tasksData.success) setTasks(tasksData.tasks);
    } catch (err) {
      console.error("Failed to load personal projects:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Personal Projects & Long-Term Ambitions
            </h1>
            <p className="text-xs text-slate-500">
              Content creation, YouTube video masterclasses, motion graphics preset packs, AI automation pipelines, and digital income ventures.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenTaskModal(undefined, "personal_projects")}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs transition shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Personal Task
          </button>
        </div>
      </div>

      {/* Strategic Vision Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-purple-600">
            <Youtube className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Educational Brand</span>
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            DaVinci Resolve & Motion Masterclass
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Position Bereket as the premier Ethiopian broadcast motion designer. Publish structured video courses & tutorials.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-indigo-600">
            <Cpu className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">AI Broadcast Tools</span>
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Automated Social Cutdown Pipeline
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Leverage local Whisper & automated video formatting to cut down 30min TV talk shows into 9:16 viral reels in minutes.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-emerald-600">
            <Target className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Passive Assets</span>
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Broadcast Preset & LUT Pack
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Export ready-to-use Fusion motion presets, lower thirds, and Amharic typography styles for video creators across Africa.
          </p>
        </div>
      </div>

      {/* Projects and Milestones List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Active Personal Ventures
          </h2>
          <span className="text-xs text-slate-500">{projects.length} trackable projects</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {projects.map((proj) => {
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
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs space-y-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                      {proj.category || "Long-Term Goal"}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                      {proj.title}
                    </h3>
                  </div>

                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                    {proj.progress}% Done
                  </span>
                </div>

                {proj.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {proj.description}
                  </p>
                )}

                {/* Next Action Spotlight */}
                {proj.nextAction && (
                  <div className="p-3.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 rounded-xl text-xs space-y-1">
                    <span className="font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> High-Impact Next Action:
                    </span>
                    <p className="text-purple-800 dark:text-purple-300 font-medium">
                      {proj.nextAction}
                    </p>
                  </div>
                )}

                {/* Milestones checklist */}
                {parsedMilestones.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Milestone Progression:
                    </span>
                    <div className="space-y-2">
                      {parsedMilestones.map((m: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <CheckCircle2
                            className={`w-3.5 h-3.5 shrink-0 ${
                              m.completed ? "text-purple-600" : "text-slate-300 dark:text-slate-600"
                            }`}
                          />
                          <span
                            className={
                              m.completed
                                ? "line-through text-slate-400"
                                : "text-slate-700 dark:text-slate-300 font-medium"
                            }
                          >
                            {m.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Target: {formatDate(proj.targetDate)}
                  </span>
                  <button
                    onClick={() => onOpenTaskModal({ projectId: proj.id }, "personal_projects")}
                    className="px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-semibold hover:bg-purple-100 transition"
                  >
                    + Add Task
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
