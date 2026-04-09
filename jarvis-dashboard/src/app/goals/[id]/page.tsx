"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { api } from "@/lib/api";
import type { Goal, GoalJournal, ChatMessage } from "@/lib/types";
import VoiceChatInput from "@/components/VoiceChatInput";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function getCurrentWeek(createdAt: string): number {
  const start = new Date(createdAt).getTime();
  return Math.max(1, Math.ceil((Date.now() - start) / (7 * 24 * 60 * 60 * 1000)));
}

export default function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);

  const [goal, setGoal] = useState<Goal | undefined>(undefined);
  const [journal, setJournal] = useState<GoalJournal[]>([]);
  const [journalInput, setJournalInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const [g, j] = await Promise.all([
      api.goals.get(id),
      api.goalJournal.list(id),
    ]);
    if (g) {
      setGoal(g);
      setJournal(j);
    }
  }, [id]);

  useEffect(() => {
    async function load() {
      await reload();
      setLoaded(true);
    }
    load();
  }, [reload]);

  async function toggleMilestone(milestoneId: string) {
    if (!goal) return;
    const updated = goal.milestones.map((m) =>
      m.id === milestoneId ? { ...m, done: !m.done } : m
    );
    const doneCount = updated.filter((m) => m.done).length;
    const newProgress = Math.round((doneCount / updated.length) * 100);
    await api.goals.update(id, { milestones: updated, progress: newProgress });
    reload();
  }

  async function saveJournalEntry() {
    if (!journalInput.trim()) return;
    await api.goalJournal.create(id, journalInput.trim());
    setJournalInput("");
    reload();
  }

  async function sendChat(content?: string) {
    if (!goal) return;
    const msg = content ?? chatInput.trim();
    if (!msg) return;

    const userMessage: ChatMessage = { role: "user", content: msg };
    const next = [...chatMessages, userMessage];
    setChatMessages(next);
    setChatInput("");
    setChatLoading(true);

    const milestoneSummary = goal.milestones
      .map((m) => `- [${m.done ? "x" : " "}] ${m.title}`)
      .join("\n");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          context: {
            type: "goal",
            goal: {
              title: goal.title,
              target: goal.target,
              progress: goal.progress,
              target_date: goal.target_date,
              milestones_summary: milestoneSummary,
            },
          },
        }),
      });
      const data = await res.json();
      setChatMessages([...next, { role: "assistant", content: data.response ?? "No response received." }]);
    } catch {
      setChatMessages([...next, { role: "assistant", content: "Failed to reach JARVIS. Try again." }]);
    } finally {
      setChatLoading(false);
    }
  }

  if (loaded && !goal) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#e2e8f0] text-xl mb-4">Goal not found</p>
          <Link href="/" className="text-[#6366f1] hover:text-[#818cf8] transition-colors">Back to Goals</Link>
        </div>
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <p className="text-[#64748b]">Loading...</p>
      </div>
    );
  }

  const doneCount = goal.milestones.filter((m) => m.done).length;
  const totalCount = goal.milestones.length;
  const currentWeek = getCurrentWeek(goal.created_at);

  const chartData = {
    labels: (goal.progress_snapshots || []).map((s) => `Week ${s.week}`),
    datasets: [{
      data: (goal.progress_snapshots || []).map((s) => s.progress),
      borderColor: "#6366f1",
      backgroundColor: "rgba(99,102,241,0.1)",
      fill: true, tension: 0.4, pointBackgroundColor: "#6366f1", pointBorderColor: "#6366f1", pointRadius: 4,
    }],
  };

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    scales: {
      x: { grid: { color: "#1e1e2e" }, ticks: { color: "#64748b" } },
      y: { min: 0, max: 100, grid: { color: "#1e1e2e" }, ticks: { color: "#64748b" } },
    },
    plugins: { tooltip: { backgroundColor: "#12121a", titleColor: "#e2e8f0", bodyColor: "#e2e8f0", borderColor: "#1e1e2e", borderWidth: 1 } },
  };

  const suggestedPrompts = ["Am I on track?", "What should I focus on this week?", "Help me break down the next milestone", "Give me a motivation boost"];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e2e8f0]">
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-[#64748b] hover:text-[#e2e8f0] transition-colors mb-6">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to Goals
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{goal.title}</h1>
              <div className="flex items-center gap-3">
                {goal.target_date && <span className="text-sm text-[#64748b]">Target: {formatDate(goal.target_date)}</span>}
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#6366f1]/20 text-[#818cf8] border border-[#6366f1]/30">{goal.category}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-5xl font-bold text-[#6366f1]">{goal.progress}%</span>
              <p className="text-sm text-[#64748b] mt-1">complete</p>
            </div>
          </div>
          <div className="mt-6 w-full h-3 bg-[#1e1e2e] rounded-full overflow-hidden">
            <div className="h-full bg-[#6366f1] rounded-full transition-all duration-700 ease-out" style={{ width: `${goal.progress}%` }} />
          </div>
        </div>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Milestones <span className="text-[#64748b] text-base font-normal">({doneCount}/{totalCount})</span></h2>
          <div className="space-y-2">
            {goal.milestones.map((m) => (
              <button key={m.id} onClick={() => toggleMilestone(m.id)} className="w-full flex items-center gap-3 p-4 bg-[#12121a] border border-[#1e1e2e] rounded-xl hover:border-[#6366f1]/40 transition-all text-left cursor-pointer">
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${m.done ? "bg-[#6366f1] border-[#6366f1]" : "border-[#64748b] hover:border-[#6366f1]"}`}>
                  {m.done && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className={`transition-all ${m.done ? "line-through text-[#64748b]" : "text-[#e2e8f0]"}`}>{m.title}</span>
              </button>
            ))}
          </div>
        </section>

        {goal.weekly_breakdown && goal.weekly_breakdown.length > 0 && <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Weekly Game Plan</h2>
          <div className="space-y-2">
            {goal.weekly_breakdown.map((week, i) => {
              const weekNum = i + 1;
              const isCurrent = currentWeek === weekNum;
              return (
                <div key={i} className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${isCurrent ? "bg-[#6366f1]/10 border-[#6366f1]/40" : "bg-[#12121a] border-[#1e1e2e]"}`}>
                  <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold ${isCurrent ? "bg-[#6366f1] text-white" : "bg-[#1e1e2e] text-[#64748b]"}`}>{weekNum}</span>
                  <span className={isCurrent ? "text-[#e2e8f0] font-medium" : "text-[#94a3b8]"}>{week}</span>
                  {isCurrent && <span className="ml-auto flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full bg-[#6366f1]/20 text-[#818cf8]">Current</span>}
                </div>
              );
            })}
          </div>
        </section>}

        {(goal.progress_snapshots || []).length > 0 && <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Progress Over Time</h2>
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6">
            <div style={{ height: 250 }}><Line data={chartData} options={chartOptions} /></div>
          </div>
        </section>}

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Journal <span className="text-[#64748b] text-base font-normal">({journal.length})</span></h2>
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4 mb-4">
            <textarea value={journalInput} onChange={(e) => setJournalInput(e.target.value)} placeholder="Write a journal entry..." rows={3} className="w-full bg-transparent text-[#e2e8f0] placeholder-[#64748b] resize-none outline-none" />
            <div className="flex justify-end mt-2">
              <button onClick={saveJournalEntry} disabled={!journalInput.trim()} className="px-4 py-2 bg-[#6366f1] text-white text-sm font-medium rounded-lg hover:bg-[#5558e6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">Save Entry</button>
            </div>
          </div>
          <div className="space-y-3">
            {[...journal].reverse().map((entry) => (
              <div key={entry.id} className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4">
                <p className="text-[#e2e8f0] whitespace-pre-wrap mb-2">{entry.entry}</p>
                <p className="text-xs text-[#64748b]">{formatDateTime(entry.created_at)}</p>
              </div>
            ))}
            {journal.length === 0 && <p className="text-[#64748b] text-sm text-center py-6">No journal entries yet. Write your first one above.</p>}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Ask JARVIS about this goal</h2>
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden">
            <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
              {chatMessages.length === 0 && <p className="text-[#64748b] text-sm text-center py-8">Ask JARVIS anything about your goal progress, strategy, or next steps.</p>}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-xl text-sm whitespace-pre-wrap ${msg.role === "user" ? "bg-[#6366f1] text-white" : "bg-[#1e1e2e] text-[#e2e8f0]"}`}>{msg.content}</div>
                </div>
              ))}
              {chatLoading && <div className="flex justify-start"><div className="bg-[#1e1e2e] text-[#64748b] px-4 py-2.5 rounded-xl text-sm">Thinking...</div></div>}
            </div>
            {chatMessages.length === 0 && (
              <div className="px-4 pb-3 flex flex-wrap gap-2">
                {suggestedPrompts.map((prompt) => (
                  <button key={prompt} onClick={() => sendChat(prompt)} className="px-3 py-1.5 text-xs bg-[#1e1e2e] text-[#94a3b8] rounded-lg hover:bg-[#6366f1]/20 hover:text-[#818cf8] transition-colors cursor-pointer">{prompt}</button>
                ))}
              </div>
            )}
            <div className="border-t border-[#1e1e2e] p-3">
              <VoiceChatInput
                value={chatInput}
                onChange={setChatInput}
                onSend={() => sendChat()}
                disabled={chatLoading}
                variant="full"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
