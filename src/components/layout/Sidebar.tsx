"use client";

import React from "react";
import {
  MessageSquare,
  LayoutDashboard,
  CheckSquare,
  Tv,
  Briefcase,
  TrendingUp,
  Brain,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Sparkles,
  Users,
} from "lucide-react";
import { WorkspaceType } from "@/types";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  collapsed,
  setCollapsed,
  theme,
  setTheme,
  isMobileOpen,
  setIsMobileOpen,
}) => {
  const navItems = [
    {
      id: "chat",
      label: "AI Assistant",
      icon: MessageSquare,
      badge: "AI",
      color: "text-blue-500",
    },
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      color: "text-slate-500",
    },
    {
      id: "tasks",
      label: "All Deliverables",
      icon: CheckSquare,
      color: "text-indigo-500",
    },
    {
      id: "abbay_tv",
      label: "Abbay TV Graphics",
      icon: Tv,
      color: "text-blue-600",
      pill: "TV",
    },
    {
      id: "client_work",
      label: "Client Work",
      icon: Briefcase,
      color: "text-emerald-500",
      pill: "Clients",
    },
    {
      id: "personal_projects",
      label: "Personal Projects",
      icon: TrendingUp,
      color: "text-purple-500",
      pill: "Personal",
    },
    {
      id: "memories",
      label: "Personal Memory",
      icon: Brain,
      color: "text-pink-500",
    },
    {
      id: "settings",
      label: "Settings & AI",
      icon: Settings,
      color: "text-slate-500",
    },
  ];

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    if (isMobileOpen) setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 ${
          collapsed ? "w-20" : "w-64"
        } ${isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Brand / Title Header */}
        <div className="h-16 px-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-sm">
              A
            </div>
            {!collapsed && (
              <div className="leading-tight truncate">
                <span className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight block">
                  Command Center
                </span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider block">
                  Abbay TV Lead
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Workspaces Group */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
          {!collapsed && (
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Workspaces & Navigation
            </div>
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? "text-white" : item.color
                  }`}
                />
                {!collapsed && (
                  <span className="truncate flex-1 text-left">{item.label}</span>
                )}
                {!collapsed && item.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                      isActive ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* User Profile & Theme Toggle Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-2 text-xs w-full"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  {!collapsed && <span>Light Mode</span>}
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-500" />
                  {!collapsed && <span>Dark Mode</span>}
                </>
              )}
            </button>
          </div>

          {!collapsed ? (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                  Ab
                </div>
                <div className="truncate text-left leading-tight">
                  <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                    Abbay
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    Graphics Lead
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0" title="Active">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
            </div>
          ) : (
            <div
              title="Abbay (Graphics Lead)"
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center w-full"
            >
              <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                Ab
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
