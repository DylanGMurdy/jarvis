"use client";

import { use, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Project, ProjectTask, ProjectNote, ChatMessage } from "@/lib/types";
import VoiceChatInput from "@/components/VoiceChatInput";

const STATUSES: Project["status"][] = ["Idea", "Planning", "Building", "Launched", "Revenue"];
const TABS = ["Overview", "Tasks", "Notes", "Chat", "Files", "War Room", "History"] as const;
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

  // Drive / Files state
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState<string | null>(null);
  const [driveFolderLink, setDriveFolderLink] = useState<string | null>(null);
  const [driveFiles, setDriveFiles] = useState<{ id: string; name: string; mimeType: string; webViewLink: string }[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  // War Room state
  const [warRoomResults, setWarRoomResults] = useState<Record<string, { loading: boolean; analysis: string | null }>>({
    devils_advocate: { loading: false, analysis: null },
    market_analyst: { loading: false, analysis: null },
    risk_assessor: { loading: false, analysis: null },
  });

  // Sales Agent state (Lindy project only)
  const isLindyProject = id.startsWith("8f662ef5");
  const [salesResults, setSalesResults] = useState<Record<string, { loading: boolean; output: string | null }>>({
    find_leads: { loading: false, output: null },
    draft_outreach: { loading: false, output: null },
    generate_demo_script: { loading: false, output: null },
  });

  async function runSalesAgent(action: string) {
    setSalesResults((prev) => ({ ...prev, [action]: { loading: true, output: null } }));
    try {
      const res = await fetch("/api/agents/lindy-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      setSalesResults((prev) => ({
        ...prev,
        [action]: { loading: false, output: data.ok ? data.output : data.error || "Failed" },
      }));
    } catch {
      setSalesResults((prev) => ({ ...prev, [action]: { loading: false, output: "Connection error" } }));
    }
  }

  // CFO Agent state
  const [cfoResults, setCfoResults] = useState<Record<string, { loading: boolean; output: string | null }>>({
    revenue_model: { loading: false, output: null },
    unit_economics: { loading: false, output: null },
    funding_needs: { loading: false, output: null },
    financial_risks: { loading: false, output: null },
  });

  // COO Agent state
  const [cooResults, setCooResults] = useState<Record<string, { loading: boolean; output: string | null }>>({
    operations_plan: { loading: false, output: null },
    hiring_plan: { loading: false, output: null },
    process_map: { loading: false, output: null },
    kpis: { loading: false, output: null },
  });

  // CLO Agent state
  const [cloResults, setCloResults] = useState<Record<string, { loading: boolean; output: string | null }>>({
    legal_risks: { loading: false, output: null },
    entity_structure: { loading: false, output: null },
    contracts_needed: { loading: false, output: null },
    compliance_checklist: { loading: false, output: null },
  });

  // CHRO Agent state
  const [chroResults, setChroResults] = useState<Record<string, { loading: boolean; output: string | null }>>({
    org_structure: { loading: false, output: null },
    first_hires: { loading: false, output: null },
    culture_values: { loading: false, output: null },
    compensation_model: { loading: false, output: null },
  });

  async function runCooAgent(action: string) {
    setCooResults((prev) => ({ ...prev, [action]: { loading: true, output: null } }));
    try {
      const res = await fetch("/api/agents/coo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, projectId: id, projectTitle: project?.title, projectDescription: project?.description }),
      });
      const data = await res.json();
      setCooResults((prev) => ({
        ...prev,
        [action]: { loading: false, output: data.ok ? data.result : data.error || "Failed" },
      }));
    } catch {
      setCooResults((prev) => ({ ...prev, [action]: { loading: false, output: "Connection error" } }));
    }
  }

  async function runCloAgent(action: string) {
    setCloResults((prev) => ({ ...prev, [action]: { loading: true, output: null } }));
    try {
      const res = await fetch("/api/agents/clo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, projectId: id, projectTitle: project?.title, projectDescription: project?.description }),
      });
      const data = await res.json();
      setCloResults((prev) => ({
        ...prev,
        [action]: { loading: false, output: data.ok ? data.result : data.error || "Failed" },
      }));
      if (data.ok) loadData();
    } catch {
      setCloResults((prev) => ({ ...prev, [action]: { loading: false, output: "Connection error" } }));
    }
  }

  async function runChroAgent(action: string) {
    setChroResults((prev) => ({ ...prev, [action]: { loading: true, output: null } }));
    try {
      const res = await fetch("/api/agents/chro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, projectId: id, projectTitle: project?.title, projectDescription: project?.description }),
      });
      const data = await res.json();
      setChroResults((prev) => ({
        ...prev,
        [action]: { loading: false, output: data.ok ? data.result : data.error || "Failed" },
      }));
      if (data.ok) loadData();
    } catch {
      setChroResults((prev) => ({ ...prev, [action]: { loading: false, output: "Connection error" } }));
    }
  }

  async function runCfoAgent(action: string) {
    setCfoResults((prev) => ({ ...prev, [action]: { loading: true, output: null } }));
    try {
      const res = await fetch("/api/agents/cfo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, projectId: id, projectTitle: project?.title, projectDescription: project?.description }),
      });
      const data = await res.json();
      setCfoResults((prev) => ({
        ...prev,
        [action]: { loading: false, output: data.ok ? data.result : data.error || "Failed" },
      }));
    } catch {
      setCfoResults((prev) => ({ ...prev, [action]: { loading: false, output: "Connection error" } }));
    }
  }

  // Research Agent state
  const [researchQuery, setResearchQuery] = useState("");
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchResult, setResearchResult] = useState<string | null>(null);

  async function runResearch() {
    const q = researchQuery.trim();
    if (!q) return;
    setResearchLoading(true);
    setResearchResult(null);
    try {
      const res = await fetch("/api/agents/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, projectId: id }),
      });
      const data = await res.json();
      setResearchResult(data.ok ? data.result : data.error || "Failed");
      if (data.ok) setResearchQuery("");
    } catch {
      setResearchResult("Connection error");
    } finally {
      setResearchLoading(false);
    }
  }

  // CMO Agent state
  const [cmoResults, setCmoResults] = useState<Record<string, { loading: boolean; output: string | null }>>({
    market_analysis: { loading: false, output: null },
    content_strategy: { loading: false, output: null },
    growth_channels: { loading: false, output: null },
    brand_voice: { loading: false, output: null },
  });

  async function runCmo(action: string) {
    setCmoResults((prev) => ({ ...prev, [action]: { loading: true, output: null } }));
    try {
      const res = await fetch("/api/agents/cmo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          projectId: id,
          projectTitle: project?.title,
          projectDescription: project?.description,
        }),
      });
      const data = await res.json();
      setCmoResults((prev) => ({
        ...prev,
        [action]: { loading: false, output: data.ok ? data.result : data.error || "Failed" },
      }));
      if (data.ok) loadData(); // Refresh notes
    } catch {
      setCmoResults((prev) => ({ ...prev, [action]: { loading: false, output: "Connection error" } }));
    }
  }

  // CTO Agent state
  const [ctoResults, setCtoResults] = useState<Record<string, { loading: boolean; output: string | null }>>({
    tech_stack: { loading: false, output: null },
    build_roadmap: { loading: false, output: null },
    technical_risks: { loading: false, output: null },
    mvp_scope: { loading: false, output: null },
  });

  async function runCto(action: string) {
    setCtoResults((prev) => ({ ...prev, [action]: { loading: true, output: null } }));
    try {
      const res = await fetch("/api/agents/cto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          projectId: id,
          projectTitle: project?.title,
          projectDescription: project?.description,
        }),
      });
      const data = await res.json();
      setCtoResults((prev) => ({
        ...prev,
        [action]: { loading: false, output: data.ok ? data.result : data.error || "Failed" },
      }));
      if (data.ok) loadData();
    } catch {
      setCtoResults((prev) => ({ ...prev, [action]: { loading: false, output: "Connection error" } }));
    }
  }

  // CSO Agent state
  const [csoResults, setCsoResults] = useState<Record<string, { loading: boolean; output: string | null }>>({
    sales_strategy: { loading: false, output: null },
    prospect_list: { loading: false, output: null },
    sales_script: { loading: false, output: null },
    pricing_strategy: { loading: false, output: null },
  });

  async function runCso(action: string) {
    setCsoResults((prev) => ({ ...prev, [action]: { loading: true, output: null } }));
    try {
      const res = await fetch("/api/agents/cso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, projectId: id, projectTitle: project?.title, projectDescription: project?.description }),
      });
      const data = await res.json();
      setCsoResults((prev) => ({ ...prev, [action]: { loading: false, output: data.ok ? data.result : data.error || "Failed" } }));
      if (data.ok) loadData();
    } catch {
      setCsoResults((prev) => ({ ...prev, [action]: { loading: false, output: "Connection error" } }));
    }
  }

  // VP Sales Agent state
  const [vpSalesResults, setVpSalesResults] = useState<Record<string, { loading: boolean; output: string | null }>>({
    pipeline_structure: { loading: false, output: null },
    objection_handling: { loading: false, output: null },
    demo_script: { loading: false, output: null },
    close_playbook: { loading: false, output: null },
  });

  async function runVpSales(action: string) {
    setVpSalesResults((prev) => ({ ...prev, [action]: { loading: true, output: null } }));
    try {
      const res = await fetch("/api/agents/vp_sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, projectId: id, projectTitle: project?.title, projectDescription: project?.description }),
      });
      const data = await res.json();
      setVpSalesResults((prev) => ({ ...prev, [action]: { loading: false, output: data.ok ? data.result : data.error || "Failed" } }));
      if (data.ok) loadData();
    } catch {
      setVpSalesResults((prev) => ({ ...prev, [action]: { loading: false, output: "Connection error" } }));
    }
  }

  // VP Product Agent state
  const [vpProductResults, setVpProductResults] = useState<Record<string, { loading: boolean; output: string | null }>>({
    product_vision: { loading: false, output: null },
    feature_roadmap: { loading: false, output: null },
    user_personas: { loading: false, output: null },
    competitive_analysis: { loading: false, output: null },
  });

  async function runVpProduct(action: string) {
    setVpProductResults((prev) => ({ ...prev, [action]: { loading: true, output: null } }));
    try {
      const res = await fetch("/api/agents/vp_product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, projectId: id, projectTitle: project?.title, projectDescription: project?.description }),
      });
      const data = await res.json();
      setVpProductResults((prev) => ({ ...prev, [action]: { loading: false, output: data.ok ? data.result : data.error || "Failed" } }));
      if (data.ok) loadData();
    } catch {
      setVpProductResults((prev) => ({ ...prev, [action]: { loading: false, output: "Connection error" } }));
    }
  }

  // VP Engineering Agent state
  const [vpEngResults, setVpEngResults] = useState<Record<string, { loading: boolean; output: string | null }>>({
    architecture_plan: { loading: false, output: null },
    sprint_plan: { loading: false, output: null },
    tech_debt_audit: { loading: false, output: null },
    api_design: { loading: false, output: null },
  });

  async function runVpEng(action: string) {
    setVpEngResults((prev) => ({ ...prev, [action]: { loading: true, output: null } }));
    try {
      const res = await fetch("/api/agents/vp_engineering", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, projectId: id, projectTitle: project?.title, projectDescription: project?.description }),
      });
      const data = await res.json();
      setVpEngResults((prev) => ({ ...prev, [action]: { loading: false, output: data.ok ? data.result : data.error || "Failed" } }));
      if (data.ok) loadData();
    } catch {
      setVpEngResults((prev) => ({ ...prev, [action]: { loading: false, output: "Connection error" } }));
    }
  }

  // VP Finance Agent state
  const [vpFinanceResults, setVpFinanceResults] = useState<Record<string, { loading: boolean; output: string | null }>>({
    financial_model: { loading: false, output: null },
    cash_flow: { loading: false, output: null },
    pricing_analysis: { loading: false, output: null },
    investor_metrics: { loading: false, output: null },
  });

  async function runVpFinance(action: string) {
    setVpFinanceResults((prev) => ({ ...prev, [action]: { loading: true, output: null } }));
    try {
      const res = await fetch("/api/agents/vp_finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, projectId: id, projectTitle: project?.title, projectDescription: project?.description }),
      });
      const data = await res.json();
      setVpFinanceResults((prev) => ({ ...prev, [action]: { loading: false, output: data.ok ? data.result : data.error || "Failed" } }));
      if (data.ok) loadData();
    } catch {
      setVpFinanceResults((prev) => ({ ...prev, [action]: { loading: false, output: "Connection error" } }));
    }
  }

  // Data Analytics Agent state
  const [dataAnalyticsResults, setDataAnalyticsResults] = useState<Record<string, { loading: boolean; output: string | null }>>({
    metrics_framework: { loading: false, output: null },
    dashboard_design: { loading: false, output: null },
    data_infrastructure: { loading: false, output: null },
    ab_testing_framework: { loading: false, output: null },
  });

  async function runDataAnalytics(action: string) {
    setDataAnalyticsResults((prev) => ({ ...prev, [action]: { loading: true, output: null } }));
    try {
      const res = await fetch("/api/agents/data_analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, projectId: id, projectTitle: project?.title, projectDescription: project?.description }),
      });
      const data = await res.json();
      setDataAnalyticsResults((prev) => ({ ...prev, [action]: { loading: false, output: data.ok ? data.result : data.error || "Failed" } }));
      if (data.ok) loadData();
    } catch {
      setDataAnalyticsResults((prev) => ({ ...prev, [action]: { loading: false, output: "Connection error" } }));
    }
  }

  // Head of CX Agent state
  const [headCxResults, setHeadCxResults] = useState<Record<string, { loading: boolean; output: string | null }>>({
    cx_strategy: { loading: false, output: null },
    nps_program: { loading: false, output: null },
    support_stack: { loading: false, output: null },
    voice_of_customer: { loading: false, output: null },
  });

  async function runHeadCx(action: string) {
    setHeadCxResults((prev) => ({ ...prev, [action]: { loading: true, output: null } }));
    try {
      const res = await fetch("/api/agents/head_cx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, projectId: id, projectTitle: project?.title, projectDescription: project?.description }),
      });
      const data = await res.json();
      setHeadCxResults((prev) => ({ ...prev, [action]: { loading: false, output: data.ok ? data.result : data.error || "Failed" } }));
      if (data.ok) loadData();
    } catch {
      setHeadCxResults((prev) => ({ ...prev, [action]: { loading: false, output: "Connection error" } }));
    }
  }

  // VP Operations Agent state
  const [vpOpsResults, setVpOpsResults] = useState<Record<string, { loading: boolean; output: string | null }>>({
    operations_stack: { loading: false, output: null },
    sop_framework: { loading: false, output: null },
    vendor_strategy: { loading: false, output: null },
    scale_plan: { loading: false, output: null },
  });

  async function runVpOps(action: string) {
    setVpOpsResults((prev) => ({ ...prev, [action]: { loading: true, output: null } }));
    try {
      const res = await fetch("/api/agents/vp_operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, projectId: id, projectTitle: project?.title, projectDescription: project?.description }),
      });
      const data = await res.json();
      setVpOpsResults((prev) => ({ ...prev, [action]: { loading: false, output: data.ok ? data.result : data.error || "Failed" } }));
      if (data.ok) loadData();
    } catch {
      setVpOpsResults((prev) => ({ ...prev, [action]: { loading: false, output: "Connection error" } }));
    }
  }

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

  // ─── Drive helpers ──────────────────────────────────────
  const loadDriveFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/drive`);
      const data = await res.json();
      setDriveConnected(!!data.connected);
      setDriveFolderId(data.folderId || null);
      setDriveFolderLink(data.folderLink || null);
      setDriveFiles(data.files || []);
    } catch { /* silent */ }
  }, [id]);

  async function connectDrive() {
    setDriveLoading(true);
    setDriveError(null);
    try {
      const res = await fetch(`/api/projects/${id}/drive`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setDriveConnected(true);
        setDriveFolderId(data.folderId);
        setDriveFolderLink(data.folderLink);
        loadDriveFiles();
      } else {
        setDriveError(data.error || "Failed to connect Drive");
      }
    } catch {
      setDriveError("Connection error");
    }
    setDriveLoading(false);
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

  // Load Drive files when Files tab is selected
  useEffect(() => {
    if (activeTab === "Files") {
      loadDriveFiles();
    }
  }, [activeTab, loadDriveFiles]);

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

          {/* ── Files (Google Drive) ──────────────────── */}
          {activeTab === "Files" && (
            <div className="space-y-4">
              {!driveConnected ? (
                <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1e1e2e] flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Connect Google Drive</h3>
                  <p className="text-sm text-[#64748b] mb-6 max-w-md mx-auto">
                    Create a dedicated Drive folder for this project to store documents, assets, and files.
                  </p>
                  <button
                    onClick={connectDrive}
                    disabled={driveLoading}
                    className="px-6 py-3 bg-[#6366f1] text-white rounded-lg text-sm font-medium hover:bg-[#5558e6] disabled:opacity-50 transition-colors"
                  >
                    {driveLoading ? "Creating folder..." : "Connect Google Drive"}
                  </button>
                  {driveError && (
                    <p className="text-red-400 text-sm mt-4">{driveError}</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#6366f1]/10 flex items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Jarvis — {project.title}</h3>
                        <p className="text-xs text-[#64748b]">Google Drive folder connected</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={loadDriveFiles} className="px-3 py-1.5 text-xs text-[#64748b] hover:text-[#e2e8f0] transition-colors">Refresh</button>
                      {driveFolderLink && (
                        <a
                          href={driveFolderLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-[#6366f1] text-white rounded-lg text-sm font-medium hover:bg-[#5558e6] transition-colors inline-flex items-center gap-2"
                        >
                          Open in Drive
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
                        </a>
                      )}
                    </div>
                  </div>

                  {driveFolderLink && (
                    <a
                      href={driveFolderLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-[#12121a] rounded-xl border border-dashed border-[#1e1e2e] p-4 text-center hover:border-[#6366f1]/50 hover:bg-[#6366f1]/5 transition-colors"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" className="mx-auto mb-2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
                      <span className="text-sm text-[#64748b]">Upload files — opens Drive folder</span>
                    </a>
                  )}

                  {driveFiles.length === 0 ? (
                    <p className="text-[#64748b] text-sm text-center py-8">No files in this folder yet. Upload files via Google Drive.</p>
                  ) : (
                    <div className="space-y-2">
                      {driveFiles.map((file) => (
                        <a
                          key={file.id}
                          href={file.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 bg-[#12121a] border border-[#1e1e2e] rounded-lg px-4 py-3 hover:border-[#6366f1]/30 transition-colors"
                        >
                          <div className="w-8 h-8 rounded bg-[#1e1e2e] flex items-center justify-center text-xs text-[#64748b] font-medium">
                            {file.mimeType.includes("folder") ? "📁" :
                             file.mimeType.includes("document") ? "📄" :
                             file.mimeType.includes("spreadsheet") ? "📊" :
                             file.mimeType.includes("presentation") ? "📽" :
                             file.mimeType.includes("image") ? "🖼" :
                             file.mimeType.includes("pdf") ? "📕" : "📎"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#e2e8f0] truncate">{file.name}</p>
                            <p className="text-xs text-[#64748b]">{file.mimeType.split(".").pop()?.replace("apps.", "") || file.mimeType}</p>
                          </div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
                        </a>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── War Room ────────────────────────────────── */}
          {activeTab === "War Room" && (
            <div className="space-y-6">
              {/* ── Sales Agent (Lindy project only) ──── */}
              {isLindyProject && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-[#6366f1]/10 to-[#8b5cf6]/10 rounded-xl border border-[#6366f1]/30 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🤝</span>
                      <h3 className="text-lg font-bold text-white">Sales Agent</h3>
                    </div>
                    <p className="text-sm text-[#64748b]">AI-powered sales tools for the Lindy agent business. Results save to project notes.</p>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {([
                      { key: "find_leads", icon: "🎯", name: "Find Leads", desc: "10 Utah brokerages that need Lindy agents", btnClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20", borderClass: "border-emerald-500/20" },
                      { key: "draft_outreach", icon: "✉️", name: "Draft Outreach", desc: "Cold text, warm follow-up, and email drafts", btnClass: "bg-violet-500/10 border-violet-500/30 text-violet-400 hover:bg-violet-500/20", borderClass: "border-violet-500/20" },
                      { key: "generate_demo_script", icon: "🎬", name: "Demo Script", desc: "5-minute walkthrough script for prospects", btnClass: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20", borderClass: "border-cyan-500/20" },
                    ] as const).map((panel) => (
                      <div key={panel.key} className={`bg-[#12121a] rounded-xl border ${salesResults[panel.key].output ? panel.borderClass : "border-[#1e1e2e]"} flex flex-col`}>
                        <div className="p-4 border-b border-[#1e1e2e]">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{panel.icon}</span>
                            <h4 className="text-sm font-bold text-white">{panel.name}</h4>
                          </div>
                          <p className="text-xs text-[#64748b]">{panel.desc}</p>
                        </div>
                        <div className="flex-1 p-4 min-h-[100px] max-h-[400px] overflow-y-auto">
                          {salesResults[panel.key].loading ? (
                            <div className="text-sm text-[#64748b] animate-pulse">Generating...</div>
                          ) : salesResults[panel.key].output ? (
                            <div className="text-sm text-[#e2e8f0] whitespace-pre-wrap leading-relaxed">{salesResults[panel.key].output}</div>
                          ) : (
                            <p className="text-sm text-[#64748b]">Click below to generate.</p>
                          )}
                        </div>
                        <div className="p-4 border-t border-[#1e1e2e]">
                          <button
                            onClick={() => runSalesAgent(panel.key)}
                            disabled={salesResults[panel.key].loading}
                            className={`w-full px-4 py-2.5 border rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${panel.btnClass}`}
                          >
                            {salesResults[panel.key].loading ? "Running..." : salesResults[panel.key].output ? "Regenerate" : "Generate"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

              {/* ── CFO Agent ──────────────────────────── */}
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-xl border border-emerald-500/30 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">💰</span>
                    <h3 className="text-lg font-bold text-white">CFO Agent</h3>
                  </div>
                  <p className="text-sm text-[#64748b]">Financial analysis and projections. Results are saved to project notes.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {([
                    { key: "revenue_model", icon: "📈", name: "Revenue Model", desc: "Pricing, revenue streams, 12-month projection", btnClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20", borderClass: "border-emerald-500/20" },
                    { key: "unit_economics", icon: "🧮", name: "Unit Economics", desc: "CAC, LTV, margins, break-even analysis", btnClass: "bg-teal-500/10 border-teal-500/30 text-teal-400 hover:bg-teal-500/20", borderClass: "border-teal-500/20" },
                    { key: "funding_needs", icon: "🏦", name: "Funding Needs", desc: "Bootstrap vs funded path, resource needs", btnClass: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20", borderClass: "border-cyan-500/20" },
                    { key: "financial_risks", icon: "🛡️", name: "Financial Risks", desc: "Top 5 risks with mitigation strategies", btnClass: "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20", borderClass: "border-amber-500/20" },
                  ] as const).map((panel) => (
                    <div key={panel.key} className={`bg-[#12121a] rounded-xl border ${cfoResults[panel.key].output ? panel.borderClass : "border-[#1e1e2e]"} flex flex-col`}>
                      <div className="p-4 border-b border-[#1e1e2e]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{panel.icon}</span>
                          <h4 className="text-sm font-bold text-white">{panel.name}</h4>
                        </div>
                        <p className="text-xs text-[#64748b]">{panel.desc}</p>
                      </div>
                      <div className="flex-1 p-4 min-h-[80px] max-h-[400px] overflow-y-auto">
                        {cfoResults[panel.key].loading ? (
                          <div className="text-sm text-[#64748b] animate-pulse">Analyzing financials...</div>
                        ) : cfoResults[panel.key].output ? (
                          <div className="text-sm text-[#e2e8f0] whitespace-pre-wrap leading-relaxed">{cfoResults[panel.key].output}</div>
                        ) : (
                          <p className="text-sm text-[#64748b]">Click below to run analysis.</p>
                        )}
                      </div>
                      <div className="p-4 border-t border-[#1e1e2e]">
                        <button
                          onClick={() => runCfoAgent(panel.key)}
                          disabled={cfoResults[panel.key].loading}
                          className={`w-full px-4 py-2.5 border rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${panel.btnClass}`}
                        >
                          {cfoResults[panel.key].loading ? "Running..." : cfoResults[panel.key].output ? "Re-run" : "Run Analysis"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── CMO Agent ─────────────────────────── */}
              <div className="bg-gradient-to-r from-[#ec4899]/10 to-[#f97316]/10 rounded-xl border border-[#ec4899]/30 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">📣</span>
                  <h3 className="text-lg font-bold text-white">CMO Agent</h3>
                </div>
                <p className="text-sm text-[#64748b]">Chief Marketing Officer — market analysis, content strategy, growth channels, and brand voice.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {([
                  { key: "market_analysis", icon: "🎯", name: "Market Analysis", desc: "Market size, audience, competitors, positioning", btnClass: "bg-pink-500/10 border-pink-500/30 text-pink-400 hover:bg-pink-500/20", borderClass: "border-pink-500/20" },
                  { key: "content_strategy", icon: "📝", name: "Content Strategy", desc: "30-day content plan with channels and messaging", btnClass: "bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20", borderClass: "border-orange-500/20" },
                  { key: "growth_channels", icon: "📈", name: "Growth Channels", desc: "Top 5 channels with effort/impact scores", btnClass: "bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400 hover:bg-fuchsia-500/20", borderClass: "border-fuchsia-500/20" },
                  { key: "brand_voice", icon: "🎤", name: "Brand Voice", desc: "Voice, tone, messaging guidelines, and sample copy", btnClass: "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20", borderClass: "border-rose-500/20" },
                ] as const).map((panel) => (
                  <div key={panel.key} className={`bg-[#12121a] rounded-xl border ${cmoResults[panel.key].output ? panel.borderClass : "border-[#1e1e2e]"} flex flex-col`}>
                    <div className="p-4 border-b border-[#1e1e2e]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{panel.icon}</span>
                        <h4 className="text-sm font-bold text-white">{panel.name}</h4>
                      </div>
                      <p className="text-xs text-[#64748b]">{panel.desc}</p>
                    </div>
                    <div className="flex-1 p-4 min-h-[100px] max-h-[400px] overflow-y-auto">
                      {cmoResults[panel.key].loading ? (
                        <div className="text-sm text-[#64748b] animate-pulse">CMO is working...</div>
                      ) : cmoResults[panel.key].output ? (
                        <div className="text-sm text-[#e2e8f0] whitespace-pre-wrap leading-relaxed">{cmoResults[panel.key].output}</div>
                      ) : (
                        <p className="text-sm text-[#64748b]">Click below to run.</p>
                      )}
                    </div>
                    <div className="p-4 border-t border-[#1e1e2e]">
                      <button
                        onClick={() => runCmo(panel.key)}
                        disabled={cmoResults[panel.key].loading}
                        className={`w-full px-4 py-2.5 border rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${panel.btnClass}`}
                      >
                        {cmoResults[panel.key].loading ? "Running..." : cmoResults[panel.key].output ? "Re-run" : "Run Analysis"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── CTO Agent ─────────────────────────── */}
              <div className="bg-gradient-to-r from-[#3b82f6]/10 to-[#06b6d4]/10 rounded-xl border border-[#3b82f6]/30 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🛠️</span>
                  <h3 className="text-lg font-bold text-white">CTO Agent</h3>
                </div>
                <p className="text-sm text-[#64748b]">Chief Technology Officer — tech stack, build roadmap, technical risks, and MVP scope.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {([
                  { key: "tech_stack", icon: "⚙️", name: "Tech Stack", desc: "Best stack for this project with justification", btnClass: "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20", borderClass: "border-blue-500/20" },
                  { key: "build_roadmap", icon: "🗺️", name: "Build Roadmap", desc: "Phased technical roadmap with milestones", btnClass: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20", borderClass: "border-cyan-500/20" },
                  { key: "technical_risks", icon: "🚨", name: "Technical Risks", desc: "Top risks with severity, likelihood, and mitigation", btnClass: "bg-sky-500/10 border-sky-500/30 text-sky-400 hover:bg-sky-500/20", borderClass: "border-sky-500/20" },
                  { key: "mvp_scope", icon: "🎯", name: "MVP Scope", desc: "Minimum viable product — what to build first", btnClass: "bg-teal-500/10 border-teal-500/30 text-teal-400 hover:bg-teal-500/20", borderClass: "border-teal-500/20" },
                ] as const).map((panel) => (
                  <div key={panel.key} className={`bg-[#12121a] rounded-xl border ${ctoResults[panel.key].output ? panel.borderClass : "border-[#1e1e2e]"} flex flex-col`}>
                    <div className="p-4 border-b border-[#1e1e2e]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{panel.icon}</span>
                        <h4 className="text-sm font-bold text-white">{panel.name}</h4>
                      </div>
                      <p className="text-xs text-[#64748b]">{panel.desc}</p>
                    </div>
                    <div className="flex-1 p-4 min-h-[100px] max-h-[400px] overflow-y-auto">
                      {ctoResults[panel.key].loading ? (
                        <div className="text-sm text-[#64748b] animate-pulse">CTO is working...</div>
                      ) : ctoResults[panel.key].output ? (
                        <div className="text-sm text-[#e2e8f0] whitespace-pre-wrap leading-relaxed">{ctoResults[panel.key].output}</div>
                      ) : (
                        <p className="text-sm text-[#64748b]">Click below to run.</p>
                      )}
                    </div>
                    <div className="p-4 border-t border-[#1e1e2e]">
                      <button
                        onClick={() => runCto(panel.key)}
                        disabled={ctoResults[panel.key].loading}
                        className={`w-full px-4 py-2.5 border rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${panel.btnClass}`}
                      >
                        {ctoResults[panel.key].loading ? "Running..." : ctoResults[panel.key].output ? "Re-run" : "Run Analysis"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── COO Agent ──────────────────────────── */}
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-sky-500/10 to-indigo-500/10 rounded-xl border border-sky-500/30 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">⚙️</span>
                    <h3 className="text-lg font-bold text-white">COO Agent</h3>
                  </div>
                  <p className="text-sm text-[#64748b]">Operations strategy — plans, processes, hiring, and KPIs. Results saved to project notes.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {([
                    { key: "operations_plan", icon: "📋", name: "Operations Plan", desc: "Day-to-day schedule, weekly cadence, automation", btnClass: "bg-sky-500/10 border-sky-500/30 text-sky-400 hover:bg-sky-500/20", borderClass: "border-sky-500/20" },
                    { key: "hiring_plan", icon: "👥", name: "Hiring Plan", desc: "Roles needed, automate-first, hire triggers", btnClass: "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20", borderClass: "border-indigo-500/20" },
                    { key: "process_map", icon: "🗺️", name: "Process Map", desc: "Customer journey, fulfillment, sales, support", btnClass: "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20", borderClass: "border-blue-500/20" },
                    { key: "kpis", icon: "📊", name: "KPIs", desc: "5 key metrics with targets and red flags", btnClass: "bg-violet-500/10 border-violet-500/30 text-violet-400 hover:bg-violet-500/20", borderClass: "border-violet-500/20" },
                  ] as const).map((panel) => (
                    <div key={panel.key} className={`bg-[#12121a] rounded-xl border ${cooResults[panel.key].output ? panel.borderClass : "border-[#1e1e2e]"} flex flex-col`}>
                      <div className="p-4 border-b border-[#1e1e2e]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{panel.icon}</span>
                          <h4 className="text-sm font-bold text-white">{panel.name}</h4>
                        </div>
                        <p className="text-xs text-[#64748b]">{panel.desc}</p>
                      </div>
                      <div className="flex-1 p-4 min-h-[80px] max-h-[400px] overflow-y-auto">
                        {cooResults[panel.key].loading ? (
                          <div className="text-sm text-[#64748b] animate-pulse">Planning operations...</div>
                        ) : cooResults[panel.key].output ? (
                          <div className="text-sm text-[#e2e8f0] whitespace-pre-wrap leading-relaxed">{cooResults[panel.key].output}</div>
                        ) : (
                          <p className="text-sm text-[#64748b]">Click below to run analysis.</p>
                        )}
                      </div>
                      <div className="p-4 border-t border-[#1e1e2e]">
                        <button
                          onClick={() => runCooAgent(panel.key)}
                          disabled={cooResults[panel.key].loading}
                          className={`w-full px-4 py-2.5 border rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${panel.btnClass}`}
                        >
                          {cooResults[panel.key].loading ? "Running..." : cooResults[panel.key].output ? "Re-run" : "Run Analysis"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── CLO Agent ──────────────────────────── */}
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/30 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">⚖️</span>
                    <h3 className="text-lg font-bold text-white">CLO Agent</h3>
                  </div>
                  <p className="text-sm text-[#64748b]">Legal strategy — risks, entity structure, contracts, and compliance. Results saved to project notes.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {([
                    { key: "legal_risks", icon: "⚠️", name: "Legal Risks", desc: "IP, liability, compliance, contract risks", btnClass: "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20", borderClass: "border-amber-500/20" },
                    { key: "entity_structure", icon: "🏛️", name: "Entity Structure", desc: "LLC vs S-Corp vs C-Corp recommendation", btnClass: "bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20", borderClass: "border-orange-500/20" },
                    { key: "contracts_needed", icon: "📝", name: "Contracts Needed", desc: "All legal docs needed to launch and operate", btnClass: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20", borderClass: "border-yellow-500/20" },
                    { key: "compliance_checklist", icon: "✅", name: "Compliance Checklist", desc: "Regulatory requirements for your industry", btnClass: "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20", borderClass: "border-red-500/20" },
                  ] as const).map((panel) => (
                    <div key={panel.key} className={`bg-[#12121a] rounded-xl border ${cloResults[panel.key].output ? panel.borderClass : "border-[#1e1e2e]"} flex flex-col`}>
                      <div className="p-4 border-b border-[#1e1e2e]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{panel.icon}</span>
                          <h4 className="text-sm font-bold text-white">{panel.name}</h4>
                        </div>
                        <p className="text-xs text-[#64748b]">{panel.desc}</p>
                      </div>
                      <div className="flex-1 p-4 min-h-[80px] max-h-[400px] overflow-y-auto">
                        {cloResults[panel.key].loading ? (
                          <div className="text-sm text-[#64748b] animate-pulse">Analyzing legal landscape...</div>
                        ) : cloResults[panel.key].output ? (
                          <div className="text-sm text-[#e2e8f0] whitespace-pre-wrap leading-relaxed">{cloResults[panel.key].output}</div>
                        ) : (
                          <p className="text-sm text-[#64748b]">Click below to run analysis.</p>
                        )}
                      </div>
                      <div className="p-4 border-t border-[#1e1e2e]">
                        <button
                          onClick={() => runCloAgent(panel.key)}
                          disabled={cloResults[panel.key].loading}
                          className={`w-full px-4 py-2.5 border rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${panel.btnClass}`}
                        >
                          {cloResults[panel.key].loading ? "Running..." : cloResults[panel.key].output ? "Re-run" : "Run Analysis"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── CHRO Agent ─────────────────────────── */}
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-rose-500/10 to-pink-500/10 rounded-xl border border-rose-500/30 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">👥</span>
                    <h3 className="text-lg font-bold text-white">CHRO Agent</h3>
                  </div>
                  <p className="text-sm text-[#64748b]">People strategy — org structure, hiring, culture, and compensation. Results saved to project notes.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {([
                    { key: "org_structure", icon: "🏗️", name: "Org Structure", desc: "Optimal team structure for current stage", btnClass: "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20", borderClass: "border-rose-500/20" },
                    { key: "first_hires", icon: "🎯", name: "First 3 Hires", desc: "Who to hire or automate first and why", btnClass: "bg-pink-500/10 border-pink-500/30 text-pink-400 hover:bg-pink-500/20", borderClass: "border-pink-500/20" },
                    { key: "culture_values", icon: "💎", name: "Culture & Values", desc: "Core values and operating principles", btnClass: "bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400 hover:bg-fuchsia-500/20", borderClass: "border-fuchsia-500/20" },
                    { key: "compensation_model", icon: "💰", name: "Compensation Model", desc: "Pay structure for early team members", btnClass: "bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20", borderClass: "border-purple-500/20" },
                  ] as const).map((panel) => (
                    <div key={panel.key} className={`bg-[#12121a] rounded-xl border ${chroResults[panel.key].output ? panel.borderClass : "border-[#1e1e2e]"} flex flex-col`}>
                      <div className="p-4 border-b border-[#1e1e2e]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{panel.icon}</span>
                          <h4 className="text-sm font-bold text-white">{panel.name}</h4>
                        </div>
                        <p className="text-xs text-[#64748b]">{panel.desc}</p>
                      </div>
                      <div className="flex-1 p-4 min-h-[80px] max-h-[400px] overflow-y-auto">
                        {chroResults[panel.key].loading ? (
                          <div className="text-sm text-[#64748b] animate-pulse">Building people strategy...</div>
                        ) : chroResults[panel.key].output ? (
                          <div className="text-sm text-[#e2e8f0] whitespace-pre-wrap leading-relaxed">{chroResults[panel.key].output}</div>
                        ) : (
                          <p className="text-sm text-[#64748b]">Click below to run analysis.</p>
                        )}
                      </div>
                      <div className="p-4 border-t border-[#1e1e2e]">
                        <button
                          onClick={() => runChroAgent(panel.key)}
                          disabled={chroResults[panel.key].loading}
                          className={`w-full px-4 py-2.5 border rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${panel.btnClass}`}
                        >
                          {chroResults[panel.key].loading ? "Running..." : chroResults[panel.key].output ? "Re-run" : "Run Analysis"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── VP Product Agent ─────────────────────── */}
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/30 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🎯</span>
                    <h3 className="text-lg font-bold text-white">VP of Product</h3>
                  </div>
                  <p className="text-sm text-[#64748b]">Product strategy — vision, roadmap, personas, and competitive positioning. Saved to notes.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {([
                    { key: "product_vision", icon: "🔭", name: "Product Vision", desc: "Vision, mission, north star metric, principles", btnClass: "bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20", borderClass: "border-purple-500/20" },
                    { key: "feature_roadmap", icon: "🗓️", name: "Feature Roadmap", desc: "90-day RICE-scored prioritized roadmap", btnClass: "bg-pink-500/10 border-pink-500/30 text-pink-400 hover:bg-pink-500/20", borderClass: "border-pink-500/20" },
                    { key: "user_personas", icon: "👤", name: "User Personas", desc: "3 detailed personas with goals and pain points", btnClass: "bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400 hover:bg-fuchsia-500/20", borderClass: "border-fuchsia-500/20" },
                    { key: "competitive_analysis", icon: "⚔️", name: "Competitive Analysis", desc: "3-5 competitors with feature gaps and positioning", btnClass: "bg-violet-500/10 border-violet-500/30 text-violet-400 hover:bg-violet-500/20", borderClass: "border-violet-500/20" },
                  ] as const).map((panel) => (
                    <div key={panel.key} className={`bg-[#12121a] rounded-xl border ${vpProductResults[panel.key].output ? panel.borderClass : "border-[#1e1e2e]"} flex flex-col`}>
                      <div className="p-4 border-b border-[#1e1e2e]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{panel.icon}</span>
                          <h4 className="text-sm font-bold text-white">{panel.name}</h4>
                        </div>
                        <p className="text-xs text-[#64748b]">{panel.desc}</p>
                      </div>
                      <div className="flex-1 p-4 min-h-[80px] max-h-[400px] overflow-y-auto">
                        {vpProductResults[panel.key].loading ? (
                          <div className="text-sm text-[#64748b] animate-pulse">Defining product strategy...</div>
                        ) : vpProductResults[panel.key].output ? (
                          <div className="text-sm text-[#e2e8f0] whitespace-pre-wrap leading-relaxed">{vpProductResults[panel.key].output}</div>
                        ) : (
                          <p className="text-sm text-[#64748b]">Click below to run analysis.</p>
                        )}
                      </div>
                      <div className="p-4 border-t border-[#1e1e2e]">
                        <button
                          onClick={() => runVpProduct(panel.key)}
                          disabled={vpProductResults[panel.key].loading}
                          className={`w-full px-4 py-2.5 border rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${panel.btnClass}`}
                        >
                          {vpProductResults[panel.key].loading ? "Running..." : vpProductResults[panel.key].output ? "Re-run" : "Run Analysis"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── VP Engineering Agent ──────────────────── */}
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-xl border border-orange-500/30 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🔧</span>
                    <h3 className="text-lg font-bold text-white">VP of Engineering</h3>
                  </div>
                  <p className="text-sm text-[#64748b]">Technical planning — architecture, sprints, tech debt prevention, API design. Saved to notes.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {([
                    { key: "architecture_plan", icon: "🏗️", name: "Architecture Plan", desc: "System design, DB schema, data flow, infra", btnClass: "bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20", borderClass: "border-orange-500/20" },
                    { key: "sprint_plan", icon: "🏃", name: "Sprint Plan", desc: "2-week sprint with tasks and story points", btnClass: "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20", borderClass: "border-red-500/20" },
                    { key: "tech_debt_audit", icon: "🧹", name: "Tech Debt Audit", desc: "Top 5 risks and prevention strategies", btnClass: "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20", borderClass: "border-amber-500/20" },
                    { key: "api_design", icon: "🔌", name: "API Design", desc: "Core endpoints with schemas and examples", btnClass: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20", borderClass: "border-yellow-500/20" },
                  ] as const).map((panel) => (
                    <div key={panel.key} className={`bg-[#12121a] rounded-xl border ${vpEngResults[panel.key].output ? panel.borderClass : "border-[#1e1e2e]"} flex flex-col`}>
                      <div className="p-4 border-b border-[#1e1e2e]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{panel.icon}</span>
                          <h4 className="text-sm font-bold text-white">{panel.name}</h4>
                        </div>
                        <p className="text-xs text-[#64748b]">{panel.desc}</p>
                      </div>
                      <div className="flex-1 p-4 min-h-[80px] max-h-[400px] overflow-y-auto">
                        {vpEngResults[panel.key].loading ? (
                          <div className="text-sm text-[#64748b] animate-pulse">Engineering planning...</div>
                        ) : vpEngResults[panel.key].output ? (
                          <div className="text-sm text-[#e2e8f0] whitespace-pre-wrap leading-relaxed">{vpEngResults[panel.key].output}</div>
                        ) : (
                          <p className="text-sm text-[#64748b]">Click below to run analysis.</p>
                        )}
                      </div>
                      <div className="p-4 border-t border-[#1e1e2e]">
                        <button
                          onClick={() => runVpEng(panel.key)}
                          disabled={vpEngResults[panel.key].loading}
                          className={`w-full px-4 py-2.5 border rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${panel.btnClass}`}
                        >
                          {vpEngResults[panel.key].loading ? "Running..." : vpEngResults[panel.key].output ? "Re-run" : "Run Analysis"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── CSO Agent ─────────────────────────── */}
              <div className="bg-gradient-to-r from-[#f59e0b]/10 to-[#ef4444]/10 rounded-xl border border-[#f59e0b]/30 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">💼</span>
                  <h3 className="text-lg font-bold text-white">CSO Agent</h3>
                </div>
                <p className="text-sm text-[#64748b]">Chief Sales Officer — sales strategy, prospect list, outreach scripts, and pricing.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {([
                  { key: "sales_strategy", icon: "🎯", name: "Sales Strategy", desc: "GTM strategy, ICP, sales motion, and first 90 days", btnClass: "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20", borderClass: "border-amber-500/20" },
                  { key: "prospect_list", icon: "📋", name: "Prospect List", desc: "10 ideal first customers with how to reach them", btnClass: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20", borderClass: "border-yellow-500/20" },
                  { key: "sales_script", icon: "✉️", name: "Sales Script", desc: "Cold email sequence, LinkedIn DM, and SMS scripts", btnClass: "bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20", borderClass: "border-orange-500/20" },
                  { key: "pricing_strategy", icon: "💲", name: "Pricing Strategy", desc: "Pricing tiers, anchoring, and discount guidelines", btnClass: "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20", borderClass: "border-red-500/20" },
                ] as const).map((panel) => (
                  <div key={panel.key} className={`bg-[#12121a] rounded-xl border ${csoResults[panel.key].output ? panel.borderClass : "border-[#1e1e2e]"} flex flex-col`}>
                    <div className="p-4 border-b border-[#1e1e2e]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{panel.icon}</span>
                        <h4 className="text-sm font-bold text-white">{panel.name}</h4>
                      </div>
                      <p className="text-xs text-[#64748b]">{panel.desc}</p>
                    </div>
                    <div className="flex-1 p-4 min-h-[100px] max-h-[400px] overflow-y-auto">
                      {csoResults[panel.key].loading ? (
                        <div className="text-sm text-[#64748b] animate-pulse">CSO is working...</div>
                      ) : csoResults[panel.key].output ? (
                        <div className="text-sm text-[#e2e8f0] whitespace-pre-wrap leading-relaxed">{csoResults[panel.key].output}</div>
                      ) : (
                        <p className="text-sm text-[#64748b]">Click below to run.</p>
                      )}
                    </div>
                    <div className="p-4 border-t border-[#1e1e2e]">
                      <button onClick={() => runCso(panel.key)} disabled={csoResults[panel.key].loading} className={`w-full px-4 py-2.5 border rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${panel.btnClass}`}>
                        {csoResults[panel.key].loading ? "Running..." : csoResults[panel.key].output ? "Re-run" : "Run Analysis"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── VP Sales Agent ────────────────────────── */}
              <div className="bg-gradient-to-r from-[#a855f7]/10 to-[#6366f1]/10 rounded-xl border border-[#a855f7]/30 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🤝</span>
                  <h3 className="text-lg font-bold text-white">VP of Sales</h3>
                </div>
                <p className="text-sm text-[#64748b]">Pipeline design, objection handling, demo scripts, and closing playbooks.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {([
                  { key: "pipeline_structure", icon: "🔄", name: "Pipeline Structure", desc: "Sales stages with entry/exit criteria", btnClass: "bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20", borderClass: "border-purple-500/20" },
                  { key: "objection_handling", icon: "🛡️", name: "Objection Handling", desc: "Top 5 objections with word-for-word responses", btnClass: "bg-violet-500/10 border-violet-500/30 text-violet-400 hover:bg-violet-500/20", borderClass: "border-violet-500/20" },
                  { key: "demo_script", icon: "🎬", name: "Demo Script", desc: "10-minute demo that converts prospects", btnClass: "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20", borderClass: "border-indigo-500/20" },
                  { key: "close_playbook", icon: "🏆", name: "Close Playbook", desc: "Closing tactics for each deal stage", btnClass: "bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400 hover:bg-fuchsia-500/20", borderClass: "border-fuchsia-500/20" },
                ] as const).map((panel) => (
                  <div key={panel.key} className={`bg-[#12121a] rounded-xl border ${vpSalesResults[panel.key].output ? panel.borderClass : "border-[#1e1e2e]"} flex flex-col`}>
                    <div className="p-4 border-b border-[#1e1e2e]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{panel.icon}</span>
                        <h4 className="text-sm font-bold text-white">{panel.name}</h4>
                      </div>
                      <p className="text-xs text-[#64748b]">{panel.desc}</p>
                    </div>
                    <div className="flex-1 p-4 min-h-[100px] max-h-[400px] overflow-y-auto">
                      {vpSalesResults[panel.key].loading ? (
                        <div className="text-sm text-[#64748b] animate-pulse">VP Sales is working...</div>
                      ) : vpSalesResults[panel.key].output ? (
                        <div className="text-sm text-[#e2e8f0] whitespace-pre-wrap leading-relaxed">{vpSalesResults[panel.key].output}</div>
                      ) : (
                        <p className="text-sm text-[#64748b]">Click below to run.</p>
                      )}
                    </div>
                    <div className="p-4 border-t border-[#1e1e2e]">
                      <button onClick={() => runVpSales(panel.key)} disabled={vpSalesResults[panel.key].loading} className={`w-full px-4 py-2.5 border rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${panel.btnClass}`}>
                        {vpSalesResults[panel.key].loading ? "Running..." : vpSalesResults[panel.key].output ? "Re-run" : "Run Analysis"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Head of CX Agent ─────────────────────── */}
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-rose-500/10 to-pink-500/10 rounded-xl border border-rose-500/30 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">💬</span>
                    <h3 className="text-lg font-bold text-white">Head of Customer Experience</h3>
                  </div>
                  <p className="text-sm text-[#64748b]">Customer experience — journey maps, NPS, support tools, and feedback programs. Saved to notes.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {([
                    { key: "cx_strategy", icon: "🗺️", name: "CX Strategy", desc: "Full journey from first touch to advocate", btnClass: "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20", borderClass: "border-rose-500/20" },
                    { key: "nps_program", icon: "📊", name: "NPS Program", desc: "Survey design, scoring, response playbooks", btnClass: "bg-pink-500/10 border-pink-500/30 text-pink-400 hover:bg-pink-500/20", borderClass: "border-pink-500/20" },
                    { key: "support_stack", icon: "🛠️", name: "Support Stack", desc: "Tools by growth stage with cost analysis", btnClass: "bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400 hover:bg-fuchsia-500/20", borderClass: "border-fuchsia-500/20" },
                    { key: "voice_of_customer", icon: "🎙️", name: "Voice of Customer", desc: "Feedback capture, synthesis, and action pipeline", btnClass: "bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20", borderClass: "border-purple-500/20" },
                  ] as const).map((panel) => (
                    <div key={panel.key} className={`bg-[#12121a] rounded-xl border ${headCxResults[panel.key].output ? panel.borderClass : "border-[#1e1e2e]"} flex flex-col`}>
                      <div className="p-4 border-b border-[#1e1e2e]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{panel.icon}</span>
                          <h4 className="text-sm font-bold text-white">{panel.name}</h4>
                        </div>
                        <p className="text-xs text-[#64748b]">{panel.desc}</p>
                      </div>
                      <div className="flex-1 p-4 min-h-[80px] max-h-[400px] overflow-y-auto">
                        {headCxResults[panel.key].loading ? (
                          <div className="text-sm text-[#64748b] animate-pulse">Designing experience...</div>
                        ) : headCxResults[panel.key].output ? (
                          <div className="text-sm text-[#e2e8f0] whitespace-pre-wrap leading-relaxed">{headCxResults[panel.key].output}</div>
                        ) : (
                          <p className="text-sm text-[#64748b]">Click below to run analysis.</p>
                        )}
                      </div>
                      <div className="p-4 border-t border-[#1e1e2e]">
                        <button
                          onClick={() => runHeadCx(panel.key)}
                          disabled={headCxResults[panel.key].loading}
                          className={`w-full px-4 py-2.5 border rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${panel.btnClass}`}
                        >
                          {headCxResults[panel.key].loading ? "Running..." : headCxResults[panel.key].output ? "Re-run" : "Run Analysis"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── VP Operations Agent ───────────────────── */}
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-lime-500/10 to-green-500/10 rounded-xl border border-lime-500/30 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🏭</span>
                    <h3 className="text-lg font-bold text-white">VP of Operations</h3>
                  </div>
                  <p className="text-sm text-[#64748b]">Operational systems — tech stack, SOPs, vendor strategy, and scaling plans. Saved to notes.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {([
                    { key: "operations_stack", icon: "🧰", name: "Operations Stack", desc: "Full tool recommendations by category", btnClass: "bg-lime-500/10 border-lime-500/30 text-lime-400 hover:bg-lime-500/20", borderClass: "border-lime-500/20" },
                    { key: "sop_framework", icon: "📋", name: "SOP Framework", desc: "8 core SOPs with steps and owners", btnClass: "bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20", borderClass: "border-green-500/20" },
                    { key: "vendor_strategy", icon: "🤝", name: "Vendor Strategy", desc: "Key vendors, alternatives, negotiation tips", btnClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20", borderClass: "border-emerald-500/20" },
                    { key: "scale_plan", icon: "📈", name: "Scale Plan", desc: "Operations evolution from 0 to 1000 customers", btnClass: "bg-teal-500/10 border-teal-500/30 text-teal-400 hover:bg-teal-500/20", borderClass: "border-teal-500/20" },
                  ] as const).map((panel) => (
                    <div key={panel.key} className={`bg-[#12121a] rounded-xl border ${vpOpsResults[panel.key].output ? panel.borderClass : "border-[#1e1e2e]"} flex flex-col`}>
                      <div className="p-4 border-b border-[#1e1e2e]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{panel.icon}</span>
                          <h4 className="text-sm font-bold text-white">{panel.name}</h4>
                        </div>
                        <p className="text-xs text-[#64748b]">{panel.desc}</p>
                      </div>
                      <div className="flex-1 p-4 min-h-[80px] max-h-[400px] overflow-y-auto">
                        {vpOpsResults[panel.key].loading ? (
                          <div className="text-sm text-[#64748b] animate-pulse">Planning operations...</div>
                        ) : vpOpsResults[panel.key].output ? (
                          <div className="text-sm text-[#e2e8f0] whitespace-pre-wrap leading-relaxed">{vpOpsResults[panel.key].output}</div>
                        ) : (
                          <p className="text-sm text-[#64748b]">Click below to run analysis.</p>
                        )}
                      </div>
                      <div className="p-4 border-t border-[#1e1e2e]">
                        <button
                          onClick={() => runVpOps(panel.key)}
                          disabled={vpOpsResults[panel.key].loading}
                          className={`w-full px-4 py-2.5 border rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${panel.btnClass}`}
                        >
                          {vpOpsResults[panel.key].loading ? "Running..." : vpOpsResults[panel.key].output ? "Re-run" : "Run Analysis"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Research Agent ──────────────────────── */}
              <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🔍</span>
                  <h3 className="text-lg font-bold text-white">Research</h3>
                </div>
                <p className="text-sm text-[#64748b] mb-3">Get real-time web research powered by Perplexity. Results are saved to project notes.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={researchQuery}
                    onChange={(e) => setResearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !researchLoading && runResearch()}
                    placeholder="e.g. Utah real estate market trends 2026..."
                    className="flex-1 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-2.5 text-sm text-[#e2e8f0] placeholder-[#64748b] focus:outline-none focus:border-[#6366f1]"
                  />
                  <button
                    onClick={runResearch}
                    disabled={researchLoading || !researchQuery.trim()}
                    className="px-4 py-2.5 bg-[#6366f1] hover:bg-[#5558e6] text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {researchLoading ? "Researching..." : "Research"}
                  </button>
                </div>
                {researchResult && (
                  <div className="mt-4 p-4 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg max-h-[400px] overflow-y-auto">
                    <div className="text-sm text-[#e2e8f0] whitespace-pre-wrap leading-relaxed">{researchResult}</div>
                  </div>
                )}
              </div>
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
