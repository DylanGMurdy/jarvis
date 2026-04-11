"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Project, Goal, ChatMessage, Memory, MemoryCategory } from "@/lib/types";
import VoiceChatInput from "@/components/VoiceChatInput";
import BottomTabBar from "@/components/mobile/BottomTabBar";
import OverviewTab from "@/components/dashboard/OverviewTab";
import IdeasTab from "@/components/dashboard/IdeasTab";
import AgentsTab from "@/components/dashboard/AgentsTab";
import GoalsTab from "@/components/dashboard/GoalsTab";
import MemoryTab from "@/components/dashboard/MemoryTab";
import ChatHistoryTab from "@/components/dashboard/ChatHistoryTab";
import ApprovalsTab from "@/components/dashboard/ApprovalsTab";
import RevenueTab from "@/components/dashboard/RevenueTab";

// ─── Types ────────────────────────────────────────────────
type Tab = "overview" | "ideas" | "agents" | "goals" | "memory" | "history" | "approvals" | "revenue";
type ModalData = { title: string; body: string; actions?: { label: string; onClick: () => void }[] } | null;

const MEMORY_CATEGORIES: { key: MemoryCategory; label: string; color: string; icon: string }[] = [
  { key: "personal", label: "Personal", color: "bg-blue-500/20 text-blue-400", icon: "👤" },
  { key: "business", label: "Business", color: "bg-green-500/20 text-green-400", icon: "💼" },
  { key: "health", label: "Health", color: "bg-red-500/20 text-red-400", icon: "❤️" },
  { key: "goals", label: "Goals", color: "bg-yellow-500/20 text-yellow-400", icon: "🎯" },
  { key: "relationships", label: "Relationships", color: "bg-pink-500/20 text-pink-400", icon: "🤝" },
  { key: "preferences", label: "Preferences", color: "bg-purple-500/20 text-purple-400", icon: "⚙️" },
  { key: "ideas", label: "Ideas", color: "bg-cyan-500/20 text-cyan-400", icon: "💡" },
];

const AGENTS = [
  { name: "Lead Nurture Bot", status: "active" as const, desc: "Monitoring 23 builder leads across 4 communities.", lastAction: "Sent follow-up to Ivory Homes lead #847" },
  { name: "Inbox Sentinel", status: "active" as const, desc: "Processing incoming emails.", lastAction: "Flagged urgent email from broker" },
  { name: "Content Writer", status: "idle" as const, desc: "Ready to generate content.", lastAction: "Generated 4 listing descriptions" },
  { name: "Market Analyzer", status: "idle" as const, desc: "Tracks Utah County market data.", lastAction: "Compiled weekly market report" },
  { name: "Scheduler", status: "active" as const, desc: "Managing calendar.", lastAction: "Blocked family time 6-8pm" },
  { name: "CMO Agent", status: "active" as const, desc: "Market analysis, content strategy, growth channels, brand voice.", lastAction: "Generated market analysis for Lindy Agents" },
  { name: "CTO Agent", status: "active" as const, desc: "Tech stack, build roadmap, technical risks, MVP scope.", lastAction: "Defined MVP scope for Lindy Agents" },
  { name: "CLO Agent", status: "idle" as const, desc: "Legal risks, entity structure, contracts, compliance.", lastAction: "Awaiting first project analysis" },
  { name: "CHRO Agent", status: "idle" as const, desc: "Org structure, hiring, culture, compensation.", lastAction: "Awaiting first project analysis" },
  { name: "CSO Agent", status: "active" as const, desc: "Sales strategy, prospect list, outreach scripts, pricing.", lastAction: "Built GTM sales strategy for Lindy Agents" },
  { name: "VP of Sales", status: "active" as const, desc: "Pipeline design, objection handling, demo scripts, closing.", lastAction: "Created objection handling guide" },
  { name: "VP of Marketing", status: "idle" as const, desc: "Brand strategy, launch plans, marketing budget, campaign ideas.", lastAction: "Awaiting first project analysis" },
  { name: "Head of Growth", status: "idle" as const, desc: "Growth loops, acquisition channels, retention strategy, experiments.", lastAction: "Awaiting first project analysis" },
  { name: "SDR Agent", status: "active" as const, desc: "Cold outreach sequences, lead qualification, follow-ups, personalization.", lastAction: "Wrote 5-touch outreach for Lindy Agents" },
  { name: "Partnerships", status: "active" as const, desc: "Partnership targets, pitch decks, affiliate programs, integrations.", lastAction: "Identified 10 partnership targets" },
  { name: "VP Finance", status: "idle" as const, desc: "Financial models, cash flow, pricing analysis, investor metrics.", lastAction: "Awaiting first project analysis" },
  { name: "Data Analytics", status: "idle" as const, desc: "Metrics framework, dashboard design, data stack, A/B testing.", lastAction: "Awaiting first project analysis" },
  { name: "Head of Content", status: "active" as const, desc: "Content calendars, SEO strategy, content pillars, viral hooks.", lastAction: "Built content calendar for Lindy Agent Business" },
  { name: "Head of Design", status: "active" as const, desc: "Design systems, brand assets, UX principles, landing page copy.", lastAction: "Defined design system for Lindy Agent Business" },
];

