"use client";

import React from "react";
import {
  Menu,
  Plus,
  Sparkles,
  Search,
  Bell,
  Cpu,
  Tv,
  TrendingUp,
  Award,
} from "lucide-react";

interface HeaderProps {
  activeTab: string;
  onOpenMobileMenu: () => void;
  onOpenTaskModal: () => void;
  onNavigateTab: (tab: string) => void;
  isDemoMode: boolean;
  providerName: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenMobileMenu,
  onOpenTaskModal,
  onNavigateTab,
  isDemoMode,
  providerName,
}) => {
  const titles: Record<string, { title: string; subtitle: string; icon: any }> = {
    chat: {
      title: "AI Assistant",
      subtitle: "Conversational Command Center",
      icon: Sparkles,
    },
    dashboard: {
      title: "Command Dashboard",
      subtitle: "Overview, deadlines, metrics",
      icon: null,
    },
    tasks: {
      title: "Deliverables & Tasks",
      subtitle: "Master multi-workspace registry",
      icon: null,
    },
    abbay_tv: {
      title: "Abbay TV Graphics Department",
      subtitle: "Team workload, promos, lower thirds & broadcast reports",
      icon: Tv,
    },
    personal_projects: {
      title: "Personal Projects & Ambitions",
      subtitle: "YouTube masterclass, motion presets & AI pipelines",
      icon: TrendingUp,
    },
    growth: {
      title: "Growth & Accomplishments",
      subtitle: "Major milestones, deliverable breakthroughs, progress updates, and career growth",
      icon: Award,
    },
    settings: {
      title: "System Settings",
      subtitle: "AI models, API keys, and database backups",
      icon: null,
    },
  };

  const current = titles[activeTab] || {
    title: "Command Center",
    subtitle: "Personal AI Workspace",
    icon: null,
  };

  return (
    <header className="h-16 px-4 md:px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {current.title}
          </h2>
          <p className="text-[11px] text-slate-500 hidden sm:block">{current.subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* AI Provider Status Pill */}
        <button
          onClick={() => onNavigateTab("settings")}
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 transition ${
            isDemoMode
              ? "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700 hover:bg-amber-100"
              : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isDemoMode ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
            }`}
          />
          <span className="hidden sm:inline">
            {isDemoMode ? "Demo Mode (Autonomous)" : providerName}
          </span>
          <span className="sm:hidden">{isDemoMode ? "Demo" : "AI"}</span>
        </button>

        {/* Global New Task Button */}
        <button
          onClick={onOpenTaskModal}
          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition shadow-sm flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Task</span>
        </button>
      </div>
    </header>
  );
};
