"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TYPE_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  success: {
    bg: "bg-emerald-500/15 border-emerald-500/30",
    text: "text-emerald-400",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
    ),
  },
  info: {
    bg: "bg-blue-500/15 border-blue-500/30",
    text: "text-blue-400",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
    ),
  },
  warning: {
    bg: "bg-amber-500/15 border-amber-500/30",
    text: "text-amber-400",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
    ),
  },
  alert: {
    bg: "bg-red-500/15 border-red-500/30",
    text: "text-red-400",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
    ),
  },
};

function getStyle(type: string) {
  return TYPE_STYLES[type] || TYPE_STYLES.info;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setNotifications(data.data || []);
      setUnread(data.unread || 0);
    } catch { /* silent */ }
  }, []);

  // Initial fetch + Supabase realtime subscription
  useEffect(() => {
    fetchNotifications();

    const sb = getSupabase();
    if (!sb) return;

    const channel = sb
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev].slice(0, 50));
          if (!newNotif.read) setUnread((u) => u + 1);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        () => fetchNotifications()
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications" },
        () => fetchNotifications()
      )
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, [fetchNotifications]);

  // Click outside panel to close
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      // Defer to next frame so the opening click doesn't immediately close
      const t = setTimeout(() => document.addEventListener("mousedown", handler), 0);
      return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
    }
  }, [open]);

  // Lock body scroll when panel open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  async function markAllRead() {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch { /* silent */ }
  }

  async function markRead(id: string) {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
      setUnread((u) => Math.max(0, u - 1));
    } catch { /* silent */ }
  }

  async function clearAll() {
    if (!confirm("Clear all notifications? This cannot be undone.")) return;
    try {
      await fetch("/api/notifications?all=true", { method: "DELETE" });
      setNotifications([]);
      setUnread(0);
    } catch { /* silent */ }
  }

  async function deleteOne(id: string) {
    try {
      await fetch(`/api/notifications?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const wasUnread = !notifications.find((n) => n.id === id)?.read;
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (wasUnread) setUnread((u) => Math.max(0, u - 1));
    } catch { /* silent */ }
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-jarvis-border/50 transition-colors text-jarvis-muted hover:text-jarvis-text"
        title="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 003.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold px-1 py-0 rounded-full min-w-[16px] h-[16px] flex items-center justify-center animate-pulse">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Backdrop + slide-in panel */}
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-200 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        aria-hidden={!open}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
        <div
          ref={panelRef}
          className={`absolute right-0 top-0 h-full w-full sm:w-[420px] bg-jarvis-card border-l border-jarvis-border shadow-2xl flex flex-col transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-jarvis-border flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Notifications</h2>
              <p className="text-xs text-jarvis-muted mt-0.5">
                {unread > 0 ? `${unread} unread` : "All caught up"}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-jarvis-muted hover:text-white text-xl leading-none p-1"
              aria-label="Close"
            >×</button>
          </div>

          {/* Action bar */}
          {notifications.length > 0 && (
            <div className="px-5 py-2 border-b border-jarvis-border flex items-center gap-2">
              <button
                onClick={markAllRead}
                disabled={unread === 0}
                className="text-xs px-3 py-1.5 rounded-lg bg-jarvis-accent/15 text-jarvis-accent hover:bg-jarvis-accent/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Mark all read
              </button>
              <button
                onClick={clearAll}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors font-medium ml-auto"
              >
                Clear all
              </button>
            </div>
          )}

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-jarvis-muted">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-30 mb-3">
                  <path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 003.4 0" />
                </svg>
                <p className="text-sm">No notifications yet</p>
                <p className="text-xs mt-1 opacity-60">JARVIS will notify you when something needs attention</p>
              </div>
            ) : (
              <div>
                {notifications.map((n) => {
                  const style = getStyle(n.type);
                  const inner = (
                    <div className={`relative px-5 py-4 border-b border-jarvis-border/40 transition-colors ${!n.read ? "bg-jarvis-accent/[0.04]" : ""} hover:bg-jarvis-border/20 group`}>
                      {!n.read && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-jarvis-accent" />}
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${style.bg} ${style.text}`}>
                          {style.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className={`text-sm font-bold leading-tight ${!n.read ? "text-white" : "text-jarvis-text"}`}>{n.title}</h3>
                            {!n.read && <span className="w-2 h-2 rounded-full bg-jarvis-accent flex-shrink-0 mt-1.5" />}
                          </div>
                          <p className="text-xs text-jarvis-muted mt-1 leading-relaxed">{n.body}</p>
                          <div className="flex items-center justify-between mt-2 gap-2">
                            <span className="text-[10px] text-jarvis-muted">{timeAgo(n.created_at)}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!n.read && (
                                <button
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); markRead(n.id); }}
                                  className="text-[10px] px-2 py-1 rounded bg-jarvis-border text-jarvis-text hover:bg-jarvis-accent/20 hover:text-jarvis-accent transition-colors"
                                >
                                  Mark read
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteOne(n.id); }}
                                className="text-[10px] px-2 py-1 rounded bg-jarvis-border text-jarvis-muted hover:bg-red-500/20 hover:text-red-400 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                  return n.link ? (
                    <Link key={n.id} href={n.link} onClick={() => { markRead(n.id); setOpen(false); }} className="block">{inner}</Link>
                  ) : (
                    <div key={n.id}>{inner}</div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
