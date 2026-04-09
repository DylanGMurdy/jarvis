"use client";

import { useState, useEffect } from "react";

interface LindyUpdate {
  summary: string;
  emails_handled: number;
  tasks_completed: number;
  flags: string[];
  created_at: string;
}

export default function LindyChat() {
  const [latestUpdate, setLatestUpdate] = useState<LindyUpdate | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchUpdate();
    const poll = setInterval(fetchUpdate, 30000);
    return () => clearInterval(poll);
  }, []);

  async function fetchUpdate() {
    try {
      const res = await fetch("/api/lindy/update");
      const data = await res.json();
      if (data.latest) setLatestUpdate(data.latest);
      setTotal(data.total || 0);
    } catch { /* silent */ }
  }

  return (
    <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-bold">L</span>
          <h3 className="text-sm font-semibold text-white">Lindy Operations</h3>
        </div>
        {latestUpdate ? (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
            <span className="text-[10px] text-[#22c55e]">Connected</span>
          </div>
        ) : (
          <span className="text-[10px] text-[#64748b]">Waiting for updates</span>
        )}
      </div>

      {latestUpdate ? (
        <div className="space-y-3">
          {/* Status line */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#64748b]">
              {total} update{total !== 1 ? "s" : ""} received
            </span>
            <span className="text-[10px] text-[#64748b]">
              {new Date(latestUpdate.created_at).toLocaleString()}
            </span>
          </div>

          {/* Summary */}
          <p className="text-sm text-[#e2e8f0] whitespace-pre-wrap">{latestUpdate.summary}</p>

          {/* Stats */}
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#64748b]">Emails:</span>
              <span className="text-xs font-semibold text-white">{latestUpdate.emails_handled}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#64748b]">Tasks:</span>
              <span className="text-xs font-semibold text-white">{latestUpdate.tasks_completed}</span>
            </div>
          </div>

          {/* Flags */}
          {latestUpdate.flags.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] text-[#eab308] font-semibold uppercase">Needs Attention</span>
              {latestUpdate.flags.map((f, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-[#eab308]/10 border border-[#eab308]/20 rounded-lg">
                  <span className="text-[#eab308] text-xs mt-0.5">⚠</span>
                  <span className="text-xs text-[#eab308]">{f}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-[#64748b]">No updates from Lindy yet</p>
          <p className="text-xs text-[#64748b]/60 mt-1">Lindy will send updates to /api/lindy/update</p>
        </div>
      )}
    </div>
  );
}
