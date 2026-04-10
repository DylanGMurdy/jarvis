"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { api } from "@/lib/api";
import type { Project, Goal, ChatMessage, Memory, MemoryCategory } from "@/lib/types";
import JarvisBrain from "@/components/JarvisBrain";
import type { MemoryForBrain } from "@/components/JarvisBrain";
import SpotifyWidget from "@/components/SpotifyWidget";
import LindyChat from "@/components/LindyChat";
import VoiceChatInput from "@/components/VoiceChatInput";
import dynamic from "next/dynamic";

const OrgChart = dynamic(() => import("@/components/OrgChart"), { ssr: false });

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement,
  Title, Tooltip, Legend, Filler
);

// ─── Types ────────────────────────────────────────────────
type Tab = "overview" | "ideas" | "agents" | "goals" | "memory";
type ModalData = { title: string; body: string; actions?: { label: string; onClick: () => void }[] } | null;

// ─── Static Data ──────────────────────────────────────────
const AGENTS = [
  { name: "Lead Nurture Bot", status: "active" as const, desc: "Monitoring 23 builder leads across 4 communities. Last engagement: 12 min ago. Sent 3 follow-ups today.", lastAction: "Sent follow-up to Ivory Homes lead #847" },
  { name: "Inbox Sentinel", status: "active" as const, desc: "Processing incoming emails, flagging priority items, drafting responses. 12 emails processed today, 3 flagged for review.", lastAction: "Flagged urgent email from broker" },
  { name: "Content Writer", status: "idle" as const, desc: "Ready to generate listing descriptions, social posts, and marketing copy. Last run: Yesterday, generated 4 listings.", lastAction: "Generated 4 listing descriptions" },
  { name: "Market Analyzer", status: "idle" as const, desc: "Tracks Utah County market data, inventory levels, and price trends. Next scheduled run: Tonight at 10pm.", lastAction: "Compiled weekly market report" },
  { name: "Scheduler", status: "active" as const, desc: "Managing calendar, coordinating showings, and protecting family time blocks. 2 showings scheduled this week.", lastAction: "Blocked family time 6-8pm" },
];

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

const ACTIVITY_FEED = [
  { time: "2 min ago", agent: "Lead Nurture Bot", action: "Sent personalized follow-up to Ivory Homes lead #847", type: "action" },
  { time: "15 min ago", agent: "Inbox Sentinel", action: "Flagged email from broker — contract amendment needs review", type: "alert" },
  { time: "32 min ago", agent: "Scheduler", action: "Protected family time block 6-8pm on calendar", type: "action" },
  { time: "1 hr ago", agent: "Lead Nurture Bot", action: "Qualified 2 new leads from Fieldstone Homes campaign", type: "success" },
  { time: "2 hrs ago", agent: "Market Analyzer", action: "Utah County median up 2.3% — report ready for review", type: "info" },
  { time: "3 hrs ago", agent: "Content Writer", action: "Drafted 4 new listing descriptions for review", type: "action" },
];

const MOODS = ["Fired Up", "Focused", "Tired", "Stressed", "Creative"];

const MEMORY_CATEGORIES: { key: MemoryCategory; label: string; color: string; icon: string }[] = [
  { key: "personal", label: "Personal", color: "bg-blue-500/20 text-blue-400", icon: "👤" },
  { key: "business", label: "Business", color: "bg-green-500/20 text-green-400", icon: "💼" },
  { key: "health", label: "Health", color: "bg-red-500/20 text-red-400", icon: "❤️" },
  { key: "goals", label: "Goals", color: "bg-yellow-500/20 text-yellow-400", icon: "🎯" },
  { key: "relationships", label: "Relationships", color: "bg-pink-500/20 text-pink-400", icon: "🤝" },
  { key: "preferences", label: "Preferences", color: "bg-purple-500/20 text-purple-400", icon: "⚙️" },
  { key: "ideas", label: "Ideas", color: "bg-cyan-500/20 text-cyan-400", icon: "💡" },
];

