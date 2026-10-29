"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ChatView } from "@/components/chat/ChatView";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { TasksView } from "@/components/tasks/TasksView";
import { AbbayTvView } from "@/components/workspaces/AbbayTvView";
import { PersonalProjectsView } from "@/components/workspaces/PersonalProjectsView";
import { GrowthView } from "@/components/growth/GrowthView";
import { SettingsView } from "@/components/settings/SettingsView";
import { TaskModal } from "@/components/tasks/TaskModal";
import { TaskItem, WorkspaceType } from "@/types";

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>("chat"); // Chat-first primary UX
  const [collapsed, setCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [providerConfig, setProviderConfig] = useState<any>(null);

  // Task Modal state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskModalInitial, setTaskModalInitial] = useState<Partial<TaskItem> | null>(null);
  const [taskModalDefaultWorkspace, setTaskModalDefaultWorkspace] = useState<WorkspaceType>("abbay_tv");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Initialize theme
  useEffect(() => {
    const savedTheme = localStorage.getItem("abbay_theme") as "dark" | "light" | null;
    const initialTheme = savedTheme || "dark";
    setTheme(initialTheme);
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const handleSetTheme = (newTheme: "dark" | "light") => {
    setTheme(newTheme);
    localStorage.setItem("abbay_theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Fetch provider config
  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.success) {
        setProviderConfig(data.config);
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleOpenTaskModal = (task?: Partial<TaskItem>, workspace?: WorkspaceType) => {
    setTaskModalInitial(task || null);
    if (workspace) setTaskModalDefaultWorkspace(workspace);
    else if (activeTab === "personal_projects") setTaskModalDefaultWorkspace("personal_projects");
    else setTaskModalDefaultWorkspace("abbay_tv");
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = async (taskData: Partial<TaskItem>) => {
    const isEdit = Boolean(taskData.id);
    const url = "/api/tasks";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(taskData),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || "Failed to save task");
    }

    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        theme={theme}
        setTheme={handleSetTheme}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header
          activeTab={activeTab}
          onOpenMobileMenu={() => setIsMobileOpen(true)}
          onOpenTaskModal={() => handleOpenTaskModal()}
          onNavigateTab={setActiveTab}
          isDemoMode={providerConfig?.isDemoMode ?? true}
          providerName={providerConfig?.activeProviderName || "Autonomous Engine"}
        />

        <main className="flex-1 overflow-hidden flex flex-col">
          {activeTab === "chat" && (
            <ChatView
              onRefreshData={() => setRefreshTrigger((prev) => prev + 1)}
              onOpenSettings={() => setActiveTab("settings")}
            />
          )}

          {activeTab === "dashboard" && (
            <DashboardView
              key={refreshTrigger}
              onOpenTaskModal={handleOpenTaskModal}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === "tasks" && (
            <TasksView key={refreshTrigger} onOpenTaskModal={handleOpenTaskModal} />
          )}

          {activeTab === "abbay_tv" && (
            <AbbayTvView
              key={refreshTrigger}
              onOpenTaskModal={handleOpenTaskModal}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === "personal_projects" && (
            <PersonalProjectsView
              key={refreshTrigger}
              onOpenTaskModal={handleOpenTaskModal}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === "growth" && <GrowthView key={refreshTrigger} />}

          {activeTab === "settings" && <SettingsView />}
        </main>
      </div>

      {/* Task Creation / Edit Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleSaveTask}
        initialTask={taskModalInitial}
        defaultWorkspace={taskModalDefaultWorkspace}
      />
    </div>
  );
}
