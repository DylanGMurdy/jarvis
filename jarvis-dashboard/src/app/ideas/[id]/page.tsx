"use client";

import { use, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Project, ProjectTask, ProjectNote, ChatMessage } from "@/lib/types";
import VoiceChatInput from "@/components/VoiceChatInput";

const STATUSES: Project["status"][] = ["Idea", "Planning", "Building", "Launched", "Revenue"];
const TABS = ["Overview", "Tasks", "Notes", "Chat", "War Room", "History"] as const;
type Tab = (typeof TABS)[number];

const GRADE_COLORS: Record<Project["grade"], string> = {
  A: "bg-green-500/20 text-green-400 border-green-500/30",
  B: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  C: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const SUGGESTED_PROMPTS = [
  "What should I focus on next?",
  "Help me define the MVP",
  "Draft a sales pitch for this",
  "What are the risks?",
  "Write me a 2-week sprint plan",
];

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editingProgress, setEditingProgress] = useState(false);
  const [progressInput, setProgressInput] = useState("");

  // Chat state — persisted to Supabase
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHistoryLoaded, setChatHistoryLoaded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Claude Code brief modal
  const [showBriefModal, setShowBriefModal] = useState(false);
  const [briefText, setBriefText] = useState("");
  const [briefCopied, setBriefCopied] = useState(false);

  // Ingest modal
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [ingestText, setIngestText] = useState("");
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestResult, setIngestResult] = useState<{ summary: string; saved: { notes: number; tasks: number; memories: number } } | null>(null);

  // History state
  const [projectHistory, setProjectHistory] = useState<{id: string; title: string; message_count: number; preview: string; messages: ChatMessage[]; created_at: string; updated_at: string}[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // War Room state
  const [warRoomResults, setWarRoomResults] = useState<Record<string, { loading: boolean; analysis: string | null }>>({
    devils_advocate: { loading: false, analysis: null },
    market_analyst: { loading: false, analysis: null },
    risk_assessor: { loading: false, analysis: null },
  });

  async function runAnalysis(analyst: string) {
    setWarRoomResults((prev) => ({ ...prev, [analyst]: { loading: true, analysis: null } }));
    try {
      const res = await fetch(`/api/projects/${id}/warroom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analyst }),
      });
      const data = await res.json();
      setWarRoomResults((prev) => ({
        ...prev,
        [analyst]: { loading: false, analysis: data.success ? data.analysis : data.error || "Failed" },
      }));
    } catch {
      setWarRoomResults((prev) => ({ ...prev, [analyst]: { loading: false, analysis: "Connection error" } }));
    }
  }

  // ─── Load Data ───────────────────────────────────────────
  const loadData = useCallback(async () => {
    const [p, t, n] = await Promise.all([
      api.projects.get(id),
      api.projectTasks.list(id),
      api.projectNotes.list(id),
    ]);
    if (p) {
      setProject(p);
      setEditDesc(p.description);
      setProgressInput(String(p.progress));
      setTasks(t);
      setNotes(n);
    } else {
      setProject(null);
    }
    setLoading(false);
  }, [id]);

  // Load chat history from Supabase
  const loadChatHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/chat`);
      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        setChatMessages(data.messages);
      }
    } catch { /* silent */ }
    setChatHistoryLoaded(true);
  }, [id]);

  // Load project chat history (all conversations)
  const loadProjectHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/history`);
      const data = await res.json();
      setProjectHistory(data.conversations || []);
    } catch { /* silent */ }
    setHistoryLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
    loadChatHistory();
  }, [loadData, loadChatHistory]);

  // Load history when History tab is selected
  useEffect(() => {
    if (activeTab === "History") {
      loadProjectHistory();
    }
  }, [activeTab, loadProjectHistory]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ─── Handlers ────────────────────────────────────────────
  async function handleStatusChange(status: Project["status"]) {
    await api.projects.update(id, { status });
    loadData();
  }

  async function handleDescSave() {
    if (project && editDesc !== project.description) {
      await api.projects.update(id, { description: editDesc });
      loadData();
    }
  }

  async function handleProgressSave() {
    const val = Math.min(100, Math.max(0, parseInt(progressInput) || 0));
    await api.projects.update(id, { progress: val });
    setEditingProgress(false);
    loadData();
  }

  async function handleAddTask() {
    const title = newTaskTitle.trim();
    if (!title) return;
    await api.projectTasks.create(id, title);
    setNewTaskTitle("");
    loadData();
  }

  async function handleToggleTask(taskId: string, done: boolean) {
    await api.projectTasks.update(id, taskId, { done: !done });
    loadData();
  }

  async function handleSaveNote() {
    const content = newNoteContent.trim();
    if (!content) return;
    await api.projectNotes.create(id, content);
    setNewNoteContent("");
    loadData();
  }

  // ─── Project Chat (persisted to Supabase) ────────────────
  async function handleSendChat(content?: string) {
    const text = content ?? chatInput.trim();
    if (!text || !project) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const updated = [...chatMessages, userMsg];
    setChatMessages(updated);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch(`/api/projects/${id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated }),
      });
      const data = await res.json();
      setChatMessages([...updated, { role: "assistant", content: data.response ?? "No response." }]);
    } catch {
      setChatMessages([...updated, { role: "assistant", content: "Failed to reach JARVIS." }]);
    } finally {
      setChatLoading(false);
    }
  }

  // ─── Claude Code Brief ───────────────────────────────────
  function generateBrief() {
    if (!project) return;

    const taskList = tasks.map((t) => `- [${t.done ? "x" : " "}] ${t.title}`).join("\n");
    const noteList = notes.map((n) => `[${new Date(n.created_at).toLocaleDateString()}] ${n.content}`).join("\n\n");
    const chatSummary = chatMessages
      .filter((m) => m.role === "user")
      .slice(-10)
      .map((m) => `- ${m.content.slice(0, 120)}`)
      .join("\n");

    const brief = `I'm working on a project called "${project.title}" and I need your help building it.

## Project Details
- **Category:** ${project.category}
- **Status:** ${project.status}
- **Grade:** ${project.grade} (A = highest priority)
- **Progress:** ${project.progress}%
- **Revenue Goal:** ${project.revenue_goal}

## Description
${project.description}

## Current Tasks
${taskList || "No tasks yet"}

${noteList ? `## Notes & Decisions\n${noteList}` : ""}

${chatSummary ? `## Recent Discussion Topics\n${chatSummary}` : ""}

## What I Need
Help me build the next piece of this project. Look at the tasks above, focus on the uncompleted ones, and let's start building.

When you make progress, report back to my dashboard with:
curl -X POST ${typeof window !== "undefined" ? window.location.origin : ""}/api/projects/${id}/progress \\
  -H "Content-Type: application/json" \\
  -d '{"update": "description of what was done", "progress": <new_percentage>, "status": "${project.status}"}'`;

    setBriefText(brief);
    setShowBriefModal(true);
    setBriefCopied(false);
  }

  async function copyBrief() {
    await navigator.clipboard.writeText(briefText);
    setBriefCopied(true);
    setTimeout(() => setBriefCopied(false), 2000);
  }

  // ─── Ingest External Conversation ────────────────────────
  async function handleIngest() {
    if (!ingestText.trim()) return;
    setIngestLoading(true);
    setIngestResult(null);
    try {
      const res = await fetch(`/api/projects/${id}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ingestText }),
      });
      const data = await res.json();
      if (data.success) {
        setIngestResult(data);
        loadData(); // Refresh tasks/notes
      } else {
        setIngestResult({ summary: data.error || "Failed", saved: { notes: 0, tasks: 0, memories: 0 } });
      }
    } catch {
      setIngestResult({ summary: "Connection error", saved: { notes: 0, tasks: 0, memories: 0 } });
    }
    setIngestLoading(false);
  }

  // ─── Derived ─────────────────────────────────────────────
  const doneTasks = tasks.filter((t) => t.done).length;
  const daysSinceCreated = project
    ? Math.floor((Date.now() - new Date(project.created_at).getTime()) / 86400000)
    : 0;
  const nextActions = tasks.filter((t) => !t.done).slice(0, 3);
  const sortedNotes = [...notes].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (loading) {
    return <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center"><div className="text-[#64748b] text-lg">Loading...</div></div>;
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-4">
        <div className="text-[#e2e8f0] text-xl font-semibold">Project not found</div>
        <Link href="/" className="text-[#6366f1] hover:text-[#818cf8] transition-colors">Back to Ideas Lab</Link>
      </div>
    );
  }

  const statusIdx = STATUSES.indexOf(project.status);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e2e8f0]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
        {/* ── Header ─────────────────────────────────────── */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-[#64748b] hover:text-[#e2e8f0] transition-colors text-sm mb-4">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Back to Ideas Lab
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold">{project.title}</h1>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#1e1e2e] text-[#64748b] border border-[#1e1e2e]">{project.category}</span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${GRADE_COLORS[project.grade]}`}>Grade {project.grade}</span>
            </div>
            <div className="flex items-center gap-2">
              <select value={project.status} onChange={(e) => handleStatusChange(e.target.value as Project["status"])} className="bg-[#12121a] border border-[#1e1e2e] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] cursor-pointer">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* ── Action Buttons ──────────────────────────── */}
          <div className="flex flex-wrap gap-2 mt-4">
            <button onClick={generateBrief} className="px-4 py-2 bg-[#6366f1] text-white rounded-lg text-sm font-medium hover:bg-[#5558e6] transition-colors flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
              Build with Claude Code
            </button>
            <button onClick={() => { setShowIngestModal(true); setIngestResult(null); setIngestText(""); }} className="px-4 py-2 bg-[#1e1e2e] text-[#e2e8f0] rounded-lg text-sm font-medium hover:bg-[#6366f1]/20 transition-colors flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
              Sync from Claude.ai
            </button>
          </div>
        </div>

        {/* ── Status Pipeline ────────────────────────────── */}
        <div className="mb-8 px-4 hidden sm:block">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-[#1e1e2e]" />
            <div className="absolute top-4 left-0 h-0.5 bg-[#6366f1] transition-all duration-500" style={{ width: `${(statusIdx / (STATUSES.length - 1)) * 100}%` }} />
            {STATUSES.map((s, i) => (
              <div key={s} className="flex flex-col items-center relative z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-300 ${i <= statusIdx ? "bg-[#6366f1] text-white" : "bg-[#1e1e2e] text-[#64748b]"}`}>{i + 1}</div>
                <span className={`mt-2 text-xs transition-colors duration-300 ${i <= statusIdx ? "text-[#e2e8f0]" : "text-[#64748b]"}`}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────── */}
        <div className="flex gap-1 mb-6 border-b border-[#1e1e2e] overflow-x-auto">
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg whitespace-nowrap ${activeTab === tab ? "text-[#6366f1] border-b-2 border-[#6366f1] bg-[#6366f1]/5" : "text-[#64748b] hover:text-[#e2e8f0]"}`}>
              {tab}{tab === "Chat" && chatMessages.length > 0 ? ` (${chatMessages.length})` : ""}
            </button>
          ))}
        </div>

        {/* ── Tab Content ────────────────────────────────── */}
        <div className="min-h-[500px]">
          {/* ── Overview ─────────────────────────────────── */}
          {activeTab === "Overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-6">
                  <h3 className="text-sm font-medium text-[#64748b] mb-3">Description</h3>
                  <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} onBlur={handleDescSave} rows={4} className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg p-3 text-[#e2e8f0] text-sm resize-none focus:outline-none focus:border-[#6366f1] transition-colors" />
                </div>
                <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-6">
                  <h3 className="text-sm font-medium text-[#64748b] mb-2">Revenue Goal</h3>
                  <p className="text-lg font-semibold text-[#e2e8f0]">{project.revenue_goal}</p>
                </div>
                <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-[#64748b]">Progress</h3>
                    {editingProgress ? (
                      <div className="flex items-center gap-2">
                        <input type="number" min={0} max={100} value={progressInput} onChange={(e) => setProgressInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleProgressSave()} className="w-16 bg-[#0a0a0f] border border-[#1e1e2e] rounded px-2 py-1 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]" autoFocus />
                        <button onClick={handleProgressSave} className="text-xs text-[#6366f1] hover:text-[#818cf8]">Save</button>
                      </div>
                    ) : (
                      <button onClick={() => setEditingProgress(true)} className="text-sm text-[#6366f1] hover:text-[#818cf8]">{project.progress}%</button>
                    )}
                  </div>
                  <div className="w-full h-3 bg-[#1e1e2e] rounded-full overflow-hidden">
                    <div className="h-full bg-[#6366f1] rounded-full transition-all duration-500" style={{ width: `${project.progress}%` }} />
                  </div>
                </div>
                <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-6">
                  <h3 className="text-sm font-medium text-[#64748b] mb-3">Next 3 Actions</h3>
                  {nextActions.length === 0 ? (
                    <p className="text-[#64748b] text-sm">No pending tasks. Add some in the Tasks tab.</p>
                  ) : (
                    <ul className="space-y-2">
                      {nextActions.map((t, i) => (
                        <li key={t.id} className="flex items-center gap-3 text-sm">
                          <span className="w-5 h-5 rounded-full bg-[#6366f1]/20 text-[#6366f1] flex items-center justify-center text-xs font-bold">{i + 1}</span>
                          <span>{t.title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="space-y-6">
                <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-6">
                  <h3 className="text-sm font-medium text-[#64748b] mb-4">Key Metrics</h3>
                  <div className="space-y-4">
                    <div><span className="text-xs text-[#64748b]">Status</span><p className="text-sm font-medium">{project.status}</p></div>
                    <div><span className="text-xs text-[#64748b]">Grade</span><p className="text-sm font-medium">{project.grade}</p></div>
                    <div><span className="text-xs text-[#64748b]">Days Active</span><p className="text-sm font-medium">{daysSinceCreated}</p></div>
                    <div><span className="text-xs text-[#64748b]">Tasks</span><p className="text-sm font-medium">{doneTasks} / {tasks.length} done</p></div>
                    <div><span className="text-xs text-[#64748b]">Notes</span><p className="text-sm font-medium">{notes.length}</p></div>
                    <div><span className="text-xs text-[#64748b]">Chat Messages</span><p className="text-sm font-medium">{chatMessages.length}</p></div>
                  </div>
                </div>
                {/* Claude Code API endpoint info */}
                <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-6">
                  <h3 className="text-sm font-medium text-[#64748b] mb-2">Progress API</h3>
                  <p className="text-xs text-[#64748b] mb-2">Claude Code can report back:</p>
                  <code className="block text-xs text-[#6366f1] bg-[#0a0a0f] rounded p-2 break-all">POST /api/projects/{id}/progress</code>
                </div>
              </div>
            </div>
          )}

          {/* ── Tasks ────────────────────────────────────── */}
          {activeTab === "Tasks" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#64748b]">{doneTasks} / {tasks.length} completed</p>
              </div>
              <div className="flex gap-2">
                <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddTask()} placeholder="Add a new task..." className="flex-1 bg-[#12121a] border border-[#1e1e2e] rounded-lg px-4 py-2.5 text-sm text-[#e2e8f0] placeholder-[#64748b] focus:outline-none focus:border-[#6366f1]" />
                <button onClick={handleAddTask} className="px-4 py-2.5 bg-[#6366f1] hover:bg-[#5558e6] text-white text-sm font-medium rounded-lg">Add Task</button>
              </div>
              <div className="space-y-2">
                {tasks.length === 0 ? (
                  <p className="text-[#64748b] text-sm text-center py-8">No tasks yet.</p>
                ) : tasks.map((task) => (
                  <div key={task.id} onClick={() => handleToggleTask(task.id, task.done)} className="flex items-center gap-3 bg-[#12121a] border border-[#1e1e2e] rounded-lg px-4 py-3 cursor-pointer hover:border-[#6366f1]/30 transition-colors">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${task.done ? "bg-[#6366f1] border-[#6366f1]" : "border-[#64748b]"}`}>
                      {task.done && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </div>
                    <span className={`text-sm ${task.done ? "line-through text-[#64748b]" : "text-[#e2e8f0]"}`}>{task.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Notes ────────────────────────────────────── */}
          {activeTab === "Notes" && (
            <div className="space-y-4">
              <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-4">
                <textarea value={newNoteContent} onChange={(e) => setNewNoteContent(e.target.value)} placeholder="Write a note..." rows={3} className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg p-3 text-sm text-[#e2e8f0] placeholder-[#64748b] resize-none focus:outline-none focus:border-[#6366f1] mb-3" />
                <button onClick={handleSaveNote} className="px-4 py-2 bg-[#6366f1] hover:bg-[#5558e6] text-white text-sm font-medium rounded-lg">Save Note</button>
              </div>
              {sortedNotes.length === 0 ? (
                <p className="text-[#64748b] text-sm text-center py-8">No notes yet.</p>
              ) : sortedNotes.map((note) => (
                <div key={note.id} className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-4">
                  <p className="text-sm text-[#e2e8f0] whitespace-pre-wrap">{note.content}</p>
                  <p className="text-xs text-[#64748b] mt-3">{new Date(note.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Chat (persisted) ─────────────────────────── */}
          {activeTab === "Chat" && (
            <div className="flex flex-col h-[600px]">
              {/* Memory indicator */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
                <span className="text-xs text-[#64748b]">JARVIS remembers everything discussed here — {chatMessages.length} messages stored</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                {!chatHistoryLoaded ? (
                  <div className="text-center py-8 text-[#64748b] text-sm animate-pulse">Loading chat history...</div>
                ) : chatMessages.length === 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-[#64748b] mb-4">Chat with JARVIS about this project. All messages are saved.</p>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTED_PROMPTS.map((prompt) => (
                        <button key={prompt} onClick={() => handleSendChat(prompt)} className="px-3 py-2 bg-[#12121a] border border-[#1e1e2e] rounded-lg text-sm text-[#e2e8f0] hover:border-[#6366f1]/50 hover:bg-[#6366f1]/5 transition-colors">{prompt}</button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${msg.role === "user" ? "bg-[#6366f1] text-white" : "bg-[#1e1e2e] text-[#e2e8f0]"}`}>{msg.content}</div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start"><div className="bg-[#1e1e2e] rounded-xl px-4 py-3 text-sm text-[#64748b]">Thinking...</div></div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="pt-4 border-t border-[#1e1e2e]">
                <VoiceChatInput
                  value={chatInput}
                  onChange={setChatInput}
                  onSend={() => handleSendChat()}
                  disabled={chatLoading}
                  placeholder="Ask JARVIS about this project..."
                  variant="full"
                />
              </div>
            </div>
          )}

          {/* ── War Room ────────────────────────────────── */}
          {activeTab === "War Room" && (
            <div className="space-y-6">
              <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-4">
                <h3 className="text-lg font-bold text-white mb-1">War Room</h3>
                <p className="text-sm text-[#64748b]">Run AI analyst panels to stress-test this idea before building.</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {([
                  { key: "devils_advocate", icon: "😈", name: "Devil\u2019s Advocate", desc: "Finds every flaw, blind spot, and weakness", btnClass: "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20", borderClass: "border-red-500/20" },
                  { key: "market_analyst", icon: "📊", name: "Market Analyst", desc: "Market size, competition, timing, acquisition", btnClass: "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20", borderClass: "border-blue-500/20" },
                  { key: "risk_assessor", icon: "⚠️", name: "Risk Assessor", desc: "Technical, market, execution, financial risk", btnClass: "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20", borderClass: "border-amber-500/20" },
                ] as const).map((panel) => (
                  <div key={panel.key} className={`bg-[#12121a] rounded-xl border ${warRoomResults[panel.key].analysis ? panel.borderClass : "border-[#1e1e2e]"} flex flex-col`}>
                    <div className="p-4 border-b border-[#1e1e2e]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{panel.icon}</span>
                        <h4 className="text-sm font-bold text-white">{panel.name}</h4>
                      </div>
                      <p className="text-xs text-[#64748b]">{panel.desc}</p>
                    </div>
                    <div className="flex-1 p-4 min-h-[100px]">
                      {warRoomResults[panel.key].loading ? (
                        <div className="text-sm text-[#64748b] animate-pulse">Analyzing...</div>
                      ) : warRoomResults[panel.key].analysis ? (
                        <div className="text-sm text-[#e2e8f0] whitespace-pre-wrap leading-relaxed">{warRoomResults[panel.key].analysis}</div>
                      ) : (
                        <p className="text-sm text-[#64748b]">Click below to run this analysis.</p>
                      )}
                    </div>
                    <div className="p-4 border-t border-[#1e1e2e]">
                      <button
                        onClick={() => runAnalysis(panel.key)}
                        disabled={warRoomResults[panel.key].loading}
                        className={`w-full px-4 py-2.5 border rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${panel.btnClass}`}
                      >
                        {warRoomResults[panel.key].loading ? "Running..." : warRoomResults[panel.key].analysis ? "Re-run Analysis" : "Run Analysis"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => { runAnalysis("devils_advocate"); runAnalysis("market_analyst"); runAnalysis("risk_assessor"); }}
                disabled={warRoomResults.devils_advocate.loading || warRoomResults.market_analyst.loading || warRoomResults.risk_assessor.loading}
                className="w-full px-4 py-3 bg-[#6366f1] text-white rounded-lg text-sm font-medium hover:bg-[#5558e6] disabled:opacity-50 transition-colors"
              >
                Run All Analysts
              </button>
            </div>
          )}

          {/* ── History ─────────────────────────────────── */}
          {activeTab === "History" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-[#64748b]">All conversations linked to this project</p>
                <button onClick={loadProjectHistory} className="text-xs text-[#6366f1] hover:underline">Refresh</button>
              </div>

              {historyLoading ? (
                <div className="text-center py-8 text-[#64748b] text-sm animate-pulse">Loading history...</div>
              ) : projectHistory.length === 0 ? (
                <div className="text-center py-12 text-[#64748b]">
                  <div className="text-3xl mb-3">💬</div>
                  <p className="text-sm">No conversation history for this project yet.</p>
                  <p className="text-xs mt-1">Chat in the Chat tab or route conversations here from the main dashboard.</p>
                </div>
              ) : (
                projectHistory.map((convo) => {
                  const isExpanded = expandedHistoryId === convo.id;
                  return (
                    <div key={convo.id} className="bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden">
                      <button onClick={() => setExpandedHistoryId(isExpanded ? null : convo.id)} className="w-full px-4 py-3 text-left hover:bg-[#1e1e2e]/30 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-white truncate">{convo.title}</h4>
                            <p className="text-xs text-[#64748b] line-clamp-1 mt-0.5">{convo.preview}</p>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                            <span className="text-[11px] text-[#64748b]">{new Date(convo.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                            <span className="text-[11px] text-[#6366f1]">{convo.message_count} msgs</span>
                          </div>
                        </div>
                        <div className="flex justify-center mt-1">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-[#64748b] transition-transform ${isExpanded ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-[#1e1e2e]">
                          <div className="px-4 py-2 bg-[#0a0a0f]/50 text-[11px] text-[#64748b]">
                            {new Date(convo.created_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </div>
                          <div className="px-4 py-3 space-y-3 max-h-[50vh] overflow-y-auto">
                            {convo.messages.map((msg, i) => (
                              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`flex items-end gap-2 max-w-[80%] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                                  {msg.role === "assistant" && (
                                    <div className="w-6 h-6 bg-[#6366f1] rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 mb-0.5">J</div>
                                  )}
                                  <div className={`rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${msg.role === "user" ? "bg-[#6366f1] text-white rounded-br-md" : "bg-[#1e1e2e] text-[#e2e8f0] rounded-bl-md"}`}>
                                    {msg.content}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="px-4 py-2 border-t border-[#1e1e2e]">
                            <button
                              onClick={() => {
                                setChatMessages(convo.messages);
                                setActiveTab("Chat");
                              }}
                              className="w-full text-center px-3 py-2 bg-[#6366f1] text-white rounded-lg text-sm font-medium hover:bg-[#5558e6] transition-colors"
                            >
                              Continue this conversation
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Claude Code Brief Modal ──────────────────────── */}
      {showBriefModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowBriefModal(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div onClick={(e) => e.stopPropagation()} className="relative bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6 max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                  Claude Code Brief
                </h2>
                <p className="text-xs text-[#64748b] mt-1">Copy this into Claude Code to start building</p>
              </div>
              <button onClick={() => setShowBriefModal(false)} className="text-[#64748b] hover:text-white text-xl p-1">x</button>
            </div>
            <div className="flex-1 overflow-y-auto mb-4">
              <pre className="text-sm text-[#e2e8f0] whitespace-pre-wrap bg-[#0a0a0f] rounded-lg p-4 border border-[#1e1e2e]">{briefText}</pre>
            </div>
            <div className="flex gap-2">
              <button onClick={copyBrief} className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all ${briefCopied ? "bg-[#22c55e] text-white" : "bg-[#6366f1] text-white hover:bg-[#5558e6]"}`}>
                {briefCopied ? "Copied!" : "Copy for Claude Code"}
              </button>
              <button onClick={() => setShowBriefModal(false)} className="px-4 py-3 bg-[#1e1e2e] text-[#e2e8f0] rounded-lg text-sm hover:bg-[#6366f1]/20">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ingest Modal ─────────────────────────────────── */}
      {showIngestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowIngestModal(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div onClick={(e) => e.stopPropagation()} className="relative bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6 max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Sync from Claude.ai</h2>
                <p className="text-xs text-[#64748b] mt-1">Paste any conversation and JARVIS will extract relevant info for this project</p>
              </div>
              <button onClick={() => setShowIngestModal(false)} className="text-[#64748b] hover:text-white text-xl p-1">x</button>
            </div>

            {!ingestResult ? (
              <>
                <textarea
                  value={ingestText}
                  onChange={(e) => setIngestText(e.target.value)}
                  placeholder="Paste a conversation from Claude.ai, email, Slack, or anywhere else..."
                  rows={12}
                  className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg p-4 text-sm text-[#e2e8f0] placeholder-[#64748b] resize-none focus:outline-none focus:border-[#6366f1] mb-4"
                  disabled={ingestLoading}
                />
                <button onClick={handleIngest} disabled={ingestLoading || ingestText.trim().length < 10} className="w-full px-4 py-3 bg-[#6366f1] text-white rounded-lg text-sm font-medium hover:bg-[#5558e6] disabled:opacity-50 transition-colors">
                  {ingestLoading ? "JARVIS is extracting..." : "Extract & Save"}
                </button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-[#6366f1] mb-2">Extraction Complete</h3>
                  <p className="text-sm text-[#e2e8f0] mb-3">{ingestResult.summary}</p>
                  <div className="flex gap-4 text-xs">
                    <span className="text-[#22c55e]">{ingestResult.saved.notes} notes saved</span>
                    <span className="text-[#eab308]">{ingestResult.saved.tasks} tasks created</span>
                    <span className="text-[#6366f1]">{ingestResult.saved.memories} memories stored</span>
                  </div>
                </div>
                <button onClick={() => setShowIngestModal(false)} className="w-full px-4 py-3 bg-[#6366f1] text-white rounded-lg text-sm font-medium hover:bg-[#5558e6]">Done</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
