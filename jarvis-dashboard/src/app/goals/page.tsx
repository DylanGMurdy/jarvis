"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Goal, Project } from "@/lib/types";
import { api } from "@/lib/api";

type Status = "On Track" | "At Risk" | "Behind" | "Complete";

const STATUS_STYLES: Record<Status, { color: string; bg: string; border: string }> = {
  "On Track": { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  "At Risk": { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  Behind: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
  Complete: { color: "text-[#6366f1]", bg: "bg-[#6366f1]/10", border: "border-[#6366f1]/30" },
};

function daysUntil(date: string): number {
  if (!date) return 0;
  const target = new Date(date);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

interface GoalUpdate {
  id: string;
  goal_id: string;
  note: string;
  progress: number | null;
  created_at: string;
}

interface Recommendation {
  title: string;
  description: string;
  target_days: number;
  rationale: string;
  suggested_status: string;
}

// Inline SVG sparkline of progress over time
function Sparkline({ updates, currentProgress }: { updates: GoalUpdate[]; currentProgress: number }) {
  const points = [...updates.filter((u) => u.progress !== null).map((u) => u.progress as number), currentProgress];
  if (points.length < 2) {
    return <div className="text-[10px] text-[#64748b] italic tap-target-auto">Log updates to see your progress trend</div>;
  }
  const w = 180, h = 30;
  const max = 100, min = 0;
  const step = w / (points.length - 1);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - ((p - min) / (max - min)) * h}`).join(" ");
  const last = points[points.length - 1];
  const trend = last >= points[0];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible tap-target-auto">
      <path d={path} fill="none" stroke={trend ? "#22c55e" : "#ef4444"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={i * step} cy={h - ((p - min) / (max - min)) * h} r="1.5" fill={trend ? "#22c55e" : "#ef4444"} />
      ))}
    </svg>
  );
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<Status>("On Track");
  const [projectId, setProjectId] = useState<string>("");

  // Goal updates state
  const [updatesByGoal, setUpdatesByGoal] = useState<Record<string, GoalUpdate[]>>({});
  const [logUpdateGoal, setLogUpdateGoal] = useState<Goal | null>(null);
  const [updateNote, setUpdateNote] = useState("");
  const [updateProgress, setUpdateProgress] = useState<number>(0);
  const [savingUpdate, setSavingUpdate] = useState(false);

  // Recommendations state
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [showRecs, setShowRecs] = useState(false);

  const loadGoals = useCallback(async () => {
    const [g, p] = await Promise.all([api.goals.list(), api.projects.list()]);
    setGoals(g);
    setProjects(p);
    // Load updates for each goal in parallel
    const updatesMap: Record<string, GoalUpdate[]> = {};
    await Promise.all(
      g.map(async (goal) => {
        try {
          const r = await fetch(`/api/db/goals/${goal.id}/updates`);
          const j = await r.json();
          updatesMap[goal.id] = j.data || [];
        } catch {
          updatesMap[goal.id] = [];
        }
      })
    );
    setUpdatesByGoal(updatesMap);
    setLoading(false);
  }, []);

  useEffect(() => { loadGoals(); }, [loadGoals]);

  async function handleLogUpdate() {
    if (!logUpdateGoal || !updateNote.trim()) return;
    setSavingUpdate(true);
    try {
      // Save update
      await fetch(`/api/db/goals/${logUpdateGoal.id}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: updateNote.trim(), progress: updateProgress }),
      });
      // Sync goal progress
      await fetch(`/api/db/goals/${logUpdateGoal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          progress: updateProgress,
          status: updateProgress >= 100 ? "Complete" : (logUpdateGoal.status as Status) || "On Track",
        }),
      });
      setLogUpdateGoal(null);
      setUpdateNote("");
      loadGoals();
    } catch { /* silent */ }
    setSavingUpdate(false);
  }

  function openLogUpdate(g: Goal) {
    setLogUpdateGoal(g);
    setUpdateNote("");
    setUpdateProgress(g.progress);
  }

  async function generateRecommendations() {
    setLoadingRecs(true);
    setShowRecs(true);
    try {
      const res = await fetch("/api/goals/recommendations", { method: "POST" });
      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } catch { /* silent */ }
    setLoadingRecs(false);
  }

  async function adoptRecommendation(rec: Recommendation) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + (rec.target_days || 90));
    await fetch("/api/db/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: rec.title,
        description: rec.description,
        target_date: targetDate.toISOString().split("T")[0],
        progress: 0,
        status: "On Track",
        category: "business",
      }),
    });
    setRecommendations((prev) => prev.filter((r) => r.title !== rec.title));
    loadGoals();
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setTargetDate("");
    setProgress(0);
    setStatus("On Track");
    setProjectId("");
    setEditingId(null);
    setShowCreate(false);
  }

  async function handleSave() {
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      description: description.trim(),
      target_date: targetDate,
      progress,
      status,
      project_id: projectId || null,
      category: "business",
    };
    if (editingId) {
      await fetch(`/api/db/goals/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/db/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    resetForm();
    loadGoals();
  }

  function startEdit(g: Goal) {
    setEditingId(g.id);
    setTitle(g.title);
    setDescription(g.description || "");
    setTargetDate(g.target_date || "");
    setProgress(g.progress);
    setStatus((g.status as Status) || "On Track");
    setProjectId(g.project_id || "");
    setShowCreate(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this goal?")) return;
    await fetch(`/api/db/goals/${id}`, { method: "DELETE" });
    loadGoals();
  }

  async function quickProgressUpdate(g: Goal, delta: number) {
    const newProgress = Math.max(0, Math.min(100, g.progress + delta));
    const newStatus: Status = newProgress >= 100 ? "Complete" : (g.status as Status) || "On Track";
    await fetch(`/api/db/goals/${g.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progress: newProgress, status: newStatus }),
    });
    loadGoals();
  }

  // Master progress: average of all non-complete goals
  const overallProgress = goals.length > 0
    ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length)
    : 0;
  const completeCount = goals.filter((g) => g.status === "Complete" || g.progress >= 100).length;
  const onTrackCount = goals.filter((g) => g.status === "On Track" && g.progress < 100).length;
  const atRiskCount = goals.filter((g) => g.status === "At Risk").length;
  const behindCount = goals.filter((g) => g.status === "Behind").length;

  if (loading) {
    return <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-[#64748b]">Loading goals...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e2e8f0]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-[#64748b] hover:text-[#e2e8f0] transition-colors text-sm mb-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold mb-1">90-Day Goals</h1>
            <p className="text-sm text-[#64748b]">Track and crush your most important objectives</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={generateRecommendations}
              disabled={loadingRecs}
              className="px-4 py-2.5 bg-gradient-to-r from-[#6366f1]/20 to-purple-500/20 border border-[#6366f1]/40 text-[#6366f1] rounded-lg text-sm font-semibold hover:from-[#6366f1]/30 hover:to-purple-500/30 transition-all disabled:opacity-50"
            >
              {loadingRecs ? "Thinking..." : "✨ Generate Recommendations"}
            </button>
            <button
              onClick={() => { resetForm(); setShowCreate(true); }}
              className="px-5 py-2.5 bg-[#6366f1] text-white rounded-lg text-sm font-semibold hover:bg-[#5558e6] transition-colors"
            >
              + New Goal
            </button>
          </div>
        </div>

        {/* Recommendations Panel */}
        {showRecs && (
          <div className="bg-[#12121a] rounded-2xl border border-[#6366f1]/30 p-6 mb-6 animate-[slideUp_0.3s_ease-out]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>✨</span>
                <span>JARVIS Recommendations</span>
              </h3>
              <button onClick={() => setShowRecs(false)} className="text-[#64748b] hover:text-white text-sm tap-target-auto">×</button>
            </div>
            {loadingRecs ? (
              <div className="text-center py-6 text-sm text-[#64748b] animate-pulse">
                Analyzing your projects and goals...
              </div>
            ) : recommendations.length === 0 ? (
              <div className="text-center py-6 text-sm text-[#64748b]">
                No recommendations available. Try again with more project data.
              </div>
            ) : (
              <div className="space-y-3">
                {recommendations.map((rec, i) => (
                  <div key={i} className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h4 className="text-sm font-semibold text-white flex-1">{rec.title}</h4>
                      <span className="text-[10px] text-[#6366f1] bg-[#6366f1]/10 px-2 py-0.5 rounded-full whitespace-nowrap tap-target-auto">
                        {rec.target_days} days
                      </span>
                    </div>
                    <p className="text-xs text-[#94a3b8] mb-2">{rec.description}</p>
                    <p className="text-[11px] text-[#64748b] italic mb-3">→ {rec.rationale}</p>
                    <button
                      onClick={() => adoptRecommendation(rec)}
                      className="px-3 py-1.5 bg-[#6366f1] text-white rounded-lg text-xs font-medium hover:bg-[#5558e6] transition-colors"
                    >
                      Adopt this goal
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Master Progress */}
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#64748b] uppercase tracking-wider">Overall Progress</h2>
            <span className="text-2xl font-bold text-[#6366f1]">{overallProgress}%</span>
          </div>
          <div className="w-full h-3 bg-[#1e1e2e] rounded-full overflow-hidden mb-4">
            <div className="h-full bg-gradient-to-r from-[#6366f1] to-[#a855f7] rounded-full transition-all duration-500" style={{ width: `${overallProgress}%` }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <p className="text-xl font-bold text-emerald-400">{onTrackCount}</p>
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider">On Track</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <p className="text-xl font-bold text-amber-400">{atRiskCount}</p>
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider">At Risk</p>
            </div>
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
              <p className="text-xl font-bold text-red-400">{behindCount}</p>
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider">Behind</p>
            </div>
            <div className="p-3 rounded-lg bg-[#6366f1]/5 border border-[#6366f1]/20">
              <p className="text-xl font-bold text-[#6366f1]">{completeCount}</p>
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider">Complete</p>
            </div>
          </div>
        </div>

        {/* Create/Edit Form */}
        {showCreate && (
          <div className="bg-[#12121a] rounded-2xl border border-[#6366f1]/30 p-6 mb-6">
            <h3 className="text-lg font-bold mb-4">{editingId ? "Edit Goal" : "New Goal"}</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Goal title (e.g. Hit $10K MRR)"
                className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#6366f1]"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-[#6366f1]"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#64748b] block mb-1">Target Date</label>
                  <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#6366f1]" />
                </div>
                <div>
                  <label className="text-xs text-[#64748b] block mb-1">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#6366f1]">
                    <option>On Track</option>
                    <option>At Risk</option>
                    <option>Behind</option>
                    <option>Complete</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#64748b] block mb-1">Progress: {progress}%</label>
                  <input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(parseInt(e.target.value))} className="w-full accent-[#6366f1]" />
                </div>
                <div>
                  <label className="text-xs text-[#64748b] block mb-1">Linked Project (optional)</label>
                  <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#6366f1]">
                    <option value="">None</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} disabled={!title.trim()} className="px-5 py-2 bg-[#6366f1] text-white rounded-lg text-sm font-semibold hover:bg-[#5558e6] disabled:opacity-50 transition-colors">
                  {editingId ? "Save Changes" : "Create Goal"}
                </button>
                <button onClick={resetForm} className="px-5 py-2 bg-[#1e1e2e] text-[#94a3b8] rounded-lg text-sm font-medium hover:text-white transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Goals Grid */}
        {goals.length === 0 ? (
          <div className="text-center py-16 text-[#64748b]">
            <p className="text-lg mb-2">No goals yet</p>
            <p className="text-sm">Create your first 90-day goal to start tracking progress.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.map((g) => {
              const days = g.target_date ? daysUntil(g.target_date) : 0;
              const styles = STATUS_STYLES[(g.status as Status) || "On Track"];
              const linkedProject = projects.find((p) => p.id === g.project_id);
              const isOverdue = g.target_date && days < 0 && g.progress < 100;
              return (
                <div key={g.id} className={`bg-[#12121a] rounded-xl border ${styles.border} p-5 transition-all hover:shadow-lg hover:shadow-[#6366f1]/5`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white text-base mb-1 truncate">{g.title}</h3>
                      {g.description && <p className="text-xs text-[#94a3b8] line-clamp-2">{g.description}</p>}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${styles.bg} ${styles.color} whitespace-nowrap`}>{g.status || "On Track"}</span>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-[#64748b]">Progress</span>
                      <span className="text-sm font-bold text-white">{g.progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${g.progress >= 100 ? "bg-[#6366f1]" : "bg-gradient-to-r from-[#6366f1] to-[#a855f7]"}`} style={{ width: `${g.progress}%` }} />
                    </div>
                  </div>

                  {g.target_date && (
                    <div className="flex items-center gap-2 mb-3 text-xs">
                      <span className="text-[#64748b]">Target:</span>
                      <span className="text-[#e2e8f0]">{new Date(g.target_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      <span className={`ml-auto font-semibold ${isOverdue ? "text-red-400" : days <= 7 ? "text-amber-400" : "text-[#6366f1]"}`}>
                        {isOverdue ? `${Math.abs(days)} days overdue` : days === 0 ? "Today" : `${days} days left`}
                      </span>
                    </div>
                  )}

                  {linkedProject && (
                    <Link href={`/ideas/${linkedProject.id}`} className="block mb-3 text-xs text-[#6366f1] hover:underline truncate">
                      → {linkedProject.title}
                    </Link>
                  )}

                  {/* Sparkline of progress over time */}
                  <div className="mb-3 pb-3 border-b border-[#1e1e2e]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-[#64748b] font-semibold tap-target-auto">Progress trend</span>
                      <span className="text-[10px] text-[#64748b] tap-target-auto">{(updatesByGoal[g.id] || []).length} updates</span>
                    </div>
                    <Sparkline updates={updatesByGoal[g.id] || []} currentProgress={g.progress} />
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-[#1e1e2e]">
                    <button onClick={() => openLogUpdate(g)} className="px-2.5 py-1.5 bg-[#6366f1]/10 border border-[#6366f1]/30 text-[#6366f1] rounded text-xs font-medium hover:bg-[#6366f1]/20 transition-colors">+ Log Update</button>
                    <button onClick={() => quickProgressUpdate(g, 10)} className="px-2.5 py-1 bg-[#1e1e2e] text-[#94a3b8] rounded text-xs hover:text-white transition-colors">+10%</button>
                    <button onClick={() => startEdit(g)} className="ml-auto px-2.5 py-1 text-[#94a3b8] hover:text-white text-xs transition-colors">Edit</button>
                    <button onClick={() => handleDelete(g.id)} className="px-2.5 py-1 text-[#94a3b8] hover:text-red-400 text-xs transition-colors">Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log Update Modal */}
      {logUpdateGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setLogUpdateGoal(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()} className="relative bg-[#12121a] border border-[#1e1e2e] rounded-2xl p-6 w-full max-w-md animate-[slideUp_0.3s_ease-out]">
            <h3 className="text-lg font-bold text-white mb-1">Log Progress Update</h3>
            <p className="text-xs text-[#64748b] mb-4 truncate">{logUpdateGoal.title}</p>

            <label className="block text-xs text-[#64748b] mb-1">What happened?</label>
            <textarea
              value={updateNote}
              onChange={(e) => setUpdateNote(e.target.value)}
              placeholder="e.g. Closed 2 new builder leads, prototype 80% complete..."
              rows={3}
              className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#64748b] focus:outline-none focus:border-[#6366f1] resize-none mb-4"
              autoFocus
            />

            <label className="block text-xs text-[#64748b] mb-1">New progress: {updateProgress}%</label>
            <input
              type="range"
              min={0}
              max={100}
              value={updateProgress}
              onChange={(e) => setUpdateProgress(parseInt(e.target.value))}
              className="w-full accent-[#6366f1] mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setLogUpdateGoal(null)}
                className="flex-1 px-4 py-2.5 bg-[#1e1e2e] text-[#94a3b8] rounded-lg text-sm hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogUpdate}
                disabled={!updateNote.trim() || savingUpdate}
                className="flex-1 px-4 py-2.5 bg-[#6366f1] text-white rounded-lg text-sm font-semibold hover:bg-[#5558e6] disabled:opacity-50 transition-colors"
              >
                {savingUpdate ? "Saving..." : "Save Update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
