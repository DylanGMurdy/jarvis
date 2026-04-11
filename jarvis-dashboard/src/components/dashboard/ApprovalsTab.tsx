"use client";

import { useState, useEffect, useCallback } from "react";

interface ApprovalItem {
  id: string;
  project_id: string | null;
  project_title: string | null;
  action_type: string;
  description: string;
  payload: Record<string, unknown> | null;
  status: string;
  created_at: string;
}

export default function ApprovalsTab() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/approvals");
      const data = await res.json();
      setItems(data.data || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Seed a test item if the queue is empty on first load
  useEffect(() => {
    if (!loading && items.length === 0) {
      seedTestItem();
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  async function seedTestItem() {
    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_title: "AI Real Estate Lead Nurture",
          action_type: "send_email",
          description: "Lead Nurture Bot wants to send a follow-up email to Ivory Homes lead #847: \"Hi Sarah, just checking in on the Millcreek lot you toured last week. The builder has 2 similar lots releasing next month — want me to hold one for you?\"",
          payload: {
            to: "sarah@example.com",
            subject: "Following up on Millcreek",
            agent: "Lead Nurture Bot",
          },
        }),
      });
      if (res.ok) {
        fetchItems();
      }
    } catch { /* silent */ }
  }

  async function handleAction(id: string, status: "approved" | "rejected") {
    setActing(id);
    try {
      const res = await fetch(`/api/approvals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }
    } catch { /* silent */ }
    setActing(null);
  }

  const ACTION_ICONS: Record<string, string> = {
    send_email: "📧",
    post_social: "📱",
    api_call: "🔗",
    schedule_meeting: "📅",
    send_sms: "💬",
    create_listing: "🏠",
  };

  return (
    <div className="space-y-4 animate-[slideUp_0.3s_ease-out]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Approval Queue</h2>
          <p className="text-xs text-jarvis-muted">Agents hold external actions here for your approval before anything goes out.</p>
        </div>
        <button
          onClick={fetchItems}
          className="text-xs px-3 py-1.5 rounded-lg bg-jarvis-border text-jarvis-muted hover:text-jarvis-accent transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-jarvis-muted text-sm animate-pulse">Loading approvals...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-3xl mb-3">✅</div>
          <p className="text-jarvis-muted text-sm">All clear — no pending approvals.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-jarvis-card border border-jarvis-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="text-xl flex-shrink-0">{ACTION_ICONS[item.action_type] || "⚡"}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{item.action_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                      {item.project_title && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-jarvis-accent/20 text-jarvis-accent">{item.project_title}</span>
                      )}
                    </div>
                    <p className="text-sm text-jarvis-text mt-1 whitespace-pre-wrap">{item.description}</p>
                    <p className="text-[11px] text-jarvis-muted mt-2">
                      {new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction(item.id, "approved")}
                  disabled={acting === item.id}
                  className="flex-1 px-4 py-2 bg-jarvis-green/20 border border-jarvis-green/30 text-jarvis-green rounded-lg text-sm font-medium hover:bg-jarvis-green/30 disabled:opacity-50 transition-colors"
                >
                  {acting === item.id ? "..." : "✓ Approve"}
                </button>
                <button
                  onClick={() => handleAction(item.id, "rejected")}
                  disabled={acting === item.id}
                  className="flex-1 px-4 py-2 bg-jarvis-red/20 border border-jarvis-red/30 text-jarvis-red rounded-lg text-sm font-medium hover:bg-jarvis-red/30 disabled:opacity-50 transition-colors"
                >
                  {acting === item.id ? "..." : "✗ Reject"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