// ─── Component ────────────────────────────────────────────
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tasks, setTasks] = useState(TASKS_INIT);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [modal, setModal] = useState<ModalData>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [moodResponse, setMoodResponse] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [chatOpen, setChatOpen] = useState(false);

  // DB-backed state
  const [projects, setProjects] = useState<Project[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [ideaFilter, setIdeaFilter] = useState<string>("All");

  // Memory state
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoryFilter, setMemoryFilter] = useState<string>("all");
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [rememberCategory, setRememberCategory] = useState<MemoryCategory>("personal");
  const [showRememberModal, setShowRememberModal] = useState(false);
  const [rememberMessageIdx, setRememberMessageIdx] = useState<number>(-1);

  // Daily brief
  const [dailyBrief, setDailyBrief] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);

  const fetchMemories = useCallback(async () => {
    try {
      const res = await fetch("/api/memories");
      const data = await res.json();
      if (data.memories) setMemories(data.memories);
    } catch { /* Supabase may not be configured yet */ }
  }, []);

  useEffect(() => {
    async function loadData() {
      const [projectsData, goalsData] = await Promise.all([
        api.projects.list(),
        api.goals.list(),
      ]);
      setProjects(projectsData);
      setGoals(goalsData);
      fetchMemories();

      // Auto-generate daily brief on load
      try {
        const res = await fetch("/api/brief");
        const data = await res.json();
        if (data.brief) setDailyBrief(data.brief);
      } catch { /* silent */ }
    }
    loadData();
  }, [fetchMemories]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const extractMemories = useCallback(async (msgs: ChatMessage[]) => {
    if (msgs.length < 4) return; // Only extract after meaningful conversation
    try {
      await fetch("/api/memories/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs }),
      });
      fetchMemories(); // Refresh memory list
    } catch { /* silent — extraction is best-effort */ }
  }, [fetchMemories]);

  const saveMemory = useCallback(async (fact: string, category: MemoryCategory, source: string = "manual") => {
    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fact, category, source, confidence: 1.0 }),
      });
      const data = await res.json();
      if (data.memory) {
        setMemories((prev) => [data.memory, ...prev]);
      }
      return data.memory;
    } catch { return null; }
  }, []);

  const deleteMemory = useCallback(async (id: string) => {
    try {
      await fetch("/api/memories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch { /* silent */ }
  }, []);

  const sendChat = useCallback(async (text?: string) => {
    const msg = text || chatInput.trim();
    if (!msg) return;
    const newMessages: ChatMessage[] = [...chatMessages, { role: "user", content: msg }];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      setChatMessages([...newMessages, { role: "assistant", content: data.response }]);

      // Refresh memories after a few exchanges (API auto-extracts)
      if (newMessages.length % 6 === 0) {
        fetchMemories();
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Connection error. Standing by, sir." }]);
    }
    setChatLoading(false);
  }, [chatInput, chatMessages, fetchMemories]);

  const handleMood = (mood: string) => {
    setSelectedMood(mood);
    const responses: Record<string, string> = {
      "Fired Up": "That's the energy, sir. Channel it into your highest-leverage task right now. What's the ONE thing that moves the needle most today?",
      "Focused": "Perfect state for deep work. I'd recommend spending this focus block on AI Lead Nurture MVP — that's your ticket to first revenue.",
      "Tired": "Understood, sir. On tired days, handle quick wins: clear inbox, review leads, update CRM. Save the heavy building for when you're sharp.",
      "Stressed": "I've got your back, sir. Let's triage: what's the biggest weight right now? Let's name it and break it into 3 small steps.",
      "Creative": "Creative mode activated. This is prime time for product ideation and building. Fire up the editor — let's make something people will pay for.",
    };
    setMoodResponse(responses[mood] || "Noted. Let's make the most of today.");
  };

  const toggleTask = (id: number) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const openModal = (data: ModalData) => setModal(data);
  const closeModal = () => setModal(null);

  const getSuggestedPrompts = (): string[] => {
    const lastMsg = chatMessages[chatMessages.length - 1];
    if (!lastMsg) return ["What should I focus on today?", "Give me a status report", "Help me scope the AI Lead Nurture MVP", "What's my 90-day progress looking like?"];
    const text = lastMsg.content.toLowerCase();
    if (text.includes("lead") || text.includes("nurture")) return ["What features should the MVP have?", "Who are my first target customers?", "Draft a cold outreach email to builders", "What's the pricing strategy?"];
    if (text.includes("goal") || text.includes("progress") || text.includes("90")) return ["What's blocking me right now?", "Recalculate my timeline", "What should I deprioritize?", "Give me a weekly action plan"];
    if (text.includes("revenue") || text.includes("money") || text.includes("pricing")) return ["What's the fastest path to $1k/mo?", "Compare my ideas by revenue potential", "Help me set pricing for builders", "Draft a sales pitch"];
    return ["What's the highest leverage thing I can do right now?", "Analyze my AI ideas pipeline", "Help me plan tonight's coding session", "Draft a builder outreach strategy"];
  };

  // ── Subcomponents ─────────────────────────────────────────

  const StatusDot = ({ status }: { status: "active" | "idle" | "error" }) => (
    <span className={`inline-block w-2 h-2 rounded-full ${status === "active" ? "bg-jarvis-green animate-[pulse-dot_2s_ease-in-out_infinite]" : status === "idle" ? "bg-jarvis-yellow" : "bg-jarvis-red"}`} />
  );

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

  const GradeTag = ({ grade }: { grade: "A" | "B" | "C" }) => {
    const colors = { A: "bg-jarvis-green/20 text-jarvis-green", B: "bg-jarvis-yellow/20 text-jarvis-yellow", C: "bg-jarvis-orange/20 text-jarvis-orange" };
    return <span className={`px-2 py-0.5 rounded text-xs font-bold ${colors[grade]}`}>Grade {grade}</span>;
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
      Idea: "bg-jarvis-muted/20 text-jarvis-muted",
      Planning: "bg-jarvis-yellow/20 text-jarvis-yellow",
      Building: "bg-jarvis-accent/20 text-jarvis-accent",
      Launched: "bg-jarvis-green/20 text-jarvis-green",
      Revenue: "bg-jarvis-cyan/20 text-jarvis-cyan",
    };
    return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${colors[status] || "bg-jarvis-border text-jarvis-muted"}`}>{status}</span>;
  };

  const CategoryBadge = ({ category }: { category: string }) => {
    const colors: Record<string, string> = {
      "AI Business": "bg-purple-500/20 text-purple-400",
      "Real Estate": "bg-blue-500/20 text-blue-400",
      "Side Hustles": "bg-orange-500/20 text-orange-400",
      Personal: "bg-green-500/20 text-green-400",
    };
    return <span className={`px-2 py-0.5 rounded text-xs ${colors[category] || "bg-jarvis-border text-jarvis-muted"}`}>{category}</span>;
  };

  // ── Tab Content ─────────────────────────────────────────

  const renderOverview = () => (
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
      {!dailyBrief && !briefLoading && (
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
          className="w-full bg-jarvis-card border border-jarvis-border rounded-xl p-3 text-sm text-jarvis-muted hover:text-jarvis-accent hover:border-jarvis-accent/30 transition-all text-center"
        >
          Generate Daily Brief
        </button>
      )}
      {briefLoading && (
        <div className="bg-jarvis-card border border-jarvis-border rounded-xl p-4 text-center">
          <div className="text-sm text-jarvis-muted animate-pulse">JARVIS is preparing your brief...</div>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Emails Processed" value="47" sub="+12 today" icon="📧" onClick={() => openModal({ title: "Email Processing", body: "47 emails processed this week.\n\n12 today:\n- 3 flagged for review\n- 5 auto-responded\n- 4 archived", actions: [{ label: "Review Flagged", onClick: closeModal }] })} />
        <KPICard label="Active Leads" value="23" sub="3 hot prospects" icon="🎯" onClick={() => openModal({ title: "Lead Pipeline", body: "23 active leads across builders:\n\nHot (3):\n- Sarah M. — Ivory Homes\n- Mike R. — Fieldstone\n- Jennifer L. — Ivory Homes\n\nWarm (8): Regular engagement\nCold (12): Need re-engagement", actions: [{ label: "View Hot Leads", onClick: closeModal }] })} />
        <KPICard label="AI Projects" value={String(projects.length)} sub={`${projects.filter((p) => p.grade === "A").length} Grade A`} icon="💡" onClick={() => setActiveTab("ideas")} />
        <KPICard label="Days to Goal" value="67" sub="90-day sprint" icon="📅" onClick={() => setActiveTab("goals")} />
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
                  Open in Ideas Lab →
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
                  {t.done && <span className="text-white text-xs">✓</span>}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Feed */}
        <div className="bg-jarvis-card border border-jarvis-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-jarvis-muted mb-3">Agent Activity</h3>
          <div className="space-y-3">
            {ACTIVITY_FEED.map((a, i) => (
              <button key={i} onClick={() => openModal({ title: `${a.agent} Activity`, body: `Time: ${a.time}\nAgent: ${a.agent}\nAction: ${a.action}\nType: ${a.type}`, actions: [{ label: "View Details", onClick: closeModal }, { label: "Pause Agent", onClick: closeModal }] })} className="flex gap-3 w-full text-left p-2 rounded-lg hover:bg-jarvis-border/50 transition-colors">
                <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${a.type === "alert" ? "bg-jarvis-red" : a.type === "success" ? "bg-jarvis-green" : "bg-jarvis-accent"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-jarvis-text">{a.action}</div>
                  <div className="text-xs text-jarvis-muted">{a.agent} · {a.time}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Spotify + Weather + Markets + Game */}
        <div className="space-y-6">
          <SpotifyWidget />
          <WeatherWidget openModal={openModal} />
          <MarketsWidget openModal={openModal} />
          <MotoTTT />
        </div>
      </div>
    </div>
  );

  const filteredProjects = ideaFilter === "All" ? projects : projects.filter((p) => p.category === ideaFilter);

  const renderIdeas = () => (
    <div className="space-y-4 animate-[slideUp_0.3s_ease-out]">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Ideas Lab</h2>
        <button onClick={() => openModal({ title: "Add New Project", body: "Coming soon — new project creation form.", actions: [{ label: "Close", onClick: closeModal }] })} className="px-3 py-1.5 bg-jarvis-accent text-white rounded-lg text-sm hover:bg-jarvis-accent-hover transition-colors">
          + New Project
        </button>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {["All", "AI Business", "Real Estate", "Side Hustles", "Personal"].map((cat) => (
          <button key={cat} onClick={() => setIdeaFilter(cat)} className={`px-3 py-1.5 rounded-lg text-sm transition-all ${ideaFilter === cat ? "bg-jarvis-accent text-white" : "bg-jarvis-border text-jarvis-muted hover:text-jarvis-text"}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Project Cards */}
      <div className="space-y-3">
        {filteredProjects.map((project) => (
          <Link key={project.id} href={`/ideas/${project.id}`} className="block bg-jarvis-card border border-jarvis-border rounded-xl p-4 hover:border-jarvis-accent/50 transition-all cursor-pointer group">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-white group-hover:text-jarvis-accent transition-colors">{project.title}</h3>
                  <GradeTag grade={project.grade} />
                </div>
                <p className="text-xs text-jarvis-muted line-clamp-1">{project.description}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                <CategoryBadge category={project.category} />
                <StatusBadge status={project.status} />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-jarvis-muted">Progress</span>
                <span className="text-xs text-jarvis-accent">{project.progress}%</span>
              </div>
              <div className="w-full bg-jarvis-border rounded-full h-1.5">
                <div className="bg-jarvis-accent rounded-full h-1.5 transition-all" style={{ width: `${project.progress}%` }} />
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-jarvis-border">
              <span className="text-xs text-jarvis-muted">Revenue: {project.revenue_goal}</span>
              <span className="text-xs text-jarvis-accent group-hover:translate-x-1 transition-transform">Open →</span>
            </div>
          </Link>
        ))}
        {filteredProjects.length === 0 && (
          <div className="text-center py-8 text-jarvis-muted text-sm">No projects in this category yet.</div>
        )}
      </div>
    </div>
  );

  const renderAgents = () => (
    <div className="space-y-6 animate-[slideUp_0.3s_ease-out]">
      {/* Org Chart */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold">Organization</h2>
            <p className="text-xs text-jarvis-muted">Click nodes for details. Drag to reorganize.</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-jarvis-muted">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-jarvis-green" /> 2 Active</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-jarvis-yellow" /> 1 In Dev</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-jarvis-accent" /> 2 Planning</span>
          </div>
        </div>
        <OrgChart />
      </div>

      {/* Agent Fleet List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-jarvis-muted">Agent Activity</h3>
          <div className="flex items-center gap-2 text-xs text-jarvis-muted">
            <StatusDot status="active" /> {AGENTS.filter((a) => a.status === "active").length} Active
            <StatusDot status="idle" /> {AGENTS.filter((a) => a.status === "idle").length} Idle
          </div>
        </div>
        <div className="space-y-2">
          {AGENTS.map((agent, i) => (
            <button key={i} onClick={() => openModal({ title: agent.name, body: `Status: ${agent.status.toUpperCase()}\n\n${agent.desc}\n\nLast Action: ${agent.lastAction}`, actions: [{ label: agent.status === "active" ? "Pause Agent" : "Activate Agent", onClick: closeModal }, { label: "View Logs", onClick: closeModal }, { label: "Configure", onClick: closeModal }] })} className="w-full bg-jarvis-card border border-jarvis-border rounded-xl p-4 text-left hover:border-jarvis-accent/50 transition-all cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusDot status={agent.status} />
                  <div>
                    <h3 className="font-semibold text-white">{agent.name}</h3>
                    <p className="text-xs text-jarvis-muted mt-0.5">{agent.lastAction}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${agent.status === "active" ? "bg-jarvis-green/20 text-jarvis-green" : "bg-jarvis-yellow/20 text-jarvis-yellow"}`}>{agent.status}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderGoals = () => (
    <div className="space-y-6 animate-[slideUp_0.3s_ease-out]">
      <h2 className="text-lg font-bold">90-Day Goal Tracker</h2>

      {/* Goal Cards */}
      <div className="space-y-3">
        {goals.map((g) => (
          <Link key={g.id} href={`/goals/${g.id}`} className="block bg-jarvis-card border border-jarvis-border rounded-xl p-4 hover:border-jarvis-accent/50 transition-all cursor-pointer group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white group-hover:text-jarvis-accent transition-colors">{g.title}</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-jarvis-border text-jarvis-muted">{g.category}</span>
              </div>
              <span className="text-sm font-bold text-jarvis-accent">{g.progress}%</span>
            </div>
            <div className="w-full bg-jarvis-border rounded-full h-2 mb-2">
              <div className="bg-jarvis-accent rounded-full h-2 transition-all" style={{ width: `${g.progress}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-jarvis-muted">{g.target}</p>
              <span className="text-xs text-jarvis-accent group-hover:translate-x-1 transition-transform">Open →</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Bar Chart */}
      <div className="bg-jarvis-card border border-jarvis-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-jarvis-muted mb-4">Goal Progress Overview</h3>
        <div className="h-64">
          <Bar
            data={{
              labels: goals.map((g) => g.title.split(" ").slice(0, 3).join(" ")),
              datasets: [{
                label: "Progress %",
                data: goals.map((g) => g.progress),
                backgroundColor: ["#6366f1", "#818cf8", "#6366f1", "#818cf8"],
                borderRadius: 6,
              }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                y: { max: 100, grid: { color: "#1e1e2e" }, ticks: { color: "#64748b" } },
                x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 11 } } },
              },
            }}
          />
        </div>
      </div>
    </div>
  );

  const filteredMemories = memoryFilter === "all" ? memories : memories.filter((m) => m.category === memoryFilter);

  const memoryCounts = memories.reduce<Record<string, number>>((acc, m) => {
    acc[m.category] = (acc[m.category] || 0) + 1;
    return acc;
  }, {});

  const renderMemory = () => (
    <div className="space-y-4 animate-[slideUp_0.3s_ease-out]">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold">JARVIS Memory Bank</h2>
          <p className="text-xs text-jarvis-muted">{memories.length} memories stored across {Object.keys(memoryCounts).length} categories</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setRememberMessageIdx(-1);
              setShowRememberModal(true);
            }}
            className="px-3 py-1.5 bg-jarvis-accent text-white rounded-lg text-sm hover:bg-jarvis-accent-hover transition-colors"
          >
            + Add Memory
          </button>
          <button
            onClick={async () => {
              setMemoryLoading(true);
              if (chatMessages.length >= 2) {
                await extractMemories(chatMessages);
              }
              setMemoryLoading(false);
            }}
            disabled={memoryLoading || chatMessages.length < 2}
            className="px-3 py-1.5 bg-jarvis-border text-jarvis-text rounded-lg text-sm hover:bg-jarvis-accent/20 transition-colors disabled:opacity-50"
          >
            {memoryLoading ? "Extracting..." : "Extract from Chat"}
          </button>
        </div>
      </div>

      {/* Category Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {MEMORY_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setMemoryFilter(memoryFilter === cat.key ? "all" : cat.key)}
            className={`p-3 rounded-xl border transition-all text-left ${
              memoryFilter === cat.key
                ? "bg-jarvis-accent/20 border-jarvis-accent/50"
                : "bg-jarvis-card border-jarvis-border hover:border-jarvis-accent/30"
            }`}
          >
            <div className="text-lg mb-1">{cat.icon}</div>
            <div className="text-xs font-semibold text-jarvis-text">{cat.label}</div>
            <div className="text-lg font-bold text-white">{memoryCounts[cat.key] || 0}</div>
          </button>
        ))}
      </div>

      {/* Jarvis Brain — Live */}
      <div className="bg-jarvis-card border border-jarvis-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold text-white">Jarvis Brain</h3>
            <p className="text-xs text-jarvis-muted">live knowledge graph — grows as you teach it</p>
          </div>
          <span className="text-xs text-jarvis-muted">{memories.length + 4} nodes</span>
        </div>
        <div className="h-[350px] rounded-lg overflow-hidden">
          <JarvisBrain memories={memories as MemoryForBrain[]} onNodeClick={(node) => {
            if (node.id.startsWith("cat-")) {
              setMemoryFilter(node.type);
            }
          }} />
        </div>
      </div>

      {/* Memory List */}
      <div className="space-y-2">
        {filteredMemories.length === 0 && (
          <div className="text-center py-12 text-jarvis-muted">
            <div className="text-4xl mb-3">🧠</div>
            <p className="text-sm">{memories.length === 0 ? "No memories yet. Start chatting with JARVIS or add memories manually." : "No memories in this category."}</p>
          </div>
        )}
        {filteredMemories.map((mem) => {
          const catInfo = MEMORY_CATEGORIES.find((c) => c.key === mem.category);
          return (
            <div key={mem.id} className="bg-jarvis-card border border-jarvis-border rounded-xl p-4 hover:border-jarvis-accent/30 transition-all group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded ${catInfo?.color || "bg-jarvis-border text-jarvis-muted"}`}>
                      {catInfo?.icon} {catInfo?.label || mem.category}
                    </span>
                    <span className="text-xs text-jarvis-muted">
                      {new Date(mem.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      mem.source === "manual" ? "bg-jarvis-accent/20 text-jarvis-accent" :
                      mem.source === "chat_extraction" ? "bg-jarvis-green/20 text-jarvis-green" :
                      "bg-jarvis-border text-jarvis-muted"
                    }`}>
                      {mem.source === "manual" ? "manual" : mem.source === "chat_extraction" ? "auto" : mem.source}
                    </span>
                  </div>
                  <p className="text-sm text-jarvis-text">{mem.fact}</p>
                </div>
                <button
                  onClick={() => deleteMemory(mem.id)}
                  className="text-jarvis-muted hover:text-jarvis-red transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 p-1"
                  title="Delete memory"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const tabContent: Record<Tab, () => React.ReactNode> = {
    overview: renderOverview,
    ideas: renderIdeas,
    agents: renderAgents,
    goals: renderGoals,
    memory: renderMemory,
  };

  const TAB_LIST: { key: Tab; label: string; icon: string }[] = [
    { key: "overview", label: "Overview", icon: "⌘" },
    { key: "ideas", label: "Ideas Lab", icon: "💡" },
    { key: "agents", label: "Agents", icon: "🤖" },
    { key: "goals", label: "90-Day Goals", icon: "🎯" },
    { key: "memory", label: "Memory", icon: "🧠" },
  ];

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
    <div className="flex h-screen overflow-hidden">
      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
        </div>
      )}

      {/* Sidebar — hidden on mobile, slide-in when menu open */}
      <aside className={`${sidebarCollapsed ? "w-16" : "w-56"} bg-jarvis-card border-r border-jarvis-border flex-col transition-all flex-shrink-0 hidden md:flex`}>
        <div className="p-4 border-b border-jarvis-border">
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="flex items-center gap-2 w-full">
            <div className="w-8 h-8 bg-jarvis-accent rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">J</div>
            {!sidebarCollapsed && <span className="font-bold text-white">JARVIS</span>}
          </button>
        </div>
        <div className="p-3 border-b border-jarvis-border">
          {!sidebarCollapsed && <div className="text-xs text-jarvis-muted mb-2 font-semibold">AGENTS</div>}
          <div className="space-y-2">
            {AGENTS.map((a, i) => (
              <button key={i} onClick={() => { setActiveTab("agents"); openModal({ title: a.name, body: `Status: ${a.status.toUpperCase()}\n\n${a.desc}\n\nLast Action: ${a.lastAction}`, actions: [{ label: a.status === "active" ? "Pause" : "Activate", onClick: closeModal }] }); }} className="flex items-center gap-2 w-full text-left hover:bg-jarvis-border/50 p-1 rounded transition-colors">
                <StatusDot status={a.status} />
                {!sidebarCollapsed && <span className="text-xs text-jarvis-text truncate">{a.name}</span>}
              </button>
            ))}
          </div>
        </div>
        {!sidebarCollapsed && (
          <div className="p-3 border-b border-jarvis-border">
            <div className="text-xs text-jarvis-muted mb-2 font-semibold">QUICK ACTIONS</div>
            <div className="space-y-1">
              {[
                { label: "Status Report", action: () => sendChat("Give me a full status report on all agents and goals") },
                { label: "Top Priority", action: () => sendChat("What's my #1 priority right now?") },
                { label: "Builder Leads", action: () => sendChat("Analyze my builder lead pipeline and suggest next steps") },
                { label: "Vibe Plan", action: () => sendChat("Help me plan tonight's vibe coding session") },
              ].map((btn, i) => (
                <button key={i} onClick={btn.action} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-jarvis-accent/20 text-jarvis-text hover:text-jarvis-accent transition-colors">
                  → {btn.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {!sidebarCollapsed && (
          <div className="p-3 mt-auto border-t border-jarvis-border">
            <div className="text-xs text-jarvis-muted mb-2 font-semibold">MEMORY</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-jarvis-text"><span>Memories</span><span className="text-jarvis-accent">{memories.length}</span></div>
              <div className="flex justify-between text-jarvis-text"><span>Projects</span><span className="text-jarvis-accent">{projects.length}</span></div>
              <div className="flex justify-between text-jarvis-text"><span>Goals</span><span className="text-jarvis-accent">{goals.length}</span></div>
              <div className="flex justify-between text-jarvis-text"><span>Chat History</span><span className="text-jarvis-accent">{chatMessages.length}</span></div>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile sidebar (slide-in) */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-jarvis-card border-r border-jarvis-border flex flex-col transition-transform duration-300 md:hidden ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-4 border-b border-jarvis-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-jarvis-accent rounded-lg flex items-center justify-center text-white font-bold text-sm">J</div>
            <span className="font-bold text-white">JARVIS</span>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="text-jarvis-muted hover:text-white text-xl p-1">×</button>
        </div>
        <div className="p-3 border-b border-jarvis-border">
          <div className="text-xs text-jarvis-muted mb-2 font-semibold">AGENTS</div>
          <div className="space-y-2">
            {AGENTS.map((a, i) => (
              <button key={i} onClick={() => { setActiveTab("agents"); setMobileMenuOpen(false); }} className="flex items-center gap-2 w-full text-left hover:bg-jarvis-border/50 p-1.5 rounded transition-colors">
                <StatusDot status={a.status} />
                <span className="text-sm text-jarvis-text truncate">{a.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="p-3 border-b border-jarvis-border">
          <div className="text-xs text-jarvis-muted mb-2 font-semibold">QUICK ACTIONS</div>
          <div className="space-y-1">
            {[
              { label: "Status Report", action: () => sendChat("Give me a full status report on all agents and goals") },
              { label: "Top Priority", action: () => sendChat("What's my #1 priority right now?") },
              { label: "Builder Leads", action: () => sendChat("Analyze my builder lead pipeline and suggest next steps") },
              { label: "Vibe Plan", action: () => sendChat("Help me plan tonight's vibe coding session") },
            ].map((btn, i) => (
              <button key={i} onClick={() => { btn.action(); setMobileMenuOpen(false); setChatOpen(true); }} className="w-full text-left text-sm px-2 py-2 rounded hover:bg-jarvis-accent/20 text-jarvis-text hover:text-jarvis-accent transition-colors">
                → {btn.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-3 mt-auto border-t border-jarvis-border">
          <div className="text-xs text-jarvis-muted mb-2 font-semibold">MEMORY</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-jarvis-text"><span>Projects</span><span className="text-jarvis-accent">{projects.length}</span></div>
            <div className="flex justify-between text-jarvis-text"><span>Goals</span><span className="text-jarvis-accent">{goals.length}</span></div>
            <div className="flex justify-between text-jarvis-text"><span>Chat</span><span className="text-jarvis-accent">{chatMessages.length}</span></div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top nav bar */}
        <nav className="bg-jarvis-card border-b border-jarvis-border px-2 md:px-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center">
            {/* Hamburger menu — mobile only */}
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 mr-1 text-jarvis-muted hover:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
            </button>
            {/* Tabs — scrollable on mobile */}
            <div className="flex overflow-x-auto no-scrollbar">
              {TAB_LIST.map((tab) => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`px-3 md:px-4 py-3 text-xs md:text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === tab.key ? "text-jarvis-accent" : "text-jarvis-muted hover:text-jarvis-text"}`}>
                  <span className="mr-1">{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                  {activeTab === tab.key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-jarvis-accent" />}
                </button>
              ))}
            </div>
          </div>
          {/* Show/Hide chat — desktop only */}
          <button onClick={() => setChatOpen(!chatOpen)} className="hidden md:block text-sm text-jarvis-muted hover:text-jarvis-accent transition-colors px-3 py-1 rounded-lg hover:bg-jarvis-border/50">
            {chatOpen ? "Hide Chat" : "Show Chat"}
          </button>
        </nav>

        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {tabContent[activeTab]()}
          </main>

          {/* Chat panel — desktop sidebar */}
          {chatOpen && (
            <aside className="hidden md:flex w-96 bg-jarvis-card border-l border-jarvis-border flex-col flex-shrink-0">
              <div className="p-3 border-b border-jarvis-border flex items-center gap-2">
                <div className="w-6 h-6 bg-jarvis-accent rounded-full flex items-center justify-center text-white text-xs font-bold">J</div>
                <span className="text-sm font-semibold text-white">JARVIS Chat</span>
                <StatusDot status="active" />
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-3xl mb-2">🤖</div>
                    <p className="text-sm text-jarvis-muted">Good evening, sir. How can I help?</p>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} group/msg`}>
                    <div className="relative max-w-[85%]">
                      <div className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${msg.role === "user" ? "bg-jarvis-accent text-white" : "bg-jarvis-border text-jarvis-text"}`}>
                        {msg.content}
                      </div>
                      <button
                        onClick={() => { setRememberMessageIdx(i); setShowRememberModal(true); }}
                        className="absolute -bottom-1 right-1 opacity-0 group-hover/msg:opacity-100 transition-opacity text-xs px-1.5 py-0.5 rounded bg-jarvis-card border border-jarvis-border text-jarvis-muted hover:text-jarvis-accent"
                        title="Remember this"
                      >
                        🧠
                      </button>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-jarvis-border rounded-xl px-3 py-2 text-sm text-jarvis-muted">Thinking...</div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="px-3 py-2 border-t border-jarvis-border">
                <div className="flex flex-wrap gap-1.5">
                  {getSuggestedPrompts().map((p, i) => (
                    <button key={i} onClick={() => sendChat(p)} className="text-xs px-2 py-1 rounded-lg bg-jarvis-border text-jarvis-muted hover:text-jarvis-accent hover:bg-jarvis-accent/10 transition-colors">{p}</button>
                  ))}
                </div>
              </div>
              <div className="p-3 border-t border-jarvis-border">
                <VoiceChatInput
                  value={chatInput}
                  onChange={setChatInput}
                  onSend={() => sendChat()}
                  disabled={chatLoading}
                  variant="panel"
                />
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Modal — desktop */}
      {modal && (
        <div className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div onClick={(e) => e.stopPropagation()} className="bg-jarvis-card border border-jarvis-border rounded-xl p-5 md:p-6 max-w-lg w-full animate-[slideUp_0.3s_ease-out] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">{modal.title}</h2>
              <button onClick={closeModal} className="text-jarvis-muted hover:text-white text-xl p-1">×</button>
            </div>
            <div className="text-sm text-jarvis-text whitespace-pre-wrap mb-4">{modal.body}</div>
            {modal.actions && (
              <div className="flex flex-wrap gap-2">
                {modal.actions.map((a, i) => (
                  <button key={i} onClick={a.onClick} className={`px-4 py-2.5 rounded-lg text-sm transition-colors ${i === 0 ? "bg-jarvis-accent text-white hover:bg-jarvis-accent-hover" : "bg-jarvis-border text-jarvis-text hover:bg-jarvis-accent/20"}`}>{a.label}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>

    {/* ─── MOBILE OVERLAYS (outside overflow-hidden container) ─── */}

    {/* Mobile chat — full screen overlay */}
    {chatOpen && (
      <div className="fixed inset-0 z-[60] bg-jarvis-bg flex flex-col md:hidden">
        <div className="p-3 border-b border-jarvis-border flex items-center justify-between flex-shrink-0 bg-jarvis-card">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-jarvis-accent rounded-full flex items-center justify-center text-white text-xs font-bold">J</div>
            <span className="text-sm font-semibold text-white">JARVIS</span>
            <StatusDot status="active" />
          </div>
          <button onClick={() => setChatOpen(false)} className="text-jarvis-muted hover:text-white text-2xl p-2 -mr-1">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {chatMessages.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🤖</div>
              <p className="text-base text-jarvis-muted mb-4">How can I help, sir?</p>
              <div className="flex flex-wrap gap-2 justify-center px-4">
                {getSuggestedPrompts().map((p, i) => (
                  <button key={i} onClick={() => sendChat(p)} className="text-sm px-3 py-2 rounded-xl bg-jarvis-card border border-jarvis-border text-jarvis-muted active:text-jarvis-accent active:border-jarvis-accent/50 transition-colors">{p}</button>
                ))}
              </div>
            </div>
          )}
          {chatMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="relative max-w-[85%]">
                <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${msg.role === "user" ? "bg-jarvis-accent text-white" : "bg-jarvis-card border border-jarvis-border text-jarvis-text"}`}>
                  {msg.content}
                </div>
                <button
                  onClick={() => { setRememberMessageIdx(i); setShowRememberModal(true); }}
                  className="absolute -bottom-1 right-1 text-xs px-2 py-1 rounded bg-jarvis-card border border-jarvis-border text-jarvis-muted active:text-jarvis-accent"
                  title="Remember this"
                >
                  🧠
                </button>
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="bg-jarvis-card border border-jarvis-border rounded-2xl px-4 py-2.5 text-sm text-jarvis-muted">Thinking...</div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {chatMessages.length > 0 && (
          <div className="px-3 py-2 border-t border-jarvis-border flex-shrink-0 overflow-x-auto">
            <div className="flex gap-2 no-scrollbar">
              {getSuggestedPrompts().map((p, i) => (
                <button key={i} onClick={() => sendChat(p)} className="text-xs px-3 py-1.5 rounded-full bg-jarvis-card border border-jarvis-border text-jarvis-muted active:text-jarvis-accent whitespace-nowrap flex-shrink-0">{p}</button>
              ))}
            </div>
          </div>
        )}

        <div className="p-3 border-t border-jarvis-border flex-shrink-0 bg-jarvis-card safe-area-bottom">
          <VoiceChatInput
            value={chatInput}
            onChange={setChatInput}
            onSend={() => sendChat()}
            disabled={chatLoading}
            variant="full"
          />
        </div>
      </div>
    )}

    {/* Remember This Modal */}
    {showRememberModal && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={() => setShowRememberModal(false)}>
        <div className="absolute inset-0 bg-black/60" />
        <div onClick={(e) => e.stopPropagation()} className="relative bg-jarvis-card border border-jarvis-border rounded-xl p-5 max-w-md w-full animate-[slideUp_0.3s_ease-out]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">🧠 Remember This</h2>
            <button onClick={() => setShowRememberModal(false)} className="text-jarvis-muted hover:text-white text-xl p-1">×</button>
          </div>

          {rememberMessageIdx >= 0 && chatMessages[rememberMessageIdx] && (
            <div className="mb-3 p-3 bg-jarvis-bg rounded-lg text-sm text-jarvis-text border border-jarvis-border">
              <div className="text-xs text-jarvis-muted mb-1">{chatMessages[rememberMessageIdx].role === "user" ? "You said:" : "JARVIS said:"}</div>
              <div className="line-clamp-3">{chatMessages[rememberMessageIdx].content}</div>
            </div>
          )}

          <form onSubmit={async (e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const factInput = form.elements.namedItem("fact") as HTMLInputElement;
            const fact = factInput.value.trim();
            if (!fact) return;
            await saveMemory(fact, rememberCategory);
            setShowRememberModal(false);
            factInput.value = "";
          }}>
            <label className="block text-xs text-jarvis-muted mb-1">What should JARVIS remember?</label>
            <input
              name="fact"
              type="text"
              defaultValue={rememberMessageIdx >= 0 && chatMessages[rememberMessageIdx] ? chatMessages[rememberMessageIdx].content.slice(0, 200) : ""}
              className="w-full bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-2 text-sm text-jarvis-text placeholder:text-jarvis-muted focus:outline-none focus:border-jarvis-accent mb-3"
              placeholder="e.g. I prefer morning standups..."
              autoFocus
            />

            <label className="block text-xs text-jarvis-muted mb-1">Category</label>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {MEMORY_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setRememberCategory(cat.key)}
                  className={`text-xs px-2 py-1 rounded-lg transition-all ${
                    rememberCategory === cat.key
                      ? "bg-jarvis-accent text-white"
                      : "bg-jarvis-border text-jarvis-muted hover:text-jarvis-text"
                  }`}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button type="submit" className="flex-1 px-4 py-2.5 bg-jarvis-accent text-white rounded-lg text-sm hover:bg-jarvis-accent-hover transition-colors">
                Save Memory
              </button>
              <button type="button" onClick={() => setShowRememberModal(false)} className="px-4 py-2.5 bg-jarvis-border text-jarvis-text rounded-lg text-sm hover:bg-jarvis-accent/20 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* Floating chat button — mobile only */}
    {!chatOpen && (
      <div className="md:hidden fixed bottom-5 right-5 z-[55]">
        <button
          onTouchEnd={(e) => { e.preventDefault(); setChatOpen(true); }}
          className="w-14 h-14 bg-jarvis-accent rounded-full flex items-center justify-center shadow-lg shadow-jarvis-accent/30 active:scale-95 transition-transform"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
        </button>
      </div>
    )}
    </>
  );
}

// ─── Weather Widget ───────────────────────────────────────
function WeatherWidget({ openModal }: { openModal: (d: ModalData) => void }) {
  return (
    <button onClick={() => openModal({ title: "Weather — Eagle Mountain, UT", body: "Current: 52°F, Partly Cloudy\nHigh: 61°F | Low: 38°F\nWind: 8 mph NW\nHumidity: 34%\n\nForecast:\n- Tomorrow: 58°F, Sunny\n- Thursday: 63°F, Clear\n- Friday: 55°F, Chance of Rain\n- Saturday: 59°F, Partly Cloudy", actions: [{ label: "5-Day Forecast", onClick: () => {} }] })} className="w-full bg-jarvis-card border border-jarvis-border rounded-xl p-4 text-left hover:border-jarvis-accent/50 transition-all cursor-pointer">
      <h3 className="text-sm font-semibold text-jarvis-muted mb-2">Eagle Mountain, UT</h3>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-3xl font-bold text-white">52°F</div>
          <div className="text-sm text-jarvis-muted">Partly Cloudy</div>
        </div>
        <div className="text-right text-sm">
          <div className="text-jarvis-text">H: 61° L: 38°</div>
          <div className="text-jarvis-muted">Wind: 8 mph</div>
        </div>
      </div>
    </button>
  );
}

// ─── Markets Widget ───────────────────────────────────────
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
      <div className="h-24">
        <Line
          data={{
            labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
            datasets: [{
              data: [5180, 5210, 5195, 5230, 5248],
              borderColor: "#6366f1",
              backgroundColor: "rgba(99, 102, 241, 0.1)",
              fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2,
            }],
          }}
          options={{
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { display: false }, x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 10 } } } },
          }}
        />
      </div>
    </div>
  );
}

