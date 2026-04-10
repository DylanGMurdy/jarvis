"use client";

import { useState, useEffect, useMemo } from "react";
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

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ChatHistoryTab() {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => {
      const msgs = c.messages || [];
      return (
        (c.title || "").toLowerCase().includes(q) ||
        (c.summary || "").toLowerCase().includes(q) ||
        msgs.some((m) => m.content.toLowerCase().includes(q))
      );
    });
  }, [conversations, search]);

  function getPreview(convo: ConversationRow): string {
    const msgs = convo.messages || [];
    if (msgs.length === 0) return "Empty conversation";
    const first = msgs.find((m) => m.role === "user");
    return first ? first.content.slice(0, 120) : msgs[0].content.slice(0, 120);
  }

  return (
    <div className="space-y-4 animate-[slideUp_0.3s_ease-out]">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold">Chat History</h2>
          <p className="text-xs text-jarvis-muted">{conversations.length} conversations synced across all devices</p>
        </div>
        <Link href="/chat/new" className="px-3 py-1.5 bg-jarvis-accent text-white rounded-lg text-sm hover:bg-jarvis-accent-hover transition-colors">
          + New Chat
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-jarvis-muted">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conversations..."
          className="w-full bg-jarvis-card border border-jarvis-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-jarvis-text placeholder:text-jarvis-muted focus:outline-none focus:border-jarvis-accent transition-colors"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-jarvis-muted text-sm animate-pulse">Loading conversations...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-jarvis-muted">
          <div className="text-3xl mb-3">💬</div>
          <p className="text-sm">{search ? "No conversations match your search." : "No conversations yet."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((convo) => {
            const msgs = convo.messages || [];
            const isExpanded = expandedId === convo.id;
            const isProject = convo.conversation_type === "project" || convo.summary?.startsWith("project:");

            return (
              <div key={convo.id} className="bg-jarvis-card border border-jarvis-border rounded-xl overflow-hidden transition-all">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : convo.id)}
                  className="w-full px-4 py-3 text-left hover:bg-jarvis-border/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <h3 className="text-sm font-semibold text-white truncate">
                          {convo.title || convo.summary || "Chat with JARVIS"}
                        </h3>
                        {isProject && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-jarvis-accent/20 text-jarvis-accent">Project</span>
                        )}
                      </div>
                      <p className="text-xs text-jarvis-muted line-clamp-1">{getPreview(convo)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <span className="text-[11px] text-jarvis-muted">{timeAgo(convo.updated_at || convo.created_at)}</span>
                      <span className="text-[11px] text-jarvis-accent">{msgs.length} msgs</span>
                    </div>
                  </div>
                  <div className="flex justify-center mt-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-jarvis-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-jarvis-border">
                    <div className="px-4 py-2 bg-jarvis-bg/50 flex items-center justify-between">
                      <span className="text-[11px] text-jarvis-muted">
                        {new Date(convo.created_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </span>
                      <Link href={`/chat/${convo.id}`} className="text-[11px] text-jarvis-accent hover:underline">
                        Continue Chat
                      </Link>
                    </div>
                    <div className="px-4 py-3 space-y-3 max-h-[50vh] overflow-y-auto">
                      {msgs.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div className={`flex items-end gap-2 max-w-[80%] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                            {msg.role === "assistant" && (
                              <div className="w-6 h-6 bg-jarvis-accent rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 mb-0.5">J</div>
                            )}
                            <div className={`rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${msg.role === "user" ? "bg-jarvis-accent text-white rounded-br-md" : "bg-jarvis-border text-jarvis-text rounded-bl-md"}`}>
                              {msg.content}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-3 border-t border-jarvis-border">
                      <Link href={`/chat/${convo.id}`} className="block w-full text-center px-4 py-2.5 bg-jarvis-accent text-white rounded-xl text-sm font-medium hover:bg-jarvis-accent-hover transition-colors">
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
  );
}
