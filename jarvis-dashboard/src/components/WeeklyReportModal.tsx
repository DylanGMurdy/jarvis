"use client";

import { useState, useEffect } from "react";

interface ReportStats {
  projects: number;
  actionsThisWeek: number;
  warRoomRuns: number;
  tasksCompleted: number;
  mrr: number;
}

// Minimal markdown renderer for the report
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (/^# /.test(line)) return <h1 key={i} className="text-2xl font-bold text-white mt-6 mb-3">{line.replace(/^# /, "")}</h1>;
    if (/^## /.test(line)) return <h2 key={i} className="text-lg font-bold text-jarvis-accent mt-6 mb-2 border-b border-jarvis-border pb-1">{line.replace(/^## /, "")}</h2>;
    if (/^### /.test(line)) return <h3 key={i} className="text-base font-semibold text-white mt-4 mb-1">{line.replace(/^### /, "")}</h3>;
    if (/^- /.test(line) || /^\* /.test(line)) return <li key={i} className="text-sm text-jarvis-text ml-6 list-disc mb-1">{renderInline(line.replace(/^[-*] /, ""))}</li>;
    if (/^\d+\. /.test(line)) return <li key={i} className="text-sm text-jarvis-text ml-6 list-decimal mb-1">{renderInline(line.replace(/^\d+\. /, ""))}</li>;
    if (line.trim() === "") return <div key={i} className="h-2" />;
    return <p key={i} className="text-sm text-jarvis-text leading-relaxed mb-2">{renderInline(line)}</p>;
  });
}

function renderInline(text: string): React.ReactNode {
  // Bold via **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i} className="text-white font-semibold">{p.slice(2, -2)}</strong>;
    return <span key={i}>{p}</span>;
  });
}

export default function WeeklyReportModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<string | null>(null);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Generate on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/reports/weekly", { method: "POST" });
        const data = await res.json();
        if (data.ok) {
          setReport(data.report);
          setStats(data.stats);
        } else {
          setError(data.error || "Failed to generate report");
        }
      } catch {
        setError("Network error generating report");
      }
      setLoading(false);
    })();
  }, []);

  function downloadReport() {
    if (!report) return;
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weekly-report-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-jarvis-card border border-jarvis-border rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-jarvis-border bg-gradient-to-r from-jarvis-accent/10 via-purple-500/10 to-jarvis-accent/10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <h2 className="text-lg font-bold text-white">Weekly Report</h2>
              <p className="text-xs text-jarvis-muted">Week ending {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {report && (
              <button
                onClick={downloadReport}
                className="text-xs px-3 py-1.5 rounded-lg bg-jarvis-accent/20 text-jarvis-accent hover:bg-jarvis-accent/30 transition-colors"
              >
                Download .md
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-jarvis-border text-jarvis-muted hover:text-white transition-colors"
              title="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Stats strip */}
        {stats && (
          <div className="grid grid-cols-5 gap-2 px-6 py-3 border-b border-jarvis-border bg-jarvis-bg/40">
            <div className="text-center">
              <div className="text-xl font-bold text-jarvis-accent">{stats.projects}</div>
              <div className="text-[10px] text-jarvis-muted uppercase tracking-wider">Projects</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-white">{stats.actionsThisWeek}</div>
              <div className="text-[10px] text-jarvis-muted uppercase tracking-wider">Agent Actions</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-purple-400">{stats.warRoomRuns}</div>
              <div className="text-[10px] text-jarvis-muted uppercase tracking-wider">War Rooms</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-jarvis-green">{stats.tasksCompleted}</div>
              <div className="text-[10px] text-jarvis-muted uppercase tracking-wider">Tasks Done</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-jarvis-cyan">${stats.mrr}</div>
              <div className="text-[10px] text-jarvis-muted uppercase tracking-wider">MRR</div>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-jarvis-muted">
              <div className="animate-spin w-8 h-8 border-2 border-jarvis-accent border-t-transparent rounded-full mb-4" />
              <p className="text-sm animate-pulse">JARVIS is analyzing your week...</p>
              <p className="text-xs mt-2">Pulling project activity, War Room sessions, agent outputs, and revenue data</p>
            </div>
          ) : error ? (
            <div className="text-center py-16 text-red-400">
              <p className="text-sm">{error}</p>
            </div>
          ) : report ? (
            <div className="prose prose-invert max-w-none">{renderMarkdown(report)}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