const StatusDot = ({ status }: { status: "active" | "idle" | "error" }) => (
  <span className={`inline-block w-2 h-2 rounded-full ${status === "active" ? "bg-jarvis-green animate-[pulse-dot_2s_ease-in-out_infinite]" : status === "idle" ? "bg-jarvis-yellow" : "bg-jarvis-red"}`} />
);

// ─── Component ────────────────────────────────────────────
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatConversationId, setChatConversationId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalData>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [chatOpen, setChatOpen] = useState(false);

  // DB-backed state
  const [projects, setProjects] = useState<Project[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  // Memory state
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [rememberCategory, setRememberCategory] = useState<MemoryCategory>("personal");
  const [showRememberModal, setShowRememberModal] = useState(false);
  const [rememberMessageIdx, setRememberMessageIdx] = useState<number>(-1);
  const [memoryFilter, setMemoryFilter] = useState<string>("all");

  // Smart action buttons state
  const [showAddToProject, setShowAddToProject] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ type: string; message: string; link?: string } | null>(null);
  const [savedBookmarks, setSavedBookmarks] = useState<Set<number>>(new Set());

  // Voice pipeline state
  const [voiceProcessing, setVoiceProcessing] = useState(false);

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

      // Fetch pending approvals count
      try {
        const appRes = await fetch("/api/approvals");
        const appData = await appRes.json();
        setPendingApprovals((appData.data || []).length);
      } catch { /* silent */ }

      // Fetch pending approval count
      try {
        const appRes = await fetch("/api/approvals");
        const appData = await appRes.json();
        setPendingApprovals((appData.data || []).length);
      } catch { /* silent */ }

      // Load most recent global conversation so chat continues where you left off
      try {
        const chatData = await api.conversations.getLatestGlobal();
        if (chatData.messages?.length > 0) {
          setChatMessages(chatData.messages);
        }
        if (chatData.conversation?.id) {
          setChatConversationId(chatData.conversation.id);
        }
      } catch { /* silent */ }
    }
    loadData();
  }, [fetchMemories]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const extractMemories = useCallback(async (msgs: ChatMessage[]) => {
    if (msgs.length < 4) return;
    try {
      await fetch("/api/memories/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs }),
      });
      fetchMemories();
    } catch { /* silent */ }
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
      const data = await api.conversations.send(newMessages, chatConversationId || undefined);
      setChatMessages([...newMessages, { role: "assistant", content: data.response }]);
      if (data.conversationId && !chatConversationId) {
        setChatConversationId(data.conversationId);
      }
      if (newMessages.length % 6 === 0) {
        fetchMemories();
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Connection error. Standing by, sir." }]);
    }
    setChatLoading(false);
  }, [chatInput, chatMessages, chatConversationId, fetchMemories]);

  // ── Smart Action: Create New Idea from chat ──
  const handleNewIdea = useCallback(async () => {
    if (chatMessages.length < 3) return;
    setActionLoading("new-idea");
    setActionResult(null);
    try {
      const res = await fetch("/api/projects/create-from-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation: chatMessages }),
      });
      const data = await res.json();
      if (data.success) {
        setActionResult({ type: "success", message: `Created "${data.project.title}" in Ideas Lab`, link: `/ideas/${data.project.id}` });
        // Refresh projects
        const updatedProjects = await api.projects.list();
        setProjects(updatedProjects);
      } else {
        setActionResult({ type: "error", message: data.error || "Failed to create project" });
      }
    } catch {
      setActionResult({ type: "error", message: "Connection error" });
    }
    setActionLoading(null);
  }, [chatMessages]);

  // ── Smart Action: Add to existing project ──
  const handleAddToProject = useCallback(async (projectId: string) => {
    if (chatMessages.length < 2) return;
    setActionLoading("add-to-project");
    setActionResult(null);
    setShowAddToProject(false);
    try {
      const res = await fetch("/api/projects/create-from-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation: chatMessages, projectId }),
      });
      const data = await res.json();
      if (data.success) {
        setActionResult({ type: "success", message: `Added to "${data.projectTitle}" — ${data.tasksCreated} tasks, ${data.notesCreated} notes`, link: `/ideas/${projectId}` });
      } else {
        setActionResult({ type: "error", message: data.error || "Failed" });
      }
    } catch {
      setActionResult({ type: "error", message: "Connection error" });
    }
    setActionLoading(null);
  }, [chatMessages]);

  // ── Bookmark a message ──
  const handleBookmark = useCallback(async (msgIdx: number) => {
    const msg = chatMessages[msgIdx];
    if (!msg) return;
    try {
      await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fact: msg.content.slice(0, 500), category: "ideas", source: "highlight", confidence: 1.0 }),
      });
      setSavedBookmarks((prev) => new Set(prev).add(msgIdx));
      fetchMemories();
    } catch { /* silent */ }
  }, [chatMessages, fetchMemories]);

  // ── Voice Pipeline: analyze transcript and auto-route ──
  const handleVoicePipeline = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return;
    setVoiceProcessing(true);
    setChatLoading(true);

    // Add user message to chat
    const userMsg: ChatMessage = { role: "user", content: transcript };
    const updated = [...chatMessages, userMsg];
    setChatMessages(updated);

    try {
      const res = await fetch("/api/chat/analyze-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const analysis = await res.json();

      if (analysis.type === "existing_project" && analysis.projectMatch) {
        // Route to existing project
        const addRes = await fetch("/api/projects/create-from-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversation: [userMsg], projectId: analysis.projectMatch }),
        });
        const addData = await addRes.json();
        const routeMsg = addData.success
          ? `${analysis.response}\n\nI added ${addData.tasksCreated} task${addData.tasksCreated !== 1 ? "s" : ""} to ${analysis.projectMatchTitle} →`
          : analysis.response;
        setChatMessages([...updated, { role: "assistant", content: routeMsg }]);
        setActionResult({ type: "success", message: `Routed to "${analysis.projectMatchTitle}"`, link: `/ideas/${analysis.projectMatch}` });
      } else if (analysis.type === "new_idea") {
        // Create new project
        const createRes = await fetch("/api/projects/create-from-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversation: [userMsg] }),
        });
        const createData = await createRes.json();
        const ideaMsg = createData.success
          ? `${analysis.response}\n\nCreated new idea: "${createData.project.title}" in Ideas Lab →`
          : analysis.response;
        setChatMessages([...updated, { role: "assistant", content: ideaMsg }]);
        if (createData.success) {
          setActionResult({ type: "success", message: `Created "${createData.project.title}"`, link: `/ideas/${createData.project.id}` });
          const updatedProjects = await api.projects.list();
          setProjects(updatedProjects);
        }
      } else if (analysis.type === "ambiguous" && analysis.clarifyQuestion) {
        setChatMessages([...updated, { role: "assistant", content: analysis.clarifyQuestion }]);
      } else {
        // Personal — just respond conversationally
        setChatMessages([...updated, { role: "assistant", content: analysis.response || "Got it, sir." }]);
      }

      // Save conversation
      if (chatConversationId) {
        await api.conversations.send([...updated, { role: "assistant", content: analysis.response || "" }], chatConversationId);
      }
    } catch {
      setChatMessages([...updated, { role: "assistant", content: "Voice processing error. Standing by, sir." }]);
    }
    setChatLoading(false);
    setVoiceProcessing(false);
  }, [chatMessages, chatConversationId]);

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

  const TAB_LIST: { key: Tab; label: string; icon: string }[] = [
    { key: "overview", label: "Overview", icon: "⌘" },
    { key: "ideas", label: "Ideas Lab", icon: "💡" },
    { key: "agents", label: "Agents", icon: "🤖" },
    { key: "goals", label: "90-Day Goals", icon: "🎯" },
    { key: "memory", label: "Memory", icon: "🧠" },
    { key: "history", label: "Chat History", icon: "💬" },
    { key: "approvals", label: "Approvals", icon: "🛡️" },
    { key: "revenue", label: "Revenue", icon: "💰" },
  ];

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileChatActive, setMobileChatActive] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Tab content map ──────────────────────────────────────
  const tabContent: Record<Tab, () => React.ReactNode> = {
    overview: () => (
      <OverviewTab
        projects={projects}
        memories={memories}
        setActiveTab={setActiveTab}
        setMemoryFilter={setMemoryFilter}
        openModal={openModal}
        closeModal={closeModal}
      />
    ),
    ideas: () => <IdeasTab projects={projects} openModal={openModal} closeModal={closeModal} />,
    agents: () => <AgentsTab openModal={openModal} closeModal={closeModal} />,
    goals: () => <GoalsTab goals={goals} />,
    memory: () => (
      <MemoryTab
        memories={memories}
        onDeleteMemory={deleteMemory}
        onExtractMemories={async () => {
          setMemoryLoading(true);
          if (chatMessages.length >= 2) {
            await extractMemories(chatMessages);
          }
          setMemoryLoading(false);
        }}
        memoryLoading={memoryLoading}
        chatMessageCount={chatMessages.length}
        onAddMemory={() => {
          setRememberMessageIdx(-1);
          setShowRememberModal(true);
        }}
      />
    ),
    history: () => <ChatHistoryTab />,
    approvals: () => <ApprovalsTab />,
    revenue: () => <RevenueTab />,
  };

  return (
    <>
    <div className="flex h-screen overflow-hidden">
      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
        </div>
      )}

      {/* Sidebar — desktop only */}
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
                  &rarr; {btn.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {!sidebarCollapsed && (
          <div className="p-3 border-b border-jarvis-border">
            <Link href="/history" className="flex items-center gap-2 w-full text-left text-xs px-2 py-2 rounded hover:bg-jarvis-accent/20 text-jarvis-text hover:text-jarvis-accent transition-colors">
              <span>💬</span>
              <span>Chat History</span>
            </Link>
            <Link href="/chat" className="flex items-center gap-2 w-full text-left text-xs px-2 py-2 rounded hover:bg-jarvis-accent/20 text-jarvis-text hover:text-jarvis-accent transition-colors">
              <span>✉️</span>
              <span>Messages</span>
            </Link>
            <Link href="/approvals" className="flex items-center gap-2 w-full text-left text-xs px-2 py-2 rounded hover:bg-jarvis-accent/20 text-jarvis-text hover:text-jarvis-accent transition-colors">
              <span>🛡️</span>
              <span>Approvals</span>
              {pendingApprovals > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{pendingApprovals}</span>
              )}
            </Link>
            <Link href="/revenue" className="flex items-center gap-2 w-full text-left text-xs px-2 py-2 rounded hover:bg-jarvis-accent/20 text-jarvis-text hover:text-jarvis-accent transition-colors">
              <span>💰</span>
              <span>Revenue</span>
            </Link>
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top nav bar */}
        <nav className="bg-jarvis-card border-b border-jarvis-border px-2 md:px-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center">
            {/* JARVIS logo — mobile only (no hamburger) */}
            <div className="md:hidden flex items-center gap-2 px-2 py-2">
              <div className="w-7 h-7 bg-jarvis-accent rounded-lg flex items-center justify-center text-white font-bold text-xs">J</div>
              <span className="font-bold text-white text-sm">JARVIS</span>
            </div>
            {/* Tabs — desktop only */}
            <div className="hidden md:flex overflow-x-auto no-scrollbar">
              {TAB_LIST.map((tab) => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === tab.key ? "text-jarvis-accent" : "text-jarvis-muted hover:text-jarvis-text"}`}>
                  <span className="mr-1">{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.key === "approvals" && pendingApprovals > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-red-500 text-white rounded-full">{pendingApprovals}</span>
                  )}
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
          {/* ── Mobile Fullscreen Chat ─── */}
          {isMobile && mobileChatActive ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Chat header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-jarvis-border flex-shrink-0">
                <div className="w-8 h-8 bg-jarvis-accent rounded-full flex items-center justify-center text-white text-xs font-bold">J</div>
                <div className="flex-1">
                  <span className="text-sm font-semibold text-white">JARVIS</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-jarvis-green animate-[pulse-dot_2s_ease-in-out_infinite]" />
                    <span className="text-[11px] text-jarvis-muted">Online</span>
                  </div>
                </div>
                {chatMessages.length > 0 && (
                  <button
                    onClick={() => { setChatMessages([]); setChatConversationId(null); }}
                    className="text-xs text-jarvis-muted px-3 py-2 rounded-lg hover:bg-jarvis-border transition-colors min-h-[44px] flex items-center"
                  >
                    New Chat
                  </button>
                )}
              </div>

              {/* Action result toast */}
              {actionResult && (
                <div className={`mx-3 mt-2 px-3 py-2 rounded-lg text-xs animate-[slideUp_0.3s_ease-out] flex items-center justify-between ${actionResult.type === "success" ? "bg-jarvis-green/20 text-jarvis-green" : "bg-jarvis-red/20 text-jarvis-red"}`}>
                  <span>{actionResult.message}</span>
                  <div className="flex items-center gap-2">
                    {actionResult.link && <Link href={actionResult.link} className="underline font-semibold">Open</Link>}
                    <button onClick={() => setActionResult(null)} className="opacity-60 hover:opacity-100 min-h-[44px] min-w-[44px] flex items-center justify-center">&times;</button>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">🤖</div>
                    <p className="text-base text-jarvis-muted mb-6">Good evening, sir. How can I help?</p>
                    <div className="flex flex-col gap-2 max-w-sm mx-auto">
                      {getSuggestedPrompts().map((p, i) => (
                        <button key={i} onClick={() => sendChat(p)} className="text-sm px-4 py-3 rounded-xl bg-jarvis-border text-jarvis-text hover:bg-jarvis-accent/10 transition-colors text-left min-h-[44px]">{p}</button>
                      ))}
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} chat-message-in`}>
                    <div className="max-w-[85%]">
                      <div className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap ${msg.role === "user" ? "bg-jarvis-accent text-white rounded-br-md" : "bg-jarvis-border text-jarvis-text rounded-bl-md"}`}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-jarvis-border rounded-2xl px-4 py-3 text-sm text-jarvis-muted">
                      {voiceProcessing ? "Analyzing voice..." : "Thinking..."}
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Smart actions — mobile */}
              {chatMessages.length >= 3 && (
                <div className="px-3 py-2 border-t border-jarvis-border flex gap-2 relative">
                  <button onClick={handleNewIdea} disabled={!!actionLoading} className="flex-1 text-sm px-3 py-2.5 rounded-xl bg-jarvis-accent/10 text-jarvis-accent hover:bg-jarvis-accent/20 transition-colors disabled:opacity-50 min-h-[44px]">
                    {actionLoading === "new-idea" ? "Creating..." : "💡 New Idea"}
                  </button>
                  <button onClick={() => setShowAddToProject(!showAddToProject)} disabled={!!actionLoading} className="flex-1 text-sm px-3 py-2.5 rounded-xl bg-jarvis-green/10 text-jarvis-green hover:bg-jarvis-green/20 transition-colors disabled:opacity-50 min-h-[44px]">
                    {actionLoading === "add-to-project" ? "Adding..." : "📌 Add to Project"}
                  </button>
                  {showAddToProject && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-jarvis-card border border-jarvis-border rounded-xl shadow-xl max-h-48 overflow-y-auto z-10">
                      {projects.map((p) => (
                        <button key={p.id} onClick={() => handleAddToProject(p.id)} className="w-full text-left px-4 py-3 text-sm hover:bg-jarvis-accent/10 transition-colors border-b border-jarvis-border last:border-0 min-h-[44px]">
                          <span className="text-jarvis-text">{p.title}</span>
                          <span className="text-jarvis-muted ml-2">{p.status}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Suggested prompts — scrollable row */}
              {chatMessages.length > 0 && chatMessages.length < 3 && (
                <div className="px-3 py-2 border-t border-jarvis-border">
                  <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    {getSuggestedPrompts().map((p, i) => (
                      <button key={i} onClick={() => sendChat(p)} className="text-xs px-3 py-2 rounded-xl bg-jarvis-border text-jarvis-muted hover:text-jarvis-accent shrink-0 min-h-[36px]">{p}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input — large touch targets, safe area padding for bottom bar */}
              <div className="px-3 pt-2 border-t border-jarvis-border" style={{ paddingBottom: "calc(12px + 60px + env(safe-area-inset-bottom, 0px))" }}>
                <VoiceChatInput
                  value={chatInput}
                  onChange={setChatInput}
                  onSend={() => { if (chatInput.trim()) sendChat(); }}
                  disabled={chatLoading}
                  placeholder="Ask JARVIS..."
                  variant="full"
                  onVoiceComplete={handleVoicePipeline}
                />
              </div>
            </div>
          ) : (
          <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
            {tabContent[activeTab]()}
          </main>
          )}

          {/* Chat panel — desktop sidebar */}
          {chatOpen && (
            <aside className="hidden md:flex w-96 bg-jarvis-card border-l border-jarvis-border flex-col flex-shrink-0">
              <div className="p-3 border-b border-jarvis-border flex items-center gap-2">
                <div className="w-6 h-6 bg-jarvis-accent rounded-full flex items-center justify-center text-white text-xs font-bold">J</div>
                <span className="text-sm font-semibold text-white">JARVIS Chat</span>
                <StatusDot status="active" />
              </div>

              {/* Action result toast */}
              {actionResult && (
                <div className={`mx-3 mt-2 px-3 py-2 rounded-lg text-xs animate-[slideUp_0.3s_ease-out] flex items-center justify-between ${actionResult.type === "success" ? "bg-jarvis-green/20 text-jarvis-green" : "bg-jarvis-red/20 text-jarvis-red"}`}>
                  <span>{actionResult.message}</span>
                  <div className="flex items-center gap-2">
                    {actionResult.link && (
                      <Link href={actionResult.link} className="underline font-semibold">Open</Link>
                    )}
                    <button onClick={() => setActionResult(null)} className="opacity-60 hover:opacity-100">&times;</button>
                  </div>
                </div>
              )}

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
                      <div className="absolute -bottom-1 right-1 opacity-0 group-hover/msg:opacity-100 transition-opacity flex gap-1">
                        {msg.role === "assistant" && (
                          <button
                            onClick={() => handleBookmark(i)}
                            className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${savedBookmarks.has(i) ? "bg-jarvis-accent/20 border-jarvis-accent/50 text-jarvis-accent" : "bg-jarvis-card border-jarvis-border text-jarvis-muted hover:text-jarvis-accent"}`}
                            title={savedBookmarks.has(i) ? "Saved" : "Save highlight"}
                          >
                            {savedBookmarks.has(i) ? "🔖" : "🔖"}
                          </button>
                        )}
                        <button
                          onClick={() => { setRememberMessageIdx(i); setShowRememberModal(true); }}
                          className="text-xs px-1.5 py-0.5 rounded bg-jarvis-card border border-jarvis-border text-jarvis-muted hover:text-jarvis-accent"
                          title="Remember this"
                        >
                          🧠
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-jarvis-border rounded-xl px-3 py-2 text-sm text-jarvis-muted">
                      {voiceProcessing ? "Analyzing voice..." : "Thinking..."}
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Smart action buttons — visible after 3+ messages */}
              {chatMessages.length >= 3 && (
                <div className="px-3 py-2 border-t border-jarvis-border">
                  <div className="flex gap-2 relative">
                    <button
                      onClick={handleNewIdea}
                      disabled={!!actionLoading}
                      className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-jarvis-accent/10 text-jarvis-accent hover:bg-jarvis-accent/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {actionLoading === "new-idea" ? "Creating..." : "💡 New Idea"}
                    </button>
                    <button
                      onClick={() => setShowAddToProject(!showAddToProject)}
                      disabled={!!actionLoading}
                      className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-jarvis-green/10 text-jarvis-green hover:bg-jarvis-green/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {actionLoading === "add-to-project" ? "Adding..." : "📌 Add to Project"}
                    </button>

                    {/* Project dropdown */}
                    {showAddToProject && (
                      <div className="absolute bottom-full left-0 right-0 mb-1 bg-jarvis-card border border-jarvis-border rounded-xl shadow-xl max-h-48 overflow-y-auto z-10">
                        {projects.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => handleAddToProject(p.id)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-jarvis-accent/10 transition-colors border-b border-jarvis-border last:border-0"
                          >
                            <span className="text-jarvis-text">{p.title}</span>
                            <span className="text-jarvis-muted ml-2">{p.status}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                  onSend={() => {
                    // Check if this came from voice (input has content and voice was used)
                    if (chatInput.trim()) {
                      sendChat();
                    }
                  }}
                  disabled={chatLoading}
                  variant="panel"
                  onVoiceComplete={handleVoicePipeline}
                />
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div onClick={(e) => e.stopPropagation()} className="bg-jarvis-card border border-jarvis-border rounded-xl p-5 md:p-6 max-w-lg w-full animate-[slideUp_0.3s_ease-out] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">{modal.title}</h2>
              <button onClick={closeModal} className="text-jarvis-muted hover:text-white text-xl p-1">&times;</button>
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

    {/* ─── MOBILE: Bottom Tab Bar ─── */}
    <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} mobileChatActive={mobileChatActive} onMobileChatToggle={setMobileChatActive} />

    {/* Remember This Modal */}
    {showRememberModal && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={() => setShowRememberModal(false)}>
        <div className="absolute inset-0 bg-black/60" />
        <div onClick={(e) => e.stopPropagation()} className="relative bg-jarvis-card border border-jarvis-border rounded-xl p-5 max-w-md w-full animate-[slideUp_0.3s_ease-out]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">🧠 Remember This</h2>
            <button onClick={() => setShowRememberModal(false)} className="text-jarvis-muted hover:text-white text-xl p-1">&times;</button>
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
    </>
  );
}
