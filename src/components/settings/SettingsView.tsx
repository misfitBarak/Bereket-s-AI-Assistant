"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Cpu,
  Key,
  ShieldCheck,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Eye,
  EyeOff,
  Sparkles,
  Server,
  RefreshCw,
  Send,
  Lock,
  User,
  Phone,
  Trash2,
  Plus,
  MessageSquare,
  Terminal,
} from "lucide-react";
import { AIProviderConfig } from "@/types";

export const SettingsView: React.FC = () => {
  const [config, setConfig] = useState<AIProviderConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Form inputs
  const [provider, setProvider] = useState<string>("auto");
  const [geminiKey, setGeminiKey] = useState("");
  const [openAIKey, setOpenAIKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://localhost:11434");

  // Telegram inputs
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramAllowedUserId, setTelegramAllowedUserId] = useState("");
  const [telegramWebhookSecret, setTelegramWebhookSecret] = useState("");

  // Show/Hide key toggles
  const [showKeys, setShowKeys] = useState(false);

  // Personal Telegram state
  const [personalPhone, setPersonalPhone] = useState("");
  const [personalApiId, setPersonalApiId] = useState("");
  const [personalApiHash, setPersonalApiHash] = useState("");
  const [personalCode, setPersonalCode] = useState("");
  const [personalPassword, setPersonalPassword] = useState("");
  const [phoneCodeHash, setPhoneCodeHash] = useState("");
  const [personalAuthStep, setPersonalAuthStep] = useState<"phone" | "code" | "2fa">("phone");
  const [personalLoading, setPersonalLoading] = useState(false);
  const [personalMsg, setPersonalMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Contact Aliases
  const [contactAliases, setContactAliases] = useState<Record<string, string>>({});
  const [newAliasKey, setNewAliasKey] = useState("");
  const [newAliasValue, setNewAliasValue] = useState("");

  const fetchPersonalStatus = async () => {
    try {
      const res = await fetch("/api/telegram/personal");
      const data = await res.json();
      if (data.success && data.aliases) {
        setContactAliases(data.aliases);
      }
    } catch {}
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
        setProvider(data.config.provider);
        setOllamaBaseUrl(data.config.ollamaBaseUrl || "http://localhost:11434");
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchPersonalStatus();
  }, []);

  const handleStartPersonalLogin = async () => {
    if (!personalPhone.trim()) {
      setPersonalMsg({ text: "Please enter your phone number with country code.", type: "error" });
      return;
    }
    setPersonalLoading(true);
    setPersonalMsg(null);
    try {
      const res = await fetch("/api/telegram/personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start_login",
          phoneNumber: personalPhone.trim(),
          apiId: personalApiId.trim() || undefined,
          apiHash: personalApiHash.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.phoneCodeHash) {
        setPhoneCodeHash(data.phoneCodeHash);
        setPersonalAuthStep("code");
        setPersonalMsg({ text: "Verification code sent to your Telegram app!", type: "success" });
      } else {
        setPersonalMsg({ text: data.error || "Failed to send verification code", type: "error" });
      }
    } catch (err: any) {
      setPersonalMsg({ text: err.message, type: "error" });
    } finally {
      setPersonalLoading(false);
    }
  };

  const handleCompletePersonalLogin = async () => {
    if (!personalCode.trim()) {
      setPersonalMsg({ text: "Please enter the verification code.", type: "error" });
      return;
    }
    setPersonalLoading(true);
    setPersonalMsg(null);
    try {
      const res = await fetch("/api/telegram/personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete_login",
          phoneNumber: personalPhone.trim(),
          phoneCodeHash,
          code: personalCode.trim(),
          password: personalPassword.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPersonalMsg({ text: `Authenticated successfully as ${data.user?.firstName || "you"}!`, type: "success" });
        setPersonalAuthStep("phone");
        setPersonalCode("");
        setPersonalPassword("");
        fetchSettings();
        fetchPersonalStatus();
      } else if (data.requiresPassword) {
        setPersonalAuthStep("2fa");
        setPersonalMsg({ text: data.error || "Two-step verification (2FA) password required.", type: "error" });
      } else {
        setPersonalMsg({ text: data.error || "Login failed", type: "error" });
      }
    } catch (err: any) {
      setPersonalMsg({ text: err.message, type: "error" });
    } finally {
      setPersonalLoading(false);
    }
  };

  const handleDisconnectPersonal = async () => {
    if (!confirm("Are you sure you want to disconnect your personal Telegram account?")) return;
    setPersonalLoading(true);
    try {
      await fetch("/api/telegram/personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      setPersonalMsg({ text: "Personal Telegram account disconnected.", type: "success" });
      fetchSettings();
    } catch (err: any) {
      setPersonalMsg({ text: err.message, type: "error" });
    } finally {
      setPersonalLoading(false);
    }
  };

  const handleAddAlias = async () => {
    if (!newAliasKey.trim() || !newAliasValue.trim()) return;
    try {
      const res = await fetch("/api/telegram/personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_alias",
          alias: newAliasKey.trim(),
          contactName: newAliasValue.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setContactAliases((prev) => ({ ...prev, [newAliasKey.trim().toLowerCase()]: newAliasValue.trim() }));
        setNewAliasKey("");
        setNewAliasValue("");
      }
    } catch {}
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const payload: any = { provider, ollamaBaseUrl };
      if (geminiKey.trim()) payload.geminiKey = geminiKey.trim();
      if (openAIKey.trim()) payload.openAIKey = openAIKey.trim();
      if (anthropicKey.trim()) payload.anthropicKey = anthropicKey.trim();
      if (groqKey.trim()) payload.groqKey = groqKey.trim();
      if (telegramToken.trim()) payload.telegramToken = telegramToken.trim();
      if (telegramAllowedUserId.trim()) payload.telegramAllowedUserId = telegramAllowedUserId.trim();
      if (telegramWebhookSecret.trim()) payload.telegramWebhookSecret = telegramWebhookSecret.trim();

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: "Settings updated successfully!", type: "success" });
        setGeminiKey("");
        setOpenAIKey("");
        setAnthropicKey("");
        setGroqKey("");
        setTelegramToken("");
        setTelegramAllowedUserId("");
        setTelegramWebhookSecret("");
        fetchSettings();
      } else {
        setMessage({ text: data.error || "Failed to save settings", type: "error" });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleExportBackup = () => {
    window.location.href = "/api/export";
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!confirm("Restoring this backup will replace current data. Continue?")) return;

        const res = await fetch("/api/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "restore", backupData: json }),
        });
        const data = await res.json();
        if (data.success) {
          alert("Backup successfully restored!");
          window.location.reload();
        } else {
          alert("Restore failed: " + data.error);
        }
      } catch (err: any) {
        alert("Invalid backup file: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleResetSeed = async () => {
    if (
      !confirm(
        "Reset and re-seed database with default Abbay TV Graphics Department, client projects, and memories?"
      )
    )
      return;

    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_seed" }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        window.location.reload();
      }
    } catch (err) {
      console.error("Failed to reset:", err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow-sm">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              System Settings & AI Configuration
            </h1>
            <p className="text-xs text-slate-500">
              Configure language models, external API providers, data backups, and security settings.
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* AI Provider Status Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              AI Engine & Language Model Integration
            </h2>
          </div>

          {config?.isDemoMode ? (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Demo Mode Active (Autonomous Engine)
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              External AI Connected: {config?.activeProviderName}
            </span>
          )}
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          The assistant connects to external cloud providers (Google Gemini, OpenAI GPT-4o, Anthropic Claude, Groq) or runs locally in <strong>Intelligent Autonomous Engine mode</strong>. In Autonomous mode, it executes real tool calls, parses department workloads, and manages database state without requiring external API keys.
        </p>

        <form onSubmit={handleSaveSettings} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Active Provider Selection
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              >
                <option value="auto">Auto-Detect (Use any available key)</option>
                <option value="gemini">Google Gemini (Recommended - Fast & Function Calling)</option>
                <option value="openai">OpenAI (GPT-4o)</option>
                <option value="groq">Groq (Ultra-fast Llama 3.3)</option>
                <option value="anthropic">Anthropic Claude (Claude 3.5)</option>
                <option value="demo">Autonomous Local Engine (No Key Required)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Local Ollama Base URL
              </label>
              <input
                type="text"
                value={ollamaBaseUrl}
                onChange={(e) => setOllamaBaseUrl(e.target.value)}
                placeholder="http://localhost:11434"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Provider API Keys
            </span>
            <button
              type="button"
              onClick={() => setShowKeys(!showKeys)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              {showKeys ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showKeys ? "Hide Key Fields" : "Show Key Fields"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Google Gemini API Key
                </label>
                {config?.hasGeminiKey && (
                  <span className="text-[10px] text-emerald-600 font-semibold">Configured</span>
                )}
              </div>
              <input
                type={showKeys ? "text" : "password"}
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder={config?.hasGeminiKey ? "••••••••••••••••••••••••" : "Paste AIzaSy..."}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  OpenAI API Key
                </label>
                {config?.hasOpenAIKey && (
                  <span className="text-[10px] text-emerald-600 font-semibold">Configured</span>
                )}
              </div>
              <input
                type={showKeys ? "text" : "password"}
                value={openAIKey}
                onChange={(e) => setOpenAIKey(e.target.value)}
                placeholder={config?.hasOpenAIKey ? "••••••••••••••••••••••••" : "Paste sk-..."}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Groq API Key
                </label>
                {config?.hasGroqKey && (
                  <span className="text-[10px] text-emerald-600 font-semibold">Configured</span>
                )}
              </div>
              <input
                type={showKeys ? "text" : "password"}
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
                placeholder={config?.hasGroqKey ? "••••••••••••••••••••••••" : "Paste gsk_..."}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Anthropic API Key
                </label>
                {config?.hasAnthropicKey && (
                  <span className="text-[10px] text-emerald-600 font-semibold">Configured</span>
                )}
              </div>
              <input
                type={showKeys ? "text" : "password"}
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder={config?.hasAnthropicKey ? "••••••••••••••••••••••••" : "Paste sk-ant-..."}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-end pt-3">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition shadow-sm"
            >
              {saving ? "Saving..." : "Save AI Settings"}
            </button>
          </div>
        </form>
      </div>

      {/* Telegram Bot Integration Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-sky-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Telegram Bot Integration
            </h2>
          </div>
          {config?.telegram?.configured ? (
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              Active &amp; Authorized
            </span>
          ) : (
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              Setup Required
            </span>
          )}
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Access your personal AI command center directly from Telegram on your phone or desktop. Supports <code>/tasks</code>, <code>/briefing</code>, <code>/status</code>, and natural conversational voice &amp; text management powered by Google Gemini and live database tools.
        </p>

        {/* Security & Webhook Info Callout */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-blue-500" /> Security Status:
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Private 1-to-1 Only &bull; Strict Numeric ID Whitelist
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            Webhook Endpoint: <code>/api/telegram/webhook</code>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Telegram Bot Token
                </label>
                {config?.telegram?.hasToken && (
                  <span className="text-[10px] text-emerald-600 font-semibold">Configured</span>
                )}
              </div>
              <input
                type={showKeys ? "text" : "password"}
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
                placeholder={config?.telegram?.hasToken ? "••••••••••••••••••••••••" : "Paste from @BotFather"}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Allowed Telegram User ID
                </label>
                {config?.telegram?.hasAllowedUser && (
                  <span className="text-[10px] text-emerald-600 font-semibold">Configured</span>
                )}
              </div>
              <input
                type="text"
                value={telegramAllowedUserId}
                onChange={(e) => setTelegramAllowedUserId(e.target.value)}
                placeholder={config?.telegram?.hasAllowedUser ? "User ID Configured" : "e.g. 123456789"}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Webhook Secret Token
                </label>
                {config?.telegram?.hasWebhookSecret && (
                  <span className="text-[10px] text-emerald-600 font-semibold">Configured</span>
                )}
              </div>
              <input
                type={showKeys ? "text" : "password"}
                value={telegramWebhookSecret}
                onChange={(e) => setTelegramWebhookSecret(e.target.value)}
                placeholder={config?.telegram?.hasWebhookSecret ? "••••••••••••••••" : "Optional custom secret"}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end pt-1">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs transition shadow-sm"
            >
              {saving ? "Saving..." : "Save Telegram Configuration"}
            </button>
          </div>
        </form>
      </div>

      {/* Personal Telegram Account Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Personal Telegram Account (User MTProto Client)
            </h2>
          </div>
          {config?.telegramPersonal?.isConnected ? (
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              Connected &bull; Active
            </span>
          ) : config?.telegramPersonal?.isConfigured ? (
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              Session Exists &bull; Disconnected
            </span>
          ) : (
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              Not Connected
            </span>
          )}
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Allows the AI assistant to interact with your personal contacts and conversations on your behalf. Messages sent through this integration appear under your own personal Telegram identity, distinct from <code>@BereketAssistantBot</code>. Immediate personal sends always require your explicit confirmation.
        </p>

        {personalMsg && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              personalMsg.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                : "bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800"
            }`}
          >
            {personalMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span>{personalMsg.text}</span>
          </div>
        )}

        {/* Status / Account Details */}
        {config?.telegramPersonal?.isConnected && config.telegramPersonal.user ? (
          <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-800/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{config.telegramPersonal.user.firstName} {config.telegramPersonal.user.lastName || ""}</span>
                  {config.telegramPersonal.user.username && (
                    <span className="text-xs font-normal text-purple-600 dark:text-purple-400">
                      @{config.telegramPersonal.user.username}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Phone: {config.telegramPersonal.user.phone || "Hidden"} &bull; ID: {config.telegramPersonal.user.id}
                </div>
              </div>

              <button
                type="button"
                onClick={handleDisconnectPersonal}
                disabled={personalLoading}
                className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-medium transition"
              >
                {personalLoading ? "Disconnecting..." : "Disconnect Account"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Terminal CLI Recommendation */}
            <div className="p-3 bg-slate-900 text-slate-100 rounded-xl text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-sky-400">
                <Terminal className="w-4 h-4" /> Quick &amp; Private Terminal Authentication
              </div>
              <p className="text-[11px] text-slate-300">
                You can authenticate your personal Telegram account directly in your PowerShell terminal without typing secrets into the browser:
              </p>
              <code className="block bg-slate-950 px-3 py-1.5 rounded-lg text-emerald-400 font-mono text-[11px]">
                npm run telegram:personal-auth
              </code>
            </div>

            {/* In-Browser Connect Form */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Or Connect via Web Setup:
              </span>

              {personalAuthStep === "phone" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Telegram API ID
                      </label>
                      <input
                        type="text"
                        value={personalApiId}
                        onChange={(e) => setPersonalApiId(e.target.value)}
                        placeholder="From my.telegram.org"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Telegram API Hash
                      </label>
                      <input
                        type={showKeys ? "text" : "password"}
                        value={personalApiHash}
                        onChange={(e) => setPersonalApiHash(e.target.value)}
                        placeholder="From my.telegram.org"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Phone Number (with Country Code)
                      </label>
                      <input
                        type="text"
                        value={personalPhone}
                        onChange={(e) => setPersonalPhone(e.target.value)}
                        placeholder="+251911234567"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleStartPersonalLogin}
                      disabled={personalLoading}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs transition"
                    >
                      {personalLoading ? "Sending Code..." : "Send Verification Code"}
                    </button>
                  </div>
                </div>
              )}

              {personalAuthStep === "code" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Verification Code (Check your Telegram app)
                    </label>
                    <input
                      type="text"
                      value={personalCode}
                      onChange={(e) => setPersonalCode(e.target.value)}
                      placeholder="Enter 5-digit code"
                      className="w-48 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-center tracking-widest text-lg"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCompletePersonalLogin}
                      disabled={personalLoading}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition"
                    >
                      {personalLoading ? "Verifying..." : "Verify & Connect Account"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPersonalAuthStep("phone")}
                      className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs"
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}

              {personalAuthStep === "2fa" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Two-Step Verification (2FA) Password
                    </label>
                    <input
                      type="password"
                      value={personalPassword}
                      onChange={(e) => setPersonalPassword(e.target.value)}
                      placeholder="Enter your 2FA password"
                      className="w-64 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCompletePersonalLogin}
                      disabled={personalLoading}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs transition"
                    >
                      {personalLoading ? "Authenticating..." : "Authenticate with 2FA"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPersonalAuthStep("phone")}
                      className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs"
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contact Aliases Directory */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            Contact Aliases Directory (e.g. &quot;wife&quot; &rarr; Contact Name)
          </span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Map conversational keywords to specific contacts so you can say &quot;Find my conversation with my wife&quot; or &quot;Tell Dani...&quot;.
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            {Object.entries(contactAliases).length === 0 ? (
              <span className="text-xs text-slate-400 italic">No custom aliases configured yet.</span>
            ) : (
              Object.entries(contactAliases).map(([alias, name]) => (
                <span
                  key={alias}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700 flex items-center gap-1.5"
                >
                  <code className="text-purple-600 dark:text-purple-400 font-semibold">{alias}</code>
                  <span>&rarr;</span>
                  <span>{name}</span>
                </span>
              ))
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="text"
              value={newAliasKey}
              onChange={(e) => setNewAliasKey(e.target.value)}
              placeholder="Alias (e.g. wife)"
              className="w-36 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
            />
            <span className="text-xs text-slate-400">&rarr;</span>
            <input
              type="text"
              value={newAliasValue}
              onChange={(e) => setNewAliasValue(e.target.value)}
              placeholder="Real Contact Name"
              className="w-48 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
            />
            <button
              type="button"
              onClick={handleAddAlias}
              className="px-3 py-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-xs font-medium hover:bg-slate-700 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Alias
            </button>
          </div>
        </div>
      </div>

      {/* Data Backup & Export / Restore Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Data Safety, Backups & Export
          </h2>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400">
          Export your complete database (tasks, projects, team members, memories, activity history) as a single JSON file. You can restore this file anytime or migrate to a production database.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleExportBackup}
            className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 transition flex items-center gap-2"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Download Complete JSON Backup
          </button>

          <label className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4 text-blue-600" />
            Restore From JSON File
            <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
          </label>

          <button
            onClick={handleResetSeed}
            className="px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-semibold text-red-700 dark:text-red-400 transition flex items-center gap-2 ml-auto"
          >
            <RotateCcw className="w-4 h-4" />
            Re-seed Initial Department Data
          </button>
        </div>
      </div>
    </div>
  );
};
