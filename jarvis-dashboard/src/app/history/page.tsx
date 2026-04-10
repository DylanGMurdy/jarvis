"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { ChatMessage } from "@/lib/types";

interface ConversationRow {
  id: string;
  title: string;
  summary: string;
  conversation_type: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/conversations?limit=50");
        const data = await res.json();
        setConversations(data.data || []);
      } catch { /* silent */ }
      setLoading(false);
    }
    load();
  }, []);

  function getPreview(convo: ConversationRow): string {
    const msgs = convo.messages || [];
    if (msgs.length === 0) return "Empty conversation";
    const first = msgs.find((m) => m.role === "user");
    return first ? first.content.slice(0, 120) : msgs[0].content.slice(0, 120);
  }

  function toggleExpand(id: string) {
    setExpandedId(expandedId === id ? null : id);
  }

  return (
    <div className="min-h-screen bg-jarvis-bg text-jarvis-text">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-jarvis-card/95 backdrop-blur-lg border-b border-jarvis-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-jarvis-muted hover:text-white transition-colors p-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
            <h1 className="text-lg font-bold text-white">Chat History</h1>
          </div>
          <span className="text-xs text-jarvis-muted">{conversations.length} conversations</span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-4 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-jarvis-muted text-sm animate-pulse">Loading chat history...</div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-4xl mb-4">💬</div>
            <p className="text-jarvis-muted text-sm mb-4">No conversations yet</p>
            <Link href="/chat/new" className="px-4 py-2.5 bg-jarvis-accent text-white rounded-xl text-sm font-medium active:scale-95 transition-transform">
              Start chatting with JARVIS
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((convo) => {
              const msgs = convo.messages || [];
              const isExpanded = expandedId === convo.id;
              const isProject = convo.conversation_type === "project" || convo.summary?.startsWith("project:");
              const projectId = isProject ? convo.summary?.replace("project:", "") : null;

              return (
                <div key={convo.id} className="bg-jarvis-card border border-jarvis-border rounded-xl overflow-hidden transition-all">
                  {/* Collapsed header — clickable */}
                  <button
                    onClick={() => toggleExpand(convo.id)}
                    className="w-full px-4 py-3.5 text-left active:bg-jarvis-border/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-sm font-semibold text-white truncate">
                            {convo.title || convo.summary || "Chat with JARVIS"}
                          </h3>
                          {isProject && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-jarvis-accent/20 text-jarvis-accent flex-shrink-0">
                              Project
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-jarvis-muted line-clamp-1">
                          {getPreview(convo)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-[11px] text-jarvis-muted">
                          {formatDate(convo.updated_at || convo.created_at)}
                        </span>
                        <span className="text-[11px] text-jarvis-accent">
                          {msgs.length} msg{msgs.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    {/* Expand indicator */}
                    <div className="flex items-center justify-center mt-2">
                      <svg
                        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        className={`text-jarvis-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded — full chat */}
                  {isExpanded && (
                    <div className="border-t border-jarvis-border">
                      {/* Date + meta */}
                      <div className="px-4 py-2 bg-jarvis-bg/50 flex items-center justify-between flex-wrap gap-2">
                        <span className="text-[11px] text-jarvis-muted">
                          {formatFullDate(convo.created_at)}
                        </span>
                        <div className="flex gap-2">
                          {isProject && projectId && (
                            <Link
                              href={`/ideas/${projectId}`}
                              className="text-[11px] text-jarvis-accent hover:underline"
                            >
                              Open Project
                            </Link>
                          )}
                          <Link
                            href={`/chat/${convo.id}`}
                            className="text-[11px] text-jarvis-accent hover:underline"
                          >
                            Continue Chat
                          </Link>
                        </div>
                      </div>

                      {/* Messages */}
                      <div className="px-4 py-3 space-y-3 max-h-[60vh] overflow-y-auto">
                        {msgs.length === 0 ? (
                          <p className="text-xs text-jarvis-muted text-center py-4">No messages in this conversation</p>
                        ) : msgs.map((msg, i) => {
                          const isUser = msg.role === "user";
                          return (
                            <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                              <div className={`flex items-end gap-2 max-w-[85%] ${isUser ? "flex-row-reverse" : ""}`}>
                                {!isUser && (
                                  <div className="w-6 h-6 bg-jarvis-accent rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 mb-0.5">
                                    J
                                  </div>
                                )}
                                <div
                                  className={`rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                                    isUser
                                      ? "bg-jarvis-accent text-white rounded-br-md"
                                      : "bg-jarvis-border text-jarvis-text rounded-bl-md"
                                  }`}
                                >
                                  {msg.content}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Footer — continue chat */}
                      <div className="px-4 py-3 border-t border-jarvis-border bg-jarvis-bg/30">
                        <Link
                          href={`/chat/${convo.id}`}
                          className="block w-full text-center px-4 py-2.5 bg-jarvis-accent text-white rounded-xl text-sm font-medium active:scale-95 transition-transform"
                        >
                          Continue this conversation
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
