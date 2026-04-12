"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Project, Memory } from "@/lib/types";
import type { MemoryForBrain } from "@/components/JarvisBrain";
import LindyChat from "@/components/LindyChat";
import dynamic from "next/dynamic";

const JarvisBrain = dynamic(() => import("@/components/JarvisBrain"), { ssr: false });

type ModalData = { title: string; body: string; actions?: { label: string; onClick: () => void }[] } | null;

const TASKS_INIT = [
  { id: 1, text: "Review Ivory Homes lead pipeline", done: false, priority: "high" as const },
  { id: 2, text: "Finalize AI lead nurture MVP scope", done: false, priority: "high" as const },
  { id: 3, text: "Send weekly builder update emails", done: true, priority: "medium" as const },
  { id: 4, text: "Research competitor AI tools pricing", done: false, priority: "medium" as const },
  { id: 5, text: "Update Narwhal CRM contacts", done: false, priority: "low" as const },
  { id: 6, text: "Draft Jarvis-as-a-service landing page", done: false, priority: "medium" as const },
];

const SCHEDULE = [
  { time: "7:45 AM", event: "Wake up + morning routine", type: "personal" },
  { time: "9:30 AM", event: "Builder lead reviews", type: "work" },
  { time: "10:30 AM", event: "Ivory Homes site visit", type: "work" },
  { time: "12:00 PM", event: "Lunch break", type: "personal" },
  { time: "1:00 PM", event: "Client follow-ups", type: "work" },
  { time: "2:30 PM", event: "AI product development", type: "ai" },
  { time: "4:00 PM", event: "Narwhal team sync", type: "work" },
  { time: "5:30 PM", event: "Wrap up + planning", type: "work" },
  { time: "6:00 PM", event: "Family time", type: "family" },
  { time: "8:00 PM", event: "Vibe coding session", type: "ai" },
];

const MOODS = ["Fired Up", "Focused", "Tired", "Stressed", "Creative"];

interface OverviewTabProps {
  projects: Project[];
  memories: Memory[];
  setActiveTab: (tab: "overview" | "ideas" | "agents" | "goals" | "memory") => void;
  setMemoryFilter: (filter: string) => void;
  openModal: (data: ModalData) => void;
  closeModal: () => void;
}

const KPICard = ({ label, value, sub, icon, onClick }: { label: string; value: string; sub: string; icon: string; onClick: () => void }) => (
  <button onClick={onClick} className="bg-jarvis-card border border-jarvis-border rounded-xl p-4 text-left hover:border-jarvis-accent/50 transition-all cursor-pointer group w-full">
    <div className="flex items-center justify-between mb-2">
      <span className="text-jarvis-muted text-sm">{label}</span>
      <span className="text-xl group-hover:scale-110 transition-transform">{icon}</span>
    </div>
    <div className="text-2xl font-bold text-white">{value}</div>
    <div className="text-xs text-jarvis-muted mt-1">{sub}</div>
  </button>
);

interface WeatherData {
  tempF: number;
  desc: string;
  highF: number;
  lowF: number;
  windMph: number;
  humidity: number;
  forecast: { date: string; high: number; low: number; desc: string }[];
}

