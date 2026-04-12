"use client";

import { useState, useEffect, useCallback } from "react";

interface LindyUpdate {
  id: string;
  summary: string;
  emails_handled: number;
  tasks_completed: number;
  flags: string[];
  raw_payload: Record<string, unknown>;
  created_at: string;
}

export default function LindyWebhookCard() {
  const [updates, setUpdates] = useState<LindyUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const loadUpdates = useCallback(async () => {
    try {
      const res = await fetch("/api/lindy/update?limit=5");
      const data = await res.json();
      setUpdates(data.updates || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadUpdates(); }, [loadUpdates]);

  // Connection status: green if a webhook arrived in last 24h
  const lastUpdate = updates[0];
  const isConnected = lastUpdate
    ? (Date.now() - new Date(lastUpdate.created_at).getTime()) < 24 * 60 * 60 * 1000
    : false;

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/lindy/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: "🧪 Test payload from Jarvis dashboard",
          emails_handled: 0,
          tasks_completed: 0,
          flags: [],
          test: true,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult({ ok: true, message: "Webhook is working ✓" });
        loadUpdates();
      } else {
        setTestResult({ ok: false, message: data.error || "Test failed" });
      }
    } catch {
      setTestResult({ ok: false, message: "Connection error" });
    }
    setTesting(false);
    setTimeout(() => setTestResult(null), 5000);
  }

  function formatTimeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div className="bg-jarvis-card border border-jarvis-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-jarvis-accent/10 flex items-center justify-center text-base">🪢</div>
          <div>
            <h3 className="text-sm font-bold text-white">Lindy Webhook</h3>
            <p className="text-xs text-jarvis-muted">/api/lindy/update</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-jarvis-green/15 text-jarvis-green border border-jarvis-green/30">
              <span className="w-1.5 h-1.5 rounded-full bg-jarvis-green animate-[pulse-dot_2s_ease-in-out_infinite]" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-jarvis-red/15 text-jarvis-red border border-jarvis-red/30">
              <span className="w-1.5 h-1.5 rounded-full bg-jarvis-red" />
              No recent activity
            </span>
          )}
        </div>
      </div>

      {/* Test button */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={testConnection}
          disabled={testing}
          className="px-3 py-2 bg-jarvis-accent text-white text-xs font-medium rounded-lg hover:bg-jarvis-accent/80 disabled:opacity-50 transition-colors"
        >
          {testing ? "Testing..." : "Test Lindy Connection"}
        </button>
        <button
          onClick={loadUpdates}
          className="px-3 py-2 bg-jarvis-border text-jarvis-muted text-xs rounded-lg hover:text-jarvis-text transition-colors"
        >
          Refresh
        </button>
        {testResult && (
          <span className={`text-xs ${testResult.ok ? "text-jarvis-green" : "text-jarvis-red"}`}>
            {testResult.message}
          </span>
        )}
      </div>

      {/* Recent updates */}
      <div>
        <p className="text-[10px] font-semibold uppercase text-jarvis-muted tracking-wider mb-2">Last 5 Updates</p>
        {loading ? (
          <p className="text-xs text-jarvis-muted py-3">Loading...</p>
        ) : updates.length === 0 ? (
          <div className="text-center py-6 px-3 bg-jarvis-bg/50 rounded-lg border border-dashed border-jarvis-border">
            <p className="text-xs text-jarvis-muted">No webhook activity yet</p>
            <p className="text-[10px] text-jarvis-muted/60 mt-1">Configure Lindy to POST to /api/lindy/update</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {updates.map((u) => (
              <div key={u.id} className="bg-jarvis-bg/50 border border-jarvis-border rounded-lg px-3 py-2.5">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-xs text-jarvis-text line-clamp-2 flex-1">
                    {u.summary || <span className="text-jarvis-muted italic">No summary</span>}
                  </p>
                  <span className="text-[10px] text-jarvis-muted whitespace-nowrap shrink-0">{formatTimeAgo(u.created_at)}</span>
                </div>
                {(u.emails_handled > 0 || u.tasks_completed > 0 || (u.flags && u.flags.length > 0)) && (
                  <div className="flex items-center gap-2 flex-wrap mt-1.5">
                    {u.emails_handled > 0 && (
                      <span className="text-[10px] text-jarvis-muted">📧 {u.emails_handled} emails</span>
                    )}
                    {u.tasks_completed > 0 && (
                      <span className="text-[10px] text-jarvis-muted">✓ {u.tasks_completed} tasks</span>
                    )}
                    {u.flags && u.flags.length > 0 && (
                      <span className="text-[10px] text-jarvis-yellow">⚑ {u.flags.length} flag{u.flags.length !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
