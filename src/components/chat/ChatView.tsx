"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Sparkles,
  Bot,
  User,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { ChatMessageItem, ActionConfirmation } from "@/types";

interface ChatViewProps {
  onRefreshData?: () => void;
  onOpenSettings?: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ onRefreshData, onOpenSettings }) => {
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string>("Autonomous Engine (Demo)");
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Suggested prompt chips
  const promptSuggestions = [
    "What should I focus on today?",
    "Show me everything overdue.",
    "Add a task for Dani to finish the MMA media pack by Thursday.",
    "What is everyone in the Graphics Department working on?",
    "I have three urgent adverts and two people available. Help me distribute the workload.",
    "Plan my week around my Abbay TV responsibilities and freelance work.",
    "I need to finish a personal video project this month. Help me break it into tasks.",
    "What have I been neglecting lately?",
    "Summarize my completed work this week.",
    "Remind me what I decided about my last project.",
  ];

  const fetchMessages = async () => {
    try {
      const res = await fetch("/api/chat?conversationId=default");
      const data = await res.json();
      if (data.success && data.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.success && data.config) {
        setActiveProvider(data.config.activeProviderName);
        setIsDemoMode(data.config.isDemoMode);
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  };

  useEffect(() => {
    fetchMessages();
    fetchSettings();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    setInput("");

    // Optimistically add user message
    const tempUserMsg: ChatMessageItem = {
      id: `temp_${Date.now()}`,
      conversationId: "default",
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId: "default" }),
      });
      const data = await res.json();

      if (data.success && data.message) {
        setMessages((prev) => [...prev, data.message]);
        if (data.message.providerUsed) setActiveProvider(data.message.providerUsed);
        if (data.message.isDemoMode !== undefined) setIsDemoMode(data.message.isDemoMode);
        onRefreshData?.();
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            conversationId: "default",
            role: "assistant",
            content: `Error: ${data.error || "Failed to communicate with assistant"}`,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          conversationId: "default",
          role: "assistant",
          content: `Network connection error: ${err.message}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAction = async (
    confirmation: ActionConfirmation,
    messageId: string,
    approved: boolean
  ) => {
    try {
      const res = await fetch("/api/ai/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationId: confirmation.id,
          messageId,
          approved,
          payload: confirmation.payload,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh messages and data
        fetchMessages();
        onRefreshData?.();
      }
    } catch (err) {
      console.error("Action confirmation error:", err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Top Assistant Status Header */}
      <div className="px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 dark:text-white">
                Personal AI Command Center
              </h1>
              {isDemoMode ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  Demo Mode (Intelligent Engine)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  Cloud AI Connected
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Active Provider: <span className="font-medium text-slate-700 dark:text-slate-300">{activeProvider}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDemoMode && onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Configure API Key
            </button>
          )}
          <button
            onClick={fetchMessages}
            title="Refresh conversation"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={`flex gap-3 md:gap-4 max-w-4xl mx-auto ${
                isUser ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white shadow-sm ${
                  isUser
                    ? "bg-slate-800 dark:bg-slate-700"
                    : "bg-gradient-to-tr from-blue-600 to-indigo-600"
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Content Bubble */}
              <div
                className={`flex-1 rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-sm ${
                  isUser
                    ? "bg-blue-600 text-white max-w-xl ml-auto"
                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 max-w-3xl"
                }`}
              >
                {/* Tool calls badges if present */}
                {Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {msg.toolCalls.map((tc: any, i: number) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900"
                      >
                        <Wrench className="w-3 h-3" />
                        Tool: {tc.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Render Content */}
                <div className="whitespace-pre-wrap font-sans">{msg.content}</div>

                {/* Consequential Action Confirmation Card */}
                {msg.pendingConfirmation && (
                  <div className="mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200">
                    <div className="flex items-start gap-2.5 mb-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-sm">
                          {msg.pendingConfirmation.title}
                        </h4>
                        <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                          {msg.pendingConfirmation.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-3 pt-2 border-t border-amber-200 dark:border-amber-800/60">
                      <button
                        onClick={() =>
                          handleConfirmAction(msg.pendingConfirmation!, msg.id, true)
                        }
                        className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition flex items-center gap-1.5 shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Confirm & Execute Action
                      </button>
                      <button
                        onClick={() =>
                          handleConfirmAction(msg.pendingConfirmation!, msg.id, false)
                        }
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-4 max-w-4xl mx-auto">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-3">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              <span>Analyzing department workload and database records...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Suggestion Chips */}
      <div className="px-4 md:px-8 py-2 bg-slate-100/70 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-800/60 overflow-x-auto whitespace-nowrap scrollbar-none flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1 pl-1">
          <HelpCircle className="w-3.5 h-3.5" /> Suggested:
        </span>
        {promptSuggestions.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(prompt)}
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition shadow-2xs shrink-0"
          >
            <span>{prompt}</span>
            <ArrowRight className="w-3 h-3 opacity-60" />
          </button>
        ))}
      </div>

      {/* Input Form Bar */}
      <div className="p-4 md:p-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="max-w-4xl mx-auto relative flex items-center"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Instruct the assistant (e.g. 'What should I focus on today?', 'Add a task for Dani...')"
            className="w-full pl-5 pr-14 py-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-inner"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:hover:bg-blue-600 transition shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 mt-2">
          Abbay AI Assistant maintains structured memory across Abbay TV, freelance clients, and personal media. Consequential actions require approval.
        </p>
      </div>
    </div>
  );
};
