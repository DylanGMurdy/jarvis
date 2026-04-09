"use client";

import { use, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import type { Project, ProjectTask, ProjectNote, ChatMessage } from "@/lib/types";

// ─── Constants ───────────────────────────────────────────
const STATUSES: Project["status"][] = ["Idea", "Planning", "Building", "Launched", "Revenue"];
const TABS = ["Overview", "Tasks", "Notes", "Chat"] as const;
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
];

// ─── Page Component ──────────────────────────────────────
export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");

  // Task input
  const [newTaskTitle, setNewTaskTitle] = useState("");

  // Note input
  const [newNoteContent, setNewNoteContent] = useState("");

  // Description editing
  const [editDesc, setEditDesc] = useState("");

  // Progress editing
  const [editingProgress, setEditingProgress] = useState(false);
  const [progressInput, setProgressInput] = useState("");

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ─── Load Data ───────────────────────────────────────────
  function loadData() {
    const p = db.projects.get(id);
    if (p) {
      setProject(p);
      setEditDesc(p.description);
      setProgressInput(String(p.progress));
      setTasks(db.projectTasks.list(id));
      setNotes(db.projectNotes.list(id));
    } else {
      setProject(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ─── Handlers ────────────────────────────────────────────
  function handleStatusChange(status: Project["status"]) {
    db.projects.update(id, { status });
    loadData();
  }

  function handleDescSave() {
    if (project && editDesc !== project.description) {
      db.projects.update(id, { description: editDesc });
      loadData();
    }
  }

  function handleProgressSave() {
    const val = Math.min(100, Math.max(0, parseInt(progressInput) || 0));
    db.projects.update(id, { progress: val });
    setEditingProgress(false);
    loadData();
  }

  function handleAddTask() {
    const title = newTaskTitle.trim();
    if (!title) return;
    db.projectTasks.create({ project_id: id, title, done: false });
    setNewTaskTitle("");
    loadData();
  }

  function handleToggleTask(taskId: string, done: boolean) {
    db.projectTasks.update(taskId, { done: !done });
    loadData();
  }

  function handleSaveNote() {
    const content = newNoteContent.trim();
    if (!content) return;
    db.projectNotes.create({ project_id: id, content });
    setNewNoteContent("");
    loadData();
  }

  async function handleSendChat(content?: string) {
    const text = content ?? chatInput.trim();
    if (!text || !project) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const updated = [...chatMessages, userMsg];
    setChatMessages(updated);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updated,
          context: {
            type: "project",
            project: {
              title: project.title,
              description: project.description,
              status: project.status,
              category: project.category,
              grade: project.grade,
              revenue_goal: project.revenue_goal,
              progress: project.progress,
            },
          },
        }),
      });
      const data = await res.json();
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.response ?? data.content ?? "No response received.",
      };
      setChatMessages([...updated, assistantMsg]);
    } catch {
      setChatMessages([
        ...updated,
        { role: "assistant", content: "Failed to get a response. Please try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
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

  // ─── Loading / Not Found ─────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-[#64748b] text-lg">Loading...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-4">
        <div className="text-[#e2e8f0] text-xl font-semibold">Project not found</div>
        <Link
          href="/"
          className="text-[#6366f1] hover:text-[#818cf8] transition-colors"
        >
          Back to Ideas Lab
        </Link>
      </div>
    );
  }

  const statusIdx = STATUSES.indexOf(project.status);

  // ─── Render ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e2e8f0]">
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        {/* ── Header ─────────────────────────────────────── */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[#64748b] hover:text-[#e2e8f0] transition-colors text-sm mb-4"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Ideas Lab
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">{project.title}</h1>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#1e1e2e] text-[#64748b] border border-[#1e1e2e]">
                {project.category}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${GRADE_COLORS[project.grade]}`}
              >
                Grade {project.grade}
              </span>
            </div>

            <select
              value={project.status}
              onChange={(e) => handleStatusChange(e.target.value as Project["status"])}
              className="bg-[#12121a] border border-[#1e1e2e] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] transition-colors cursor-pointer"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Status Pipeline ────────────────────────────── */}
        <div className="mb-8 px-4">
          <div className="flex items-center justify-between relative">
            {/* Connecting line */}
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-[#1e1e2e]" />
            <div
              className="absolute top-4 left-0 h-0.5 bg-[#6366f1] transition-all duration-500"
              style={{ width: `${(statusIdx / (STATUSES.length - 1)) * 100}%` }}
            />

            {STATUSES.map((s, i) => (
              <div key={s} className="flex flex-col items-center relative z-10">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-300 ${
                    i <= statusIdx
                      ? "bg-[#6366f1] text-white"
                      : "bg-[#1e1e2e] text-[#64748b]"
                  }`}
                >
                  {i + 1}
                </div>
                <span
                  className={`mt-2 text-xs transition-colors duration-300 ${
                    i <= statusIdx ? "text-[#e2e8f0]" : "text-[#64748b]"
                  }`}
                >
                  {s}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────── */}
        <div className="flex gap-1 mb-6 border-b border-[#1e1e2e]">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg ${
                activeTab === tab
                  ? "text-[#6366f1] border-b-2 border-[#6366f1] bg-[#6366f1]/5"
                  : "text-[#64748b] hover:text-[#e2e8f0]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Tab Content ────────────────────────────────── */}
        <div className="min-h-[500px]">
          {/* ── Overview Tab ─────────────────────────────── */}
          {activeTab === "Overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Description */}
                <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-6">
                  <h3 className="text-sm font-medium text-[#64748b] mb-3">Description</h3>
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    onBlur={handleDescSave}
                    rows={4}
                    className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg p-3 text-[#e2e8f0] text-sm resize-none focus:outline-none focus:border-[#6366f1] transition-colors"
                  />
                </div>

                {/* Revenue Goal */}
                <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-6">
                  <h3 className="text-sm font-medium text-[#64748b] mb-2">Revenue Goal</h3>
                  <p className="text-lg font-semibold text-[#e2e8f0]">{project.revenue_goal}</p>
                </div>

                {/* Progress */}
                <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-[#64748b]">Progress</h3>
                    {editingProgress ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={progressInput}
                          onChange={(e) => setProgressInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleProgressSave()}
                          className="w-16 bg-[#0a0a0f] border border-[#1e1e2e] rounded px-2 py-1 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]"
                          autoFocus
                        />
                        <button
                          onClick={handleProgressSave}
                          className="text-xs text-[#6366f1] hover:text-[#818cf8] transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingProgress(true)}
                        className="text-sm text-[#6366f1] hover:text-[#818cf8] transition-colors"
                      >
                        {project.progress}%
                      </button>
                    )}
                  </div>
                  <div className="w-full h-3 bg-[#1e1e2e] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#6366f1] rounded-full transition-all duration-500"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>

                {/* Next 3 Actions */}
                <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-6">
                  <h3 className="text-sm font-medium text-[#64748b] mb-3">Next 3 Actions</h3>
                  {nextActions.length === 0 ? (
                    <p className="text-[#64748b] text-sm">No pending tasks. Add some in the Tasks tab.</p>
                  ) : (
                    <ul className="space-y-2">
                      {nextActions.map((t, i) => (
                        <li key={t.id} className="flex items-center gap-3 text-sm">
                          <span className="w-5 h-5 rounded-full bg-[#6366f1]/20 text-[#6366f1] flex items-center justify-center text-xs font-bold">
                            {i + 1}
                          </span>
                          <span>{t.title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Key Metrics */}
              <div className="space-y-6">
                <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-6">
                  <h3 className="text-sm font-medium text-[#64748b] mb-4">Key Metrics</h3>
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs text-[#64748b]">Status</span>
                      <p className="text-sm font-medium">{project.status}</p>
                    </div>
                    <div>
                      <span className="text-xs text-[#64748b]">Grade</span>
                      <p className="text-sm font-medium">{project.grade}</p>
                    </div>
                    <div>
                      <span className="text-xs text-[#64748b]">Days Since Created</span>
                      <p className="text-sm font-medium">{daysSinceCreated}</p>
                    </div>
                    <div>
                      <span className="text-xs text-[#64748b]">Tasks Completed</span>
                      <p className="text-sm font-medium">
                        {doneTasks} / {tasks.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Tasks Tab ────────────────────────────────── */}
          {activeTab === "Tasks" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#64748b]">
                  {doneTasks} / {tasks.length} completed
                </p>
              </div>

              {/* Add Task */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                  placeholder="Add a new task..."
                  className="flex-1 bg-[#12121a] border border-[#1e1e2e] rounded-lg px-4 py-2.5 text-sm text-[#e2e8f0] placeholder-[#64748b] focus:outline-none focus:border-[#6366f1] transition-colors"
                />
                <button
                  onClick={handleAddTask}
                  className="px-4 py-2.5 bg-[#6366f1] hover:bg-[#5558e6] text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Add Task
                </button>
              </div>

              {/* Task List */}
              <div className="space-y-2">
                {tasks.length === 0 ? (
                  <p className="text-[#64748b] text-sm text-center py-8">No tasks yet. Add your first task above.</p>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => handleToggleTask(task.id, task.done)}
                      className="flex items-center gap-3 bg-[#12121a] border border-[#1e1e2e] rounded-lg px-4 py-3 cursor-pointer hover:border-[#6366f1]/30 transition-colors"
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          task.done
                            ? "bg-[#6366f1] border-[#6366f1]"
                            : "border-[#64748b] hover:border-[#6366f1]"
                        }`}
                      >
                        {task.done && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span
                        className={`text-sm transition-colors ${
                          task.done ? "line-through text-[#64748b]" : "text-[#e2e8f0]"
                        }`}
                      >
                        {task.title}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── Notes Tab ────────────────────────────────── */}
          {activeTab === "Notes" && (
            <div className="space-y-4">
              {/* Add Note */}
              <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-4">
                <textarea
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Write a note..."
                  rows={3}
                  className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg p-3 text-sm text-[#e2e8f0] placeholder-[#64748b] resize-none focus:outline-none focus:border-[#6366f1] transition-colors mb-3"
                />
                <button
                  onClick={handleSaveNote}
                  className="px-4 py-2 bg-[#6366f1] hover:bg-[#5558e6] text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Save Note
                </button>
              </div>

              {/* Notes List */}
              {sortedNotes.length === 0 ? (
                <p className="text-[#64748b] text-sm text-center py-8">No notes yet. Write your first note above.</p>
              ) : (
                sortedNotes.map((note) => (
                  <div
                    key={note.id}
                    className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-4"
                  >
                    <p className="text-sm text-[#e2e8f0] whitespace-pre-wrap">{note.content}</p>
                    <p className="text-xs text-[#64748b] mt-3">
                      {new Date(note.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Chat Tab ─────────────────────────────────── */}
          {activeTab === "Chat" && (
            <div className="flex flex-col h-[600px]">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                {chatMessages.length === 0 && (
                  <div className="space-y-3">
                    <p className="text-sm text-[#64748b] mb-4">
                      Chat with AI about this project. Try a prompt:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTED_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => handleSendChat(prompt)}
                          className="px-3 py-2 bg-[#12121a] border border-[#1e1e2e] rounded-lg text-sm text-[#e2e8f0] hover:border-[#6366f1]/50 hover:bg-[#6366f1]/5 transition-colors"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-[#6366f1] text-white"
                          : "bg-[#1e1e2e] text-[#e2e8f0]"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-[#1e1e2e] rounded-xl px-4 py-3 text-sm text-[#64748b]">
                      Thinking...
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="flex gap-2 pt-4 border-t border-[#1e1e2e]">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendChat()}
                  placeholder="Ask about this project..."
                  className="flex-1 bg-[#12121a] border border-[#1e1e2e] rounded-lg px-4 py-2.5 text-sm text-[#e2e8f0] placeholder-[#64748b] focus:outline-none focus:border-[#6366f1] transition-colors"
                  disabled={chatLoading}
                />
                <button
                  onClick={() => handleSendChat()}
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-4 py-2.5 bg-[#6366f1] hover:bg-[#5558e6] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
