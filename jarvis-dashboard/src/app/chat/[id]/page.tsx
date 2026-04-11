"use client";

import { use, useRef, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConversation } from "@/hooks/useConversation";
import VoiceChatInput from "@/components/VoiceChatInput";
import type { Project } from "@/lib/types";

const SUGGESTED_PROMPTS = [
  "What should I focus on today?",
  "Give me a status report",
  "Help me plan tonight's coding session",
  "What's my top priority right now?",
];

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const isNew = id === "new";

  const {
    messages,
    sending,
    loaded,
    title,
    send,
    conversationId,
  } = useConversation(
    isNew
      ? {}
      : { conversationId: id }
  );

  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // If we started a new chat and got a conversationId, update URL
  useEffect(() => {
    if (isNew && conversationId) {
      router.replace(`/chat/${conversationId}`);
    }
  }, [isNew, conversationId, router]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = text || input.trim();
    if (!msg) return;
    setInput("");
    await send(msg);
  }, [input, send]);

  // ─── Smart Action Buttons ─────────────────────────────
  const [actionLoading, setActionLoading] = useState<"idea" | "project" | null>(null);
  const [toast, setToast] = useState<{ message: string; link?: string } | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);

  const showActions = messages.length >= 3 && !sending;

  async function loadProjects() {
    if (projectsLoaded) return;
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data.data || []);
    } catch { /* silent */ }
    setProjectsLoaded(true);
  }

  function showToast(message: string, link?: string) {
    setToast({ message, link });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleNewIdea() {
    setActionLoading("idea");
    try {
      const res = await fetch("/api/projects/create-from-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation: messages }),
      });
      const data = await res.json();
      if (data.success && data.project) {
        showToast(`Created "${data.project.title}"`, `/ideas/${data.project.id}`);
      } else {
        showToast(data.error || "Failed to create project");
      }
    } catch {
      showToast("Connection error");
    }
    setActionLoading(null);
  }

  async function handleAddToProject(projectId: string) {
    setShowProjectPicker(false);
    setActionLoading("project");
    try {
      const res = await fetch("/api/projects/create-from-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation: messages, projectId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Added to "${data.projectTitle}" — ${data.tasksCreated} tasks, ${data.notesCreated} notes`);
      } else {
        showToast(data.error || "Failed to add to project");
      }
    } catch {
      showToast("Connection error");
    }
    setActionLoading(null);
  }

  const getSuggestedPrompts = (): string[] => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return SUGGESTED_PROMPTS;
    const text = lastMsg.content.toLowerCase();
    if (text.includes("lead") || text.includes("nurture")) return ["What features should the MVP have?", "Who are my first target customers?", "Draft a cold outreach email", "What's the pricing strategy?"];
    if (text.includes("goal") || text.includes("progress")) return ["What's blocking me?", "Recalculate my timeline", "What should I deprioritize?", "Give me a weekly action plan"];
    if (text.includes("revenue") || text.includes("money")) return ["Fastest path to $1k/mo?", "Compare ideas by revenue potential", "Help me set pricing", "Draft a sales pitch"];
    return ["What's highest leverage right now?", "Analyze my AI pipeline", "Help me plan a coding session", "Draft a builder outreach strategy"];
  };

  return (
    <div className="flex flex-col h-screen bg-jarvis-bg text-jarvis-text">
      {/* Header */}
      <div className="flex-shrink-0 bg-jarvis-card/95 backdrop-blur-lg border-b border-jarvis-border safe-area-top">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/chat" className="text-jarvis-muted hover:text-white transition-colors p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 bg-jarvis-accent rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">J</div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-white truncate">
                {title || (isNew ? "New Chat" : "JARVIS")}
              </h1>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-jarvis-green animate-[pulse-dot_2s_ease-in-out_infinite]" />
                <span className="text-[11px] text-jarvis-muted">Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {!loaded ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-jarvis-muted text-sm animate-pulse">Loading...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-jarvis-accent/20 rounded-full flex items-center justify-center mb-4">
              <span className="text-jarvis-accent font-bold text-xl">J</span>
            </div>
            <p className="text-jarvis-muted text-sm mb-6">How can I help, sir?</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {getSuggestedPrompts().map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(p)}
                  className="text-sm px-3.5 py-2 rounded-2xl bg-jarvis-card border border-jarvis-border text-jarvis-text active:bg-jarvis-accent/20 active:border-jarvis-accent/40 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
          return (
            <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div className={`flex items-end gap-2 max-w-[85%] ${isUser ? "flex-row-reverse" : ""}`}>
                {!isUser && (
                  <div className="w-7 h-7 bg-jarvis-accent rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mb-0.5">
                    J
                  </div>
                )}
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    isUser
                      ? "bg-jarvis-accent text-white rounded-br-md"
                      : "bg-jarvis-card border border-jarvis-border text-jarvis-text rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}

        {sending && (
          <div className="flex justify-start">
            <div className="flex items-end gap-2">
              <div className="w-7 h-7 bg-jarvis-accent rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mb-0.5">
                J
              </div>
              <div className="bg-jarvis-card border border-jarvis-border rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-jarvis-muted rounded-full animate-[bounce_1.4s_ease-in-out_infinite]" />
                  <span className="w-2 h-2 bg-jarvis-muted rounded-full animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
                  <span className="w-2 h-2 bg-jarvis-muted rounded-full animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Smart Action Buttons — shown after 3+ messages */}
      {showActions && (
        <div className="flex-shrink-0 px-3 py-2 border-t border-jarvis-border">
          <div className="flex gap-2 relative">
            <button
              onClick={handleNewIdea}
              disabled={actionLoading !== null}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-jarvis-accent/10 border border-jarvis-accent/30 text-jarvis-accent active:bg-jarvis-accent/20 disabled:opacity-50 whitespace-nowrap"
            >
              {actionLoading === "idea" ? (
                <span className="animate-pulse">Creating...</span>
              ) : (
                <>💡 New Idea</>
              )}
            </button>
            <button
              onClick={() => { loadProjects(); setShowProjectPicker(!showProjectPicker); }}
              disabled={actionLoading !== null}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-jarvis-card border border-jarvis-border text-jarvis-muted active:text-jarvis-accent disabled:opacity-50 whitespace-nowrap"
            >
              {actionLoading === "project" ? (
                <span className="animate-pulse">Adding...</span>
              ) : (
                <>📌 Add to Project</>
              )}
            </button>

            {/* Project Picker Dropdown */}
            {showProjectPicker && (
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-jarvis-card border border-jarvis-border rounded-xl shadow-lg overflow-hidden z-20">
                <div className="px-3 py-2 border-b border-jarvis-border">
                  <p className="text-[11px] text-jarvis-muted font-medium">Select a project</p>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {!projectsLoaded ? (
                    <div className="px-3 py-4 text-xs text-jarvis-muted text-center animate-pulse">Loading...</div>
                  ) : projects.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-jarvis-muted text-center">No projects yet</div>
                  ) : (
                    projects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleAddToProject(p.id)}
                        className="w-full text-left px-3 py-2.5 hover:bg-jarvis-border/30 active:bg-jarvis-accent/10 transition-colors border-b border-jarvis-border/50 last:border-0"
                      >
                        <span className="text-sm text-white block truncate">{p.title}</span>
                        <span className="text-[11px] text-jarvis-muted">{p.category} · {p.status}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suggested prompts — shown when there are messages */}
      {messages.length > 0 && !sending && (
        <div className="flex-shrink-0 px-3 py-2 border-t border-jarvis-border overflow-x-auto">
          <div className="flex gap-2 no-scrollbar">
            {getSuggestedPrompts().map((p, i) => (
              <button
                key={i}
                onClick={() => handleSend(p)}
                className="text-xs px-3 py-1.5 rounded-full bg-jarvis-card border border-jarvis-border text-jarvis-muted active:text-jarvis-accent whitespace-nowrap flex-shrink-0"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 p-3 border-t border-jarvis-border bg-jarvis-card safe-area-bottom">
        <VoiceChatInput
          value={input}
          onChange={setInput}
          onSend={() => handleSend()}
          disabled={sending}
          placeholder="Message JARVIS..."
          variant="full"
        />
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-jarvis-card border border-jarvis-accent/40 rounded-xl px-4 py-3 shadow-lg flex items-center gap-3 max-w-sm">
            <span className="text-sm text-white">{toast.message}</span>
            {toast.link && (
              <Link href={toast.link} className="text-xs text-jarvis-accent font-medium whitespace-nowrap hover:underline">
                View →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
