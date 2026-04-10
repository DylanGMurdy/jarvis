"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { ConversationPreview } from "@/lib/types";

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

export default function ChatListPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const list = await api.conversations.list();
        setConversations(list);
      } catch { /* silent */ }
      setLoading(false);
    }
    load();
  }, []);

  async function handleNewChat() {
    router.push("/chat/new");
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.conversations.delete(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
    } catch { /* silent */ }
  }

  return (
    <div className="min-h-screen bg-jarvis-bg text-jarvis-text">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-jarvis-card/95 backdrop-blur-lg border-b border-jarvis-border safe-area-top">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-jarvis-muted hover:text-white transition-colors p-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
            <h1 className="text-lg font-bold text-white">Messages</h1>
          </div>
          <button
            onClick={handleNewChat}
            className="w-9 h-9 bg-jarvis-accent rounded-full flex items-center justify-center text-white active:scale-95 transition-transform"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Conversations List */}
      <div className="pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-jarvis-muted text-sm animate-pulse">Loading conversations...</div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 bg-jarvis-accent/20 rounded-full flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-jarvis-accent">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <p className="text-jarvis-muted text-sm mb-4">No conversations yet</p>
            <button
              onClick={handleNewChat}
              className="px-4 py-2.5 bg-jarvis-accent text-white rounded-xl text-sm font-medium active:scale-95 transition-transform"
            >
              Start a conversation
            </button>
          </div>
        ) : (
          <div className="divide-y divide-jarvis-border">
            {conversations.map((convo) => (
              <Link
                key={convo.id}
                href={`/chat/${convo.id}`}
                className="flex items-center gap-3 px-4 py-3.5 active:bg-jarvis-border/30 transition-colors"
              >
                {/* Avatar */}
                <div className="w-11 h-11 rounded-full bg-jarvis-accent/20 flex items-center justify-center flex-shrink-0">
                  {convo.conversation_type === "project" ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-jarvis-accent">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  ) : (
                    <span className="text-jarvis-accent font-bold text-sm">J</span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <h3 className="text-sm font-semibold text-white truncate">
                      {convo.title || "Chat with JARVIS"}
                    </h3>
                    <span className="text-[11px] text-jarvis-muted flex-shrink-0">
                      {timeAgo(convo.updated_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-jarvis-muted truncate flex-1">
                      {convo.last_role === "assistant" ? "JARVIS: " : "You: "}
                      {convo.preview || "No messages"}
                    </p>
                    {convo.conversation_type === "project" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-jarvis-accent/20 text-jarvis-accent flex-shrink-0">
                        Project
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => handleDelete(convo.id, e)}
                  className="p-2 text-jarvis-muted hover:text-jarvis-red transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 md:opacity-100"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
