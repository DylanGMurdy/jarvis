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

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, [fetchNotifications]);

  // Click outside to close
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
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

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-jarvis-card border border-jarvis-border rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-jarvis-border">
            <h3 className="text-sm font-bold text-white">Notifications</h3>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-[10px] text-jarvis-accent hover:underline">Mark all read</button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-sm text-jarvis-muted">No notifications yet</div>
            ) : (
              notifications.map((n) => {
                const dotColor = n.type === "success" ? "bg-jarvis-green" : n.type === "alert" ? "bg-red-500" : "bg-jarvis-accent";
                const content = (
                  <div className={`flex items-start gap-3 px-4 py-3 border-b border-jarvis-border/50 hover:bg-jarvis-border/30 transition-colors ${!n.read ? "bg-jarvis-accent/5" : ""}`}>
                    <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotColor} ${!n.read ? "ring-2 ring-jarvis-accent/30" : ""}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{n.title}</div>
                      <div className="text-xs text-jarvis-muted line-clamp-2">{n.body}</div>
                      <div className="text-[10px] text-jarvis-muted mt-1">{timeAgo(n.created_at)}</div>
                    </div>
                  </div>
                );
                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => { markRead(n.id); setOpen(false); }}>
                    {content}
                  </Link>
                ) : (
                  <button key={n.id} onClick={() => markRead(n.id)} className="w-full text-left">
                    {content}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