// ─── Moto Tic-Tac-Toe Widget ─────────────────────────────
const RIDER = "🏍️";
const HELMET = "⛑️";
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
      {/* Header */}
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

      {/* Status */}
      <div className={`text-center text-xs font-semibold mb-2 py-1.5 rounded-lg ${
        isOver
          ? isDraw
            ? "bg-jarvis-muted/10 text-jarvis-muted"
            : "bg-orange-500/10 text-orange-400"
          : "text-jarvis-muted"
      }`}>
        {isOver
          ? isDraw ? "🤝 Draw!" : `${winner} Wins!`
          : `${turn} ${turn === RIDER ? "Rider" : "Helmet"}'s turn`}
      </div>

      {/* Board */}
      <div className="grid grid-cols-3 gap-1 mb-3">
        {board.map((cell, i) => (
          <button
            key={i}
            onClick={() => play(i)}
            className={`aspect-square rounded-lg flex items-center justify-center text-2xl transition-all ${
              winCells.includes(i)
                ? "bg-orange-500/15 shadow-[inset_0_0_12px_rgba(249,115,22,0.3)]"
                : cell
                  ? "bg-jarvis-bg"
                  : isOver
                    ? "bg-jarvis-bg opacity-30"
                    : "bg-jarvis-bg hover:bg-jarvis-border cursor-pointer active:scale-90"
            }`}
          >
            {cell}
          </button>
        ))}
      </div>

      {/* Reset */}
      {isOver && (
        <button onClick={reset} className="w-full py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white hover:shadow-[0_2px_12px_rgba(249,115,22,0.3)] transition-all active:scale-[0.97]">
          New Round
        </button>
      )}
    </div>
  );
}