function WeatherWidget({ openModal }: { openModal: (d: ModalData) => void }) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("https://wttr.in/SaltLakeCity?format=j1");
        const j = await res.json();
        const cur = j.current_condition?.[0];
        const today = j.weather?.[0];
        if (!cur || !today) { setLoading(false); return; }
        setWeather({
          tempF: parseInt(cur.temp_F, 10),
          desc: cur.weatherDesc?.[0]?.value || "",
          highF: parseInt(today.maxtempF, 10),
          lowF: parseInt(today.mintempF, 10),
          windMph: parseInt(cur.windspeedMiles, 10),
          humidity: parseInt(cur.humidity, 10),
          forecast: (j.weather || []).slice(1, 4).map((d: { date: string; maxtempF: string; mintempF: string; hourly: { weatherDesc: { value: string }[] }[] }) => ({
            date: d.date,
            high: parseInt(d.maxtempF, 10),
            low: parseInt(d.mintempF, 10),
            desc: d.hourly?.[4]?.weatherDesc?.[0]?.value || "",
          })),
        });
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="w-full bg-jarvis-card border border-jarvis-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-jarvis-muted mb-2">Salt Lake City, UT</h3>
        <div className="text-sm text-jarvis-muted animate-pulse">Loading weather...</div>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="w-full bg-jarvis-card border border-jarvis-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-jarvis-muted mb-2">Salt Lake City, UT</h3>
        <div className="text-sm text-jarvis-muted">Weather unavailable</div>
      </div>
    );
  }

  const forecastBody = weather.forecast.map((f) => `- ${f.date}: ${f.high}\u00B0F / ${f.low}\u00B0F, ${f.desc}`).join("\n");

  return (
    <button
      onClick={() => openModal({
        title: "Weather — Salt Lake City, UT",
        body: `Current: ${weather.tempF}\u00B0F, ${weather.desc}\nHigh: ${weather.highF}\u00B0F | Low: ${weather.lowF}\u00B0F\nWind: ${weather.windMph} mph\nHumidity: ${weather.humidity}%\n\n3-Day Forecast:\n${forecastBody}`,
        actions: [{ label: "Close", onClick: () => {} }],
      })}
      className="w-full bg-jarvis-card border border-jarvis-border rounded-xl p-4 text-left hover:border-jarvis-accent/50 transition-all cursor-pointer"
    >
      <h3 className="text-sm font-semibold text-jarvis-muted mb-2">Salt Lake City, UT</h3>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-3xl font-bold text-white">{weather.tempF}&deg;F</div>
          <div className="text-sm text-jarvis-muted">{weather.desc}</div>
        </div>
        <div className="text-right text-sm">
          <div className="text-jarvis-text">H: {weather.highF}&deg; L: {weather.lowF}&deg;</div>
          <div className="text-jarvis-muted">Wind: {weather.windMph} mph</div>
        </div>
      </div>
    </button>
  );
}

