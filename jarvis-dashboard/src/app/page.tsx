"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { Project, Goal, ChatMessage, Memory, MemoryCategory } from "@/lib/types";
import VoiceChatInput from "@/components/VoiceChatInput";
import BottomTabBar from "@/components/mobile/BottomTabBar";
import OverviewTab from "@/components/dashboard/OverviewTab";
import IdeasTab from "@/components/dashboard/IdeasTab";
import AgentsTab from "@/components/dashboard/AgentsTab";
import GoalsTab from "@/components/dashboard/GoalsTab";
import MemoryTab from "@/components/dashboard/MemoryTab";

// ─── Types ────────────────────────────────────────────────
type Tab = "overview" | "ideas" | "agents" | "goals" | "memory";
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
  const [modal, setModal] = useState<ModalData>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [chatOpen, setChatOpen] = useState(false);

  // DB-backed state
  const [projects, setProjects] = useState<Project[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  // Memory state
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [rememberCategory, setRememberCategory] = useState<MemoryCategory>("personal");
  const [showRememberModal, setShowRememberModal] = useState(false);
  const [rememberMessageIdx, setRememberMessageIdx] = useState<number>(-1);
  const [memoryFilter, setMemoryFilter] = useState<string>("all");

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
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      setChatMessages([...newMessages, { role: "assistant", content: data.response }]);
      if (newMessages.length % 6 === 0) {
        fetchMemories();
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Connection error. Standing by, sir." }]);
    }
    setChatLoading(false);
  }, [chatInput, chatMessages, fetchMemories]);

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
  ];

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
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
    <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />

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