function MarketsWidget({ openModal }: { openModal: (d: ModalData) => void }) {
  const marketData = [
    { name: "S&P 500", value: "5,248", change: "+0.8%", up: true },
    { name: "NASDAQ", value: "16,384", change: "+1.1%", up: true },
    { name: "BTC", value: "$67,240", change: "-0.3%", up: false },
  ];
  return (
    <div className="bg-jarvis-card border border-jarvis-border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-jarvis-muted mb-3">Markets</h3>
      <div className="space-y-2 mb-3">
        {marketData.map((m, i) => (
          <button key={i} onClick={() => openModal({ title: m.name, body: `Current: ${m.value}\nChange: ${m.change}`, actions: [{ label: "View Chart", onClick: () => {} }] })} className="flex items-center justify-between w-full p-1.5 rounded hover:bg-jarvis-border/50 transition-colors">
            <span className="text-sm text-jarvis-text">{m.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-white">{m.value}</span>
              <span className={`text-xs ${m.up ? "text-jarvis-green" : "text-jarvis-red"}`}>{m.change}</span>
            </div>
          </button>
        ))}
      </div>
      <div className="flex items-end gap-1 h-16 mt-1">
        {[62, 68, 64, 72, 78].map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full bg-jarvis-accent/20 rounded-sm" style={{ height: `${v}%` }}>
              <div className="w-full h-full bg-jarvis-accent/40 rounded-sm" />
            </div>
            <span className="text-[9px] text-jarvis-muted">{["M","T","W","T","F"][i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const RIDER = "🏍️";
const HELMET = "🪖";
const WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

function MotoTTT() {
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [turn, setTurn] = useState(RIDER);
  const [winner, setWinner] = useState<string | null>(null);
  const [winCells, setWinCells] = useState<number[]>([]);
  const [score, setScore] = useState({ r: 0, h: 0, d: 0 });

  function checkWin(b: (string | null)[]): { player: string; cells: number[] } | null {
    for (const line of WIN_LINES) {
      const [a, c, e] = line;
      if (b[a] && b[a] === b[c] && b[a] === b[e]) return { player: b[a]!, cells: line };
    }
    return null;
  }

  function play(i: number) {
    if (board[i] || winner) return;
    const next = [...board];
    next[i] = turn;
    const result = checkWin(next);
    if (result) {
      setBoard(next);
      setWinner(result.player);
      setWinCells(result.cells);
      setScore((s) => ({ ...s, [result.player === RIDER ? "r" : "h"]: s[result.player === RIDER ? "r" : "h"] + 1 }));
      return;
    }
    if (next.every((c) => c)) {
      setBoard(next);
      setWinner("draw");
      setScore((s) => ({ ...s, d: s.d + 1 }));
      return;
    }
    setBoard(next);
    setTurn(turn === RIDER ? HELMET : RIDER);
  }

  function reset() {
    setBoard(Array(9).fill(null));
    setTurn(RIDER);
    setWinner(null);
    setWinCells([]);
  }

  const isDraw = winner === "draw";
  const isOver = !!winner;

  return (
    <div className="bg-jarvis-card border border-jarvis-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-jarvis-muted">Moto TT</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-orange-400 font-bold">{score.r}</span>
          <span className="text-jarvis-muted">-</span>
          <span className="text-jarvis-muted">{score.d}</span>
          <span className="text-jarvis-muted">-</span>
          <span className="text-red-400 font-bold">{score.h}</span>
        </div>
      </div>
      <div className={`text-center text-xs font-semibold mb-2 py-1.5 rounded-lg ${
        isOver ? isDraw ? "bg-jarvis-muted/10 text-jarvis-muted" : "bg-orange-500/10 text-orange-400" : "text-jarvis-muted"
      }`}>
        {isOver ? isDraw ? "🤝 Draw!" : `${winner} Wins!` : `${turn} ${turn === RIDER ? "Rider" : "Helmet"}'s turn`}
      </div>
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {board.map((cell, i) => (
          <button key={i} onClick={() => play(i)} className={`aspect-square rounded-lg flex items-center justify-center text-4xl transition-all ${
            winCells.includes(i) ? "bg-orange-500/15 shadow-[inset_0_0_12px_rgba(249,115,22,0.3)]" : cell ? "bg-jarvis-bg" : isOver ? "bg-jarvis-bg opacity-30" : "bg-jarvis-bg hover:bg-jarvis-border cursor-pointer active:scale-90"
          }`}>
            {cell}
          </button>
        ))}
      </div>
      {isOver && (
        <button onClick={reset} className="w-full py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white hover:shadow-[0_2px_12px_rgba(249,115,22,0.3)] transition-all active:scale-[0.97]">
          New Round
        </button>
      )}
    </div>
  );
}

interface DailyTask { id: string | number; text: string; done: boolean; priority: "high" | "medium" | "low" }

export default function OverviewTab({ projects, memories, setActiveTab, setMemoryFilter, openModal, closeModal }: OverviewTabProps) {
  const [tasks, setTasks] = useState<DailyTask[]>(TASKS_INIT);
  const [tasksLoading, setTasksLoading] = useState(true);

  // Fetch today's tasks from project_notes where source=daily_agent
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/tasks/today");
        const data = await res.json();
        const items: DailyTask[] = (data.data || []).map((t: { id: string; text: string }) => ({
          id: t.id,
          text: t.text,
          done: false,
          priority: "medium" as const,
        }));
        if (items.length > 0) setTasks(items);
      } catch { /* silent — keep static fallback */ }
      setTasksLoading(false);
    })();
  }, []);

  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [moodResponse, setMoodResponse] = useState<string | null>(null);
  const [dailyBrief, setDailyBrief] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefingLoading, setBriefingLoading] = useState(false);

  // Live agent activity feed
  interface ActivityItem { id: string; agent: string; action: string; preview: string; project: string; project_id: string; created_at: string }
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // Insights engine
  interface Insights {
    stats?: { totalProjects: number; totalActionsThisWeek: number; warRoomRunsThisWeek: number };
    mostActiveProject?: { id: string; title: string; noteCount: number; lastActivity: string } | null;
    agentOfWeek?: { name: string; count: number } | null;
    topAgents?: { name: string; count: number }[];
    insights?: { topInsights: { title: string; body: string }[]; commonRisks: string[]; commonOpportunities: string[]; weeklySummary: string };
  }
  const [insights, setInsights] = useState<Insights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);

  const fetchInsights = useCallback(async () => {
    setInsightsLoading(true);
    try {
      const res = await fetch("/api/insights");
      const data = await res.json();
      if (data.ok) setInsights(data);
    } catch { /* silent */ }
    setInsightsLoading(false);
  }, []);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/activity");
      const data = await res.json();
      setActivity(data.data || []);
    } catch { /* silent */ }
    setActivityLoading(false);
  }, []);

  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 60000); // 60s auto-refresh
    return () => clearInterval(interval);
  }, [fetchActivity]);

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  const handleMood = (mood: string) => {
    setSelectedMood(mood);
    const responses: Record<string, string> = {
      "Fired Up": "That's the energy, sir. Channel it into your highest-leverage task right now. What's the ONE thing that moves the needle most today?",
      "Focused": "Perfect state for deep work. I'd recommend spending this focus block on AI Lead Nurture MVP \u2014 that's your ticket to first revenue.",
      "Tired": "Understood, sir. On tired days, handle quick wins: clear inbox, review leads, update CRM. Save the heavy building for when you're sharp.",
      "Stressed": "I've got your back, sir. Let's triage: what's the biggest weight right now? Let's name it and break it into 3 small steps.",
      "Creative": "Creative mode activated. This is prime time for product ideation and building. Fire up the editor \u2014 let's make something people will pay for.",
    };
    setMoodResponse(responses[mood] || "Noted. Let's make the most of today.");
  };

  const toggleTask = (id: string | number) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  return (
    <div className="space-y-6 animate-[slideUp_0.3s_ease-out]">
      {/* Daily Brief */}
      {dailyBrief && (
        <div className="bg-jarvis-card border border-jarvis-accent/30 rounded-xl p-4 animate-[slideUp_0.3s_ease-out]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-jarvis-accent rounded-full flex items-center justify-center text-white text-xs font-bold">J</div>
              <h3 className="text-sm font-semibold text-white">Daily Brief</h3>
            </div>
            <button onClick={() => setDailyBrief(null)} className="text-jarvis-muted hover:text-white text-sm p-1">Dismiss</button>
          </div>
          <div className="text-sm text-jarvis-text whitespace-pre-wrap leading-relaxed">{dailyBrief}</div>
        </div>
      )}
      {!dailyBrief && !briefLoading && !briefingLoading && (
        <div className="flex gap-3">
          <button
            onClick={async () => {
              setBriefLoading(true);
              try {
                const res = await fetch("/api/brief");
                const data = await res.json();
                if (data.brief) setDailyBrief(data.brief);
              } catch { /* silent */ }
              setBriefLoading(false);
            }}
            className="flex-1 bg-jarvis-card border border-jarvis-border rounded-xl p-3 text-sm text-jarvis-muted hover:text-jarvis-accent hover:border-jarvis-accent/30 transition-all text-center"
          >
            Generate Daily Brief
          </button>
          <button
            onClick={async () => {
              setBriefingLoading(true);
              try {
                const res = await fetch("/api/briefing", { method: "POST" });
                const data = await res.json();
                if (data.ok && data.briefing) {
                  openModal({
                    title: "Morning Briefing",
                    body: data.briefing,
                    actions: [
                      { label: "Dismiss", onClick: closeModal },
                      { label: "Show on Dashboard", onClick: () => { setDailyBrief(data.briefing); closeModal(); } },
                    ],
                  });
                }
              } catch { /* silent */ }
              setBriefingLoading(false);
            }}
            className="flex-1 bg-jarvis-accent/10 border border-jarvis-accent/30 rounded-xl p-3 text-sm text-jarvis-accent hover:bg-jarvis-accent/20 transition-all text-center font-medium"
          >
            Send Morning Briefing
          </button>
        </div>
      )}
      {(briefLoading || briefingLoading) && (
        <div className="bg-jarvis-card border border-jarvis-border rounded-xl p-4 text-center">
          <div className="text-sm text-jarvis-muted animate-pulse">
            {briefingLoading ? "JARVIS is compiling your morning briefing..." : "JARVIS is preparing your brief..."}
          </div>
        </div>
      )}

      {/* KPI Row — real data from Supabase */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Agent Actions"
          value={String(activity.length)}
          sub="last 24h"
          icon="⚡"
          onClick={() => setActiveTab("agents")}
        />
        <KPICard
          label="Memories"
          value={String(memories.length)}
          sub={`${memories.filter((m) => {
            const d = new Date(m.created_at);
            const today = new Date();
            return d.toDateString() === today.toDateString();
          }).length} added today`}
          icon="🧠"
          onClick={() => setActiveTab("memory")}
        />
        <KPICard
          label="AI Projects"
          value={String(projects.length)}
          sub={`${projects.filter((p) => p.grade === "A").length} Grade A`}
          icon="💡"
          onClick={() => setActiveTab("ideas")}
        />
        <KPICard
          label="Days to Goal"
          value={String(Math.max(0, 90 - Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000) % 90))}
          sub="90-day sprint"
          icon="📅"
          onClick={() => setActiveTab("goals")}
        />
      </div>

      {/* Mood Check-In */}
      <div className="bg-jarvis-card border border-jarvis-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-jarvis-muted mb-3">Mood Check-In</h3>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button key={m} onClick={() => handleMood(m)} className={`px-3 py-1.5 rounded-lg text-sm transition-all ${selectedMood === m ? "bg-jarvis-accent text-white" : "bg-jarvis-border text-jarvis-text hover:bg-jarvis-accent/30"}`}>
              {m}
            </button>
          ))}
        </div>
        {moodResponse && (
          <div className="mt-3 p-3 bg-jarvis-accent/10 border border-jarvis-accent/20 rounded-lg text-sm text-jarvis-text animate-[slideUp_0.3s_ease-out]">
            <span className="text-jarvis-accent font-semibold">JARVIS: </span>{moodResponse}
          </div>
        )}
      </div>

      {/* Projects */}
      <div>
        <h3 className="text-sm font-semibold text-jarvis-muted mb-3">Projects</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["proj-6", "proj-2", "proj-7"] as const).map((pid) => {
            const p = projects.find((pr) => pr.id === pid);
            if (!p) return null;
            const isLindy = p.id === "proj-7";
            return (
              <div key={p.id} className="bg-jarvis-card border border-jarvis-border rounded-xl p-4 hover:border-jarvis-accent/50 transition-all">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h4 className="text-sm font-semibold text-white">{p.title}</h4>
                  {isLindy && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">Lindy</span>}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.status === "Building" ? "bg-jarvis-accent/20 text-jarvis-accent" : p.status === "Planning" ? "bg-jarvis-yellow/20 text-jarvis-yellow" : "bg-jarvis-green/20 text-jarvis-green"}`}>{p.status}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-jarvis-border text-jarvis-muted">{p.category}</span>
                </div>
                <p className="text-xs text-jarvis-muted line-clamp-2 mb-3">{p.description}</p>
                <Link href={`/ideas/${p.id}`} className="text-xs text-jarvis-accent hover:text-jarvis-accent-hover transition-colors">
                  Open in Ideas Lab &rarr;
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lindy Operations */}
      <LindyChat />

      {/* Jarvis Brain */}
      <div className="bg-jarvis-card border border-jarvis-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold text-white">Jarvis Brain</h3>
            <p className="text-xs text-jarvis-muted">your connected knowledge</p>
          </div>
          <span className="text-xs text-jarvis-muted">{memories.length + 4} nodes</span>
        </div>
        <div className="h-[400px] rounded-lg overflow-hidden">
          <JarvisBrain memories={memories as MemoryForBrain[]} onNodeClick={(node) => {
            if (node.id.startsWith("cat-")) {
              setActiveTab("memory");
              setMemoryFilter(node.type);
            }
          }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task List */}
        <div className="bg-jarvis-card border border-jarvis-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-jarvis-muted">Today&apos;s Tasks</h3>
            <span className="text-xs text-jarvis-muted">{tasks.filter((t) => t.done).length}/{tasks.length} done</span>
          </div>
          <div className="space-y-2">
            {tasks.map((t) => (
              <button key={t.id} onClick={() => toggleTask(t.id)} className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-jarvis-border/50 transition-colors text-left group">
                <span className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${t.done ? "bg-jarvis-green border-jarvis-green" : "border-jarvis-muted group-hover:border-jarvis-accent"}`}>
                  {t.done && <span className="text-white text-xs">&check;</span>}
                </span>
                <span className={`text-sm flex-1 ${t.done ? "line-through text-jarvis-muted" : "text-jarvis-text"}`}>{t.text}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${t.priority === "high" ? "bg-jarvis-red/20 text-jarvis-red" : t.priority === "medium" ? "bg-jarvis-yellow/20 text-jarvis-yellow" : "bg-jarvis-muted/20 text-jarvis-muted"}`}>{t.priority}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-jarvis-card border border-jarvis-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-jarvis-muted mb-3">Today&apos;s Schedule</h3>
          <div className="space-y-1">
            {SCHEDULE.map((s, i) => (
              <button key={i} onClick={() => openModal({ title: s.event, body: `Scheduled for ${s.time}\nType: ${s.type}\n\n${s.type === "family" ? "This is sacred family time. All notifications paused." : s.type === "ai" ? "Deep work block for AI product development." : "Standard work block. Agents running in background."}`, actions: [{ label: "Reschedule", onClick: closeModal }, { label: "Add Notes", onClick: closeModal }] })} className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-jarvis-border/50 transition-colors text-left">
                <span className="text-xs text-jarvis-muted w-16 flex-shrink-0">{s.time}</span>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.type === "family" ? "bg-jarvis-red" : s.type === "ai" ? "bg-jarvis-accent" : s.type === "personal" ? "bg-jarvis-cyan" : "bg-jarvis-green"}`} />
                <span className="text-sm text-jarvis-text">{s.event}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Jarvis Insights ──────────────────────────── */}
      <div className="bg-gradient-to-r from-jarvis-accent/10 via-purple-500/10 to-jarvis-accent/10 border border-jarvis-accent/30 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧠</span>
            <h3 className="text-sm font-bold text-white">Jarvis Insights</h3>
            {insights?.stats && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-jarvis-accent/20 text-jarvis-accent border border-jarvis-accent/30 font-semibold">
                {insights.stats.totalActionsThisWeek} actions this week
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchInsights} className="text-[10px] text-jarvis-muted hover:text-jarvis-accent" title="Refresh">↻</button>
            <button
              onClick={() => {
                if (!insights) return;
                const fullReport = `# Weekly Summary\n${insights.insights?.weeklySummary || "N/A"}\n\n# Top Insights\n${(insights.insights?.topInsights || []).map((i) => `**${i.title}**\n${i.body}`).join("\n\n")}\n\n# Common Risks Across Portfolio\n${(insights.insights?.commonRisks || []).map((r) => `• ${r}`).join("\n")}\n\n# Common Opportunities\n${(insights.insights?.commonOpportunities || []).map((o) => `• ${o}`).join("\n")}\n\n# Most Active Project\n${insights.mostActiveProject ? `${insights.mostActiveProject.title} — ${insights.mostActiveProject.noteCount} agent actions this week` : "No activity yet"}\n\n# Top Agents This Week\n${(insights.topAgents || []).map((a) => `• ${a.name}: ${a.count} actions`).join("\n")}\n\n# Stats\nProjects: ${insights.stats?.totalProjects}\nWar Room runs this week: ${insights.stats?.warRoomRunsThisWeek}`;
                openModal({
                  title: "Jarvis Full Insights Report",
                  body: fullReport,
                  actions: [{ label: "Close", onClick: closeModal }],
                });
              }}
              className="text-xs px-3 py-1 bg-jarvis-accent text-white rounded-lg hover:bg-jarvis-accent-hover transition-colors"
            >
              View Full Report →
            </button>
          </div>
        </div>

        {insightsLoading ? (
          <div className="text-center py-6 text-sm text-jarvis-muted animate-pulse">Analyzing your portfolio...</div>
        ) : !insights ? (
          <div className="text-center py-6 text-sm text-jarvis-muted">No insights available.</div>
        ) : (
          <>
            {/* Top 3 Insights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              {(insights.insights?.topInsights || []).slice(0, 3).map((ins, i) => (
                <div key={i} className="bg-jarvis-card border border-jarvis-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full bg-jarvis-accent/20 text-jarvis-accent flex items-center justify-center text-xs font-bold">{i + 1}</span>
                    <h4 className="text-xs font-semibold text-white truncate">{ins.title}</h4>
                  </div>
                  <p className="text-xs text-jarvis-muted leading-relaxed line-clamp-3">{ins.body}</p>
                </div>
              ))}
              {(insights.insights?.topInsights || []).length === 0 && (
                <div className="md:col-span-3 text-center py-4 text-xs text-jarvis-muted">
                  Run War Rooms or agent actions to generate insights.
                </div>
              )}
            </div>

            {/* Most Active Project + Agent of Week */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-jarvis-card border border-jarvis-border rounded-lg p-3">
                <div className="text-[10px] font-semibold text-jarvis-muted uppercase tracking-wider mb-1">Most Momentum</div>
                {insights.mostActiveProject ? (
                  <Link
                    href={`/ideas/${insights.mostActiveProject.id}`}
                    className="block hover:opacity-80 transition-opacity"
                  >
                    <div className="text-sm font-semibold text-white truncate">{insights.mostActiveProject.title}</div>
                    <div className="text-[11px] text-jarvis-accent">{insights.mostActiveProject.noteCount} agent actions this week</div>
                  </Link>
                ) : (
                  <div className="text-sm text-jarvis-muted">No project activity this week</div>
                )}
              </div>
              <div className="bg-jarvis-card border border-jarvis-border rounded-lg p-3">
                <div className="text-[10px] font-semibold text-jarvis-muted uppercase tracking-wider mb-1">Agent of the Week</div>
                {insights.agentOfWeek ? (
                  <>
                    <div className="text-sm font-semibold text-white truncate">{insights.agentOfWeek.name}</div>
                    <div className="text-[11px] text-jarvis-green">{insights.agentOfWeek.count} actions delivered</div>
                  </>
                ) : (
                  <div className="text-sm text-jarvis-muted">No agent activity yet</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Feed */}
        <div className="bg-jarvis-card border border-jarvis-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-jarvis-muted">Agent Activity</h3>
            <div className="flex items-center gap-2">
              {activity.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-jarvis-green/20 text-jarvis-green border border-jarvis-green/30 font-semibold">
                  {activity.length} action{activity.length !== 1 ? "s" : ""} today
                </span>
              )}
              <button onClick={fetchActivity} className="text-[10px] text-jarvis-muted hover:text-jarvis-accent transition-colors" title="Refresh">
                ↻
              </button>
            </div>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {activityLoading ? (
              <div className="text-center py-6 text-sm text-jarvis-muted animate-pulse">Loading activity...</div>
            ) : activity.length === 0 ? (
              <div className="text-center py-6 px-4">
                <p className="text-sm text-jarvis-muted mb-3">No agent activity in the last 24 hours</p>
                <button
                  onClick={() => setActiveTab("agents")}
                  className="text-xs px-3 py-1.5 bg-jarvis-accent/20 text-jarvis-accent rounded-lg hover:bg-jarvis-accent/30 transition-colors"
                >
                  Run Agents Now →
                </button>
              </div>
            ) : (
              activity.map((a) => (
                <button
                  key={a.id}
                  onClick={() => openModal({
                    title: `${a.agent}${a.action ? ` — ${a.action}` : ""}`,
                    body: `Project: ${a.project}\nWhen: ${timeAgo(a.created_at)}\n\n${a.preview}${a.preview.length >= 100 ? "..." : ""}`,
                    actions: [{ label: "View Project", onClick: () => { closeModal(); window.location.href = `/ideas/${a.project_id}`; } }, { label: "Close", onClick: closeModal }],
                  })}
                  className="flex gap-3 w-full text-left p-2 rounded-lg hover:bg-jarvis-border/50 transition-colors"
                >
                  <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-jarvis-accent" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-jarvis-text truncate">
                      <span className="font-semibold">{a.agent}</span>
                      {a.action && <span className="text-jarvis-muted"> — {a.action}</span>}
                    </div>
                    <div className="text-xs text-jarvis-muted truncate">{a.preview}</div>
                    <div className="text-[10px] text-jarvis-muted mt-0.5">
                      {a.project} &middot; {timeAgo(a.created_at)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Weather + Markets + Game */}
        <div className="space-y-6">
          <WeatherWidget openModal={openModal} />
          <MarketsWidget openModal={openModal} />
          <MotoTTT />
        </div>
      </div>
    </div>
  );
}

