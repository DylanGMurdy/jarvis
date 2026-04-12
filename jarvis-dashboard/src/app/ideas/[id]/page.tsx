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

  // Decisions state
  const [decisions, setDecisions] = useState<{ id: string; decision: string; created_at: string }[]>([]);
  const [newDecision, setNewDecision] = useState("");

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

  // Milestones state
  interface Milestone { id: string; project_id: string; title: string; target_date: string | null; completed: boolean; created_at: string }
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneDate, setNewMilestoneDate] = useState("");

  // Drive / Files state
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState<string | null>(null);
  const [driveFolderLink, setDriveFolderLink] = useState<string | null>(null);
  const [driveFiles, setDriveFiles] = useState<{ id: string; name: string; mimeType: string; webViewLink: string }[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  // ── War Room unified state ───────────────────────────────
  interface WarRoomAgent { key: string; name: string; role: string; tier: string; result: string }
  const [warRoomDeploying, setWarRoomDeploying] = useState(false);
  const [warRoomDeployError, setWarRoomDeployError] = useState<string | null>(null);
  const [warRoomSummary, setWarRoomSummary] = useState<string | null>(null);
  const [warRoomAgents, setWarRoomAgents] = useState<WarRoomAgent[]>([]);
  const [warRoomExpanded, setWarRoomExpanded] = useState<Set<string>>(new Set());
  const [warRoomRerunning, setWarRoomRerunning] = useState<Set<string>>(new Set());
  const [showBuildConfirm, setShowBuildConfirm] = useState(false);
  const [moveToBuildLoading, setMoveToBuildLoading] = useState(false);

  const AGENT_ROUTES: Record<string, string> = {
    cfo: "cfo", cto: "cto", clo: "clo", coo: "coo", cmo: "cmo", chro: "chro", cso: "cso",
    vp_product: "vp_product", vp_engineering: "vp_engineering", vp_finance: "vp_finance",
    vp_sales: "vp_sales", vp_marketing: "vp_marketing", vp_operations: "vp_operations",
    head_of_growth: "head_of_growth", head_of_content: "head_of_content",
    head_of_design: "head_of_design", data_analytics: "data_analytics",
    head_cx: "head_cx", head_of_pr: "head_of_pr", sdr: "sdr",
    partnerships: "partnerships", investor_relations: "investor_relations",
    head_of_recruiting: "head_of_recruiting", customer_success: "customer_success",
  };

  const AGENT_FIRST_ACTION: Record<string, string> = {
    cfo: "revenue_model", cto: "tech_stack", clo: "legal_risks", coo: "operations_plan",
    cmo: "market_analysis", chro: "org_structure", cso: "sales_strategy",
    vp_product: "product_vision", vp_engineering: "architecture_plan", vp_finance: "financial_model",
    vp_sales: "pipeline_structure", vp_marketing: "brand_strategy", vp_operations: "operations_stack",
    head_of_growth: "growth_loops", head_of_content: "content_calendar",
    head_of_design: "design_system", data_analytics: "metrics_framework",
    head_cx: "cx_strategy", head_of_pr: "pr_strategy", sdr: "cold_outreach",
    partnerships: "partnership_targets", investor_relations: "investor_update",
    head_of_recruiting: "job_descriptions", customer_success: "onboarding_flow",
  };

  const TIER_ICONS: Record<string, string> = {
    cfo: "💰", cto: "⚙️", clo: "⚖️", coo: "📋", cmo: "📣", chro: "👥", cso: "🎯",
    vp_product: "🧩", vp_engineering: "🔧", vp_finance: "💵", vp_sales: "🤝",
    vp_marketing: "📢", vp_operations: "🏭", head_of_growth: "🚀", head_of_content: "✍️",
    head_of_design: "🎨", data_analytics: "📉", head_cx: "💎", head_of_pr: "📰",
    sdr: "📞", partnerships: "🤝", investor_relations: "🏦", head_of_recruiting: "🎯",
    customer_success: "🌟",
  };

  async function deployWarRoom() {
    setWarRoomDeploying(true);
    setWarRoomDeployError(null);
    setWarRoomSummary(null);
    setWarRoomAgents([]);
    setWarRoomExpanded(new Set());
    try {
      const res = await fetch(`/api/projects/${id}/war-room/deploy`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setWarRoomSummary(data.summary);
        setWarRoomAgents(data.agents);
        loadData();
      } else {
        setWarRoomDeployError(data.error || "Deployment failed");
      }
    } catch {
      setWarRoomDeployError("Connection error");
    }
    setWarRoomDeploying(false);
  }

  async function rerunAgent(agentKey: string) {
    const route = AGENT_ROUTES[agentKey];
    const action = AGENT_FIRST_ACTION[agentKey];
    if (!route || !action) return;
    setWarRoomRerunning((prev) => new Set(prev).add(agentKey));
    try {
      const res = await fetch(`/api/agents/${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, projectId: id, projectTitle: project?.title, projectDescription: project?.description }),
      });
      const data = await res.json();
      if (data.ok) {
        setWarRoomAgents((prev) => prev.map((a) => a.key === agentKey ? { ...a, result: data.result } : a));
        loadData();
      }
    } catch { /* silent */ }
    setWarRoomRerunning((prev) => { const next = new Set(prev); next.delete(agentKey); return next; });
  }

  async function moveToBuild() {
    if (!project) return;
    setMoveToBuildLoading(true);
    try {
      await api.projects.update(id, { status: "Building" as const });
      await api.projectNotes.create(id, `[War Room Completed — ${new Date().toLocaleDateString()}]\n\nWar Room analysis complete. Project moved to Build stage.`);
      await loadData();
      setShowBuildConfirm(false);
      setActiveTab("Overview");
    } catch { /* silent */ }
    setMoveToBuildLoading(false);
  }

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

  // War Room Refresh state
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [refreshContext, setRefreshContext] = useState("");
  const [refreshResults, setRefreshResults] = useState<{ results: Record<string, { agent: string; output: string }>; jarvisSummary: string } | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfReports, setPdfReports] = useState<{ agentName: string; fileName: string; url: string }[] | null>(null);

  async function runWarRoomRefresh() {
    setRefreshLoading(true);
    setRefreshResults(null);
    setPdfReports(null);
    try {
      const res = await fetch(`/api/projects/${id}/warroom/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updatedContext: refreshContext }),
      });
      const data = await res.json();
      if (data.ok) {
        setRefreshResults({ results: data.results, jarvisSummary: data.jarvisSummary });
        setRefreshContext("");
        loadData();
      }
    } catch { /* silent */ }
    setRefreshLoading(false);
  }

  async function generatePdfReports() {
    if (!refreshResults) return;
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/warroom/generate-pdfs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: refreshResults.results, jarvisSummary: refreshResults.jarvisSummary, projectName: project?.title }),
      });
      const data = await res.json();
      if (data.ok) {
        setPdfReports(data.reports);
      }
    } catch { /* silent */ }
    setPdfLoading(false);
  }

  // War Room helper computations for Notes tab
  const warRoomNotes = notes.filter((n) => /^\[(War Room|CFO |CMO |CTO |COO |CLO |CHRO |CSO |VP |Head of|Customer Success|SDR |Data Analytics|Partnerships|Investor Relations|Recruiting)/.test(n.content));
  const AGENT_ICONS: Record<string, string> = {
    "War Room": "🏛️", "CFO": "💰", "CMO": "📣", "CTO": "🛠️", "COO": "⚙️",
    "CLO": "⚖️", "CHRO": "👥", "CSO": "💼", "VP Marketing": "📢", "VP Sales": "🤝",
    "VP Product": "🎯", "VP Engineering": "🔧", "VP Finance": "💵", "VP Operations": "🏭",
    "Head of Growth": "📈", "Head of Content": "📝", "Head of Design": "🎨", "Head of CX": "💬",
    "Head of PR": "📰", "Customer Success": "🌟", "SDR": "📞", "Data Analytics": "📉",
    "Partnerships": "🤝", "Investor Relations": "💎", "Recruiting": "🔍",
  };
  function getAgentNameFromNote(content: string): string {
    const match = content.match(/^\[(.+?)(?:\s*—|\])/);
    return match ? match[1] : "Agent";
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

  // Investor Relations Agent state
  const [irResults, setIrResults] = useState<Record<string, { loading: boolean; output: string | null }>>({
    investor_update: { loading: false, output: null },
    pitch_deck_outline: { loading: false, output: null },
    cap_table_strategy: { loading: false, output: null },
    fundraising_timeline: { loading: false, output: null },
  });

  async function runIr(action: string) {
    setIrResults((prev) => ({ ...prev, [action]: { loading: true, output: null } }));
    try {
      const res = await fetch("/api/agents/investor_relations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, projectId: id, projectTitle: project?.title, projectDescription: project?.description }),
      });
      const data = await res.json();
      setIrResults((prev) => ({ ...prev, [action]: { loading: false, output: data.ok ? data.result : data.error || "Failed" } }));
      if (data.ok) loadData();
    } catch {
      setIrResults((prev) => ({ ...prev, [action]: { loading: false, output: "Connection error" } }));
    }
  }

  // Head of Recruiting Agent state
  const [recruitingResults, setRecruitingResults] = useState<Record<string, { loading: boolean; output: string | null }>>({
    job_descriptions: { loading: false, output: null },
    hiring_process: { loading: false, output: null },
    culture_fit_questions: { loading: false, output: null },
    employer_brand: { loading: false, output: null },
  });

  async function runRecruiting(action: string) {
    setRecruitingResults((prev) => ({ ...prev, [action]: { loading: true, output: null } }));
    try {
      const res = await fetch("/api/agents/head_of_recruiting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, projectId: id, projectTitle: project?.title, projectDescription: project?.description }),
      });
      const data = await res.json();
      setRecruitingResults((prev) => ({ ...prev, [action]: { loading: false, output: data.ok ? data.result : data.error || "Failed" } }));
      if (data.ok) loadData();
    } catch {
      setRecruitingResults((prev) => ({ ...prev, [action]: { loading: false, output: "Connection error" } }));
    }
  }

  // Master Orchestrator Agent state
  const [orchestratorResults, setOrchestratorResults] = useState<Record<string, { loading: boolean; output: string | null }>>({
    daily_briefing: { loading: false, output: null },
    assign_tasks: { loading: false, output: null },
    weekly_review: { loading: false, output: null },
    escalate: { loading: false, output: null },
  });

  async function runOrchestrator(action: string) {
    setOrchestratorResults((prev) => ({ ...prev, [action]: { loading: true, output: null } }));
    try {
      const res = await fetch("/api/agents/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, projectId: id, projectTitle: project?.title, projectDescription: project?.description }),
      });
      const data = await res.json();
      setOrchestratorResults((prev) => ({ ...prev, [action]: { loading: false, output: data.ok ? data.result : data.error || "Failed" } }));
      if (data.ok) loadData();
    } catch {
      setOrchestratorResults((prev) => ({ ...prev, [action]: { loading: false, output: "Connection error" } }));
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
    // Load milestones
    try {
      const mRes = await fetch(`/api/projects/${id}/milestones`);
      const mData = await mRes.json();
      setMilestones(mData.data || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [id]);

  async function addMilestone() {
    if (!newMilestoneTitle.trim()) return;
    try {
      const res = await fetch(`/api/projects/${id}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newMilestoneTitle, target_date: newMilestoneDate || null }),
      });
      const data = await res.json();
      if (data.data) setMilestones((prev) => [...prev, data.data]);
      setNewMilestoneTitle("");
      setNewMilestoneDate("");
    } catch { /* silent */ }
  }

  async function toggleMilestone(ms: Milestone) {
    try {
      await fetch(`/api/projects/${id}/milestones`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneId: ms.id, completed: !ms.completed }),
      });
      setMilestones((prev) => prev.map((m) => m.id === ms.id ? { ...m, completed: !m.completed } : m));
    } catch { /* silent */ }
  }

  async function deleteMilestone(msId: string) {
    try {
      await fetch(`/api/projects/${id}/milestones`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneId: msId }),
      });
      setMilestones((prev) => prev.filter((m) => m.id !== msId));
    } catch { /* silent */ }
  }

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
    loadDecisions();
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

  async function handleDeleteNote(noteId: string) {
    try {
      await fetch(`/api/projects/${id}/notes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId }),
      });
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch { /* silent */ }
  }

  async function loadDecisions() {
    try {
      const res = await fetch(`/api/projects/${id}/decisions`);
      const data = await res.json();
      setDecisions(data.data || []);
    } catch { /* silent */ }
  }

  async function handleAddDecision() {
    const text = newDecision.trim();
    if (!text) return;
    try {
      const res = await fetch(`/api/projects/${id}/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: text }),
      });
      const data = await res.json();
      if (data.data) setDecisions((prev) => [data.data, ...prev]);
      setNewDecision("");
    } catch { /* silent */ }
  }

  async function handleDeleteDecision(decisionId: string) {
    try {
      await fetch(`/api/projects/${id}/decisions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId }),
      });
      setDecisions((prev) => prev.filter((d) => d.id !== decisionId));
    } catch { /* silent */ }
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
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-8">
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

        {/* ── Pipeline Progress Bar ────────────────────── */}
        {(() => {
          const PIPELINE: { label: string; icon: string; tab: Tab | null; status: Project["status"] | null }[] = [
            { label: "Idea", icon: "💡", tab: "Overview", status: "Idea" },
            { label: "Planning", icon: "📋", tab: "Tasks", status: "Planning" },
            { label: "War Room", icon: "🏛️", tab: "War Room", status: null },
            { label: "Building", icon: "🔨", tab: "Tasks", status: "Building" },
            { label: "Revenue", icon: "💰", tab: "Overview", status: "Revenue" },
          ];
          const statusToStage: Record<string, number> = { Idea: 0, Planning: 1, Building: 3, Launched: 3, Revenue: 4 };
          const currentStage = statusToStage[project.status] ?? 0;
          const warRoomDone = !!warRoomSummary || notes.some((n) => n.content.includes("[Jarvis War Room Summary]") || n.content.includes("[War Room —"));
          const effectiveStage = warRoomDone && currentStage < 3 ? 2 : currentStage;

          function handleStageClick(stage: typeof PIPELINE[number], idx: number) {
            if (stage.tab) setActiveTab(stage.tab);
            if (stage.status && project && stage.status !== project.status && idx <= effectiveStage + 1) {
              handleStatusChange(stage.status);
            }
          }

          return (
            <div className="mb-8 hidden sm:block">
              <div className="flex items-center justify-between relative px-6">
                <div className="absolute top-5 left-6 right-6 h-0.5 bg-[#1e1e2e]" />
                <div className="absolute top-5 left-6 h-0.5 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] transition-all duration-700" style={{ width: `${(effectiveStage / (PIPELINE.length - 1)) * 100}%` }} />
                {PIPELINE.map((stage, i) => {
                  const isCompleted = i < effectiveStage;
                  const isCurrent = i === effectiveStage;
                  const isFuture = i > effectiveStage;
                  return (
                    <button
                      key={stage.label}
                      onClick={() => handleStageClick(stage, i)}
                      className="flex flex-col items-center relative z-10 group cursor-pointer"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm transition-all duration-300 ${
                        isCurrent
                          ? "bg-[#6366f1] text-white ring-2 ring-[#6366f1]/50 ring-offset-2 ring-offset-[#0a0a0f] scale-110"
                          : isCompleted
                            ? "bg-[#6366f1]/80 text-white"
                            : "bg-[#1e1e2e] text-[#64748b] group-hover:bg-[#1e1e2e]/80"
                      }`}>
                        {isCompleted ? (
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        ) : (
                          stage.icon
                        )}
                      </div>
                      <span className={`mt-2 text-xs font-medium transition-colors duration-300 ${
                        isCurrent ? "text-[#6366f1]" : isCompleted ? "text-[#e2e8f0]" : "text-[#64748b]"
                      }`}>
                        {stage.label}
                      </span>
                      {isFuture && (
                        <span className="absolute -bottom-4 text-[10px] text-[#64748b] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Click to advance</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── Tabs ───────────────────────────────────────── */}
        <div className="flex gap-1 mb-6 border-b border-[#1e1e2e] overflow-x-auto no-scrollbar">
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 sm:px-4 py-3 text-sm font-medium transition-colors rounded-t-lg whitespace-nowrap ${activeTab === tab ? "text-[#6366f1] border-b-2 border-[#6366f1] bg-[#6366f1]/5" : "text-[#64748b] hover:text-[#e2e8f0]"}`}>
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

                {/* ── Milestones ────────────────────────── */}
                <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-6">
                  <h3 className="text-sm font-medium text-[#64748b] mb-3">Milestones</h3>
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      value={newMilestoneTitle}
                      onChange={(e) => setNewMilestoneTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addMilestone()}
                      placeholder="Add a milestone..."
                      className="flex-1 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] placeholder-[#64748b] focus:outline-none focus:border-[#6366f1]"
                    />
                    <input
                      type="date"
                      value={newMilestoneDate}
                      onChange={(e) => setNewMilestoneDate(e.target.value)}
                      className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] w-36"
                    />
                    <button onClick={addMilestone} className="px-3 py-2 bg-[#6366f1] hover:bg-[#5558e6] text-white text-xs font-medium rounded-lg">Add</button>
                  </div>
                  {milestones.length === 0 ? (
                    <p className="text-[#64748b] text-sm text-center py-4">No milestones yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {milestones.map((ms) => {
                        const isOverdue = ms.target_date && !ms.completed && new Date(ms.target_date) < new Date();
                        return (
                          <div key={ms.id} className="flex items-center gap-3 group">
                            <button onClick={() => toggleMilestone(ms)} className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${ms.completed ? "bg-[#22c55e] border-[#22c55e]" : "border-[#64748b] hover:border-[#6366f1]"}`}>
                              {ms.completed && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                            </button>
                            <div className="flex-1 min-w-0">
                              <span className={`text-sm ${ms.completed ? "line-through text-[#64748b]" : "text-[#e2e8f0]"}`}>{ms.title}</span>
                              {ms.target_date && (
                                <span className={`ml-2 text-[10px] ${isOverdue ? "text-red-400" : ms.completed ? "text-[#64748b]" : "text-[#6366f1]"}`}>
                                  {isOverdue ? "Overdue: " : ""}{new Date(ms.target_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                              )}
                            </div>
                            <button onClick={() => deleteMilestone(ms.id)} className="text-[#64748b] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {milestones.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#1e1e2e]">
                      <div className="flex items-center justify-between text-xs text-[#64748b]">
                        <span>{milestones.filter((m) => m.completed).length} / {milestones.length} complete</span>
                        <div className="w-24 h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden">
                          <div className="h-full bg-[#22c55e] rounded-full transition-all" style={{ width: `${(milestones.filter((m) => m.completed).length / milestones.length) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Timeline ──────────────────────────── */}
                <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-6">
                  <h3 className="text-sm font-medium text-[#64748b] mb-4">Project Timeline</h3>
                  <div className="relative">
                    <div className="absolute left-[9px] top-2 bottom-2 w-px bg-[#1e1e2e]" />
                    <div className="space-y-4">
                      {(() => {
                        const events: { date: string; icon: string; label: string }[] = [];
                        if (project.created_at) {
                          events.push({ date: project.created_at, icon: "🚀", label: "Project created" });
                        }
                        const agentNotes = new Map<string, { date: string; count: number }>();
                        for (const n of notes) {
                          const match = n.content.match(/^\[(.+?)(?:\s*—|\])/);
                          const key = match ? match[1] : "Note";
                          const existing = agentNotes.get(key);
                          if (!existing || new Date(n.created_at) > new Date(existing.date)) {
                            agentNotes.set(key, { date: n.created_at, count: (existing?.count || 0) + 1 });
                          }
                        }
                        for (const [agent, info] of agentNotes) {
                          if (agent.includes("War Room")) {
                            events.push({ date: info.date, icon: "🏛️", label: `War Room: ${agent}` });
                          } else if (agent === "Note") {
                            events.push({ date: info.date, icon: "📝", label: `${info.count} note${info.count > 1 ? "s" : ""} added` });
                          } else {
                            events.push({ date: info.date, icon: "🤖", label: `${agent} analyzed (${info.count}x)` });
                          }
                        }
                        for (const ms of milestones.filter((m) => m.completed)) {
                          events.push({ date: ms.created_at, icon: "✅", label: `Milestone: ${ms.title}` });
                        }
                        if (project.war_room_completed_at) {
                          events.push({ date: project.war_room_completed_at, icon: "🏗️", label: "Moved to Build stage" });
                        }
                        events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        if (events.length === 0) return <p className="text-[#64748b] text-sm text-center py-4 ml-6">No activity yet.</p>;
                        return events.slice(0, 15).map((ev, i) => (
                          <div key={i} className="flex items-start gap-3 relative">
                            <div className="w-5 h-5 rounded-full bg-[#0a0a0f] border-2 border-[#1e1e2e] flex items-center justify-center text-[10px] z-10 flex-shrink-0">{ev.icon}</div>
                            <div className="flex-1 min-w-0 -mt-0.5">
                              <p className="text-sm text-[#e2e8f0] leading-tight">{ev.label}</p>
                              <p className="text-[10px] text-[#64748b] mt-0.5">
                                {new Date(ev.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} at {new Date(ev.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>

                {/* ── Deploy War Room CTA ───────────────── */}
                {(project.status === "Idea" || project.status === "Planning") && (
                  <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 rounded-xl border border-purple-500/30 p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">🏛️</span>
                      <div>
                        <h3 className="text-sm font-bold text-white">Ready for War Room?</h3>
                        <p className="text-xs text-purple-300">Deploy 21 AI agents to analyze every angle of this project</p>
                      </div>
                    </div>
                    <p className="text-sm text-[#94a3b8] mb-4">Your full C-suite, VPs, and specialists will review financials, tech, legal, operations, marketing, sales, and more — all grounded in your project data.</p>
                    <button
                      onClick={() => { setActiveTab("War Room"); setTimeout(() => deployWarRoom(), 300); }}
                      className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                      Deploy War Room
                    </button>
                  </div>
                )}
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
                {/* Move to War Room CTA */}
                <button
                  onClick={() => setActiveTab("War Room")}
                  className="w-full bg-gradient-to-r from-[#6366f1]/10 to-[#8b5cf6]/10 border border-[#6366f1]/30 rounded-xl p-4 text-left hover:border-[#6366f1]/60 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#6366f1]/20 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">🏛️</div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Enter the War Room</h3>
                      <p className="text-xs text-[#64748b]">Deploy 21 AI agents to analyze this idea</p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="ml-auto text-[#6366f1]"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                </button>
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
          {activeTab === "Notes" && (() => {
            const SOURCE_BADGES: Record<string, { label: string; color: string }> = {
              manual: { label: "Manual", color: "bg-[#64748b]/20 text-[#94a3b8]" },
              chat: { label: "Chat", color: "bg-blue-500/20 text-blue-400" },
              daily_agent: { label: "Daily Agent", color: "bg-green-500/20 text-green-400" },
              war_room_summary: { label: "War Room", color: "bg-purple-500/20 text-purple-400" },
              cfo_agent: { label: "CFO", color: "bg-emerald-500/20 text-emerald-400" },
              cto_agent: { label: "CTO", color: "bg-cyan-500/20 text-cyan-400" },
              cmo_agent: { label: "CMO", color: "bg-pink-500/20 text-pink-400" },
              coo_agent: { label: "COO", color: "bg-sky-500/20 text-sky-400" },
              clo_agent: { label: "CLO", color: "bg-amber-500/20 text-amber-400" },
              chro_agent: { label: "CHRO", color: "bg-rose-500/20 text-rose-400" },
              cso_agent: { label: "CSO", color: "bg-violet-500/20 text-violet-400" },
            };
            function getBadge(source?: string) {
              if (!source) return SOURCE_BADGES.manual;
              if (source.startsWith("war_room_")) return { label: source.replace("war_room_", "").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()), color: "bg-purple-500/20 text-purple-400" };
              return SOURCE_BADGES[source] || { label: source.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()), color: "bg-[#6366f1]/20 text-[#818cf8]" };
            }
            return (
            <div className="space-y-6">
              {/* Add Note */}
              <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-4">
                <textarea value={newNoteContent} onChange={(e) => setNewNoteContent(e.target.value)} placeholder="Write a note..." rows={3} className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg p-3 text-sm text-[#e2e8f0] placeholder-[#64748b] resize-none focus:outline-none focus:border-[#6366f1] mb-3" />
                <button onClick={handleSaveNote} disabled={!newNoteContent.trim()} className="px-4 py-2 bg-[#6366f1] hover:bg-[#5558e6] text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors">Save Note</button>
              </div>

              {/* Notes List */}
              <div>
                <h3 className="text-sm font-semibold text-[#e2e8f0] mb-3">Notes ({sortedNotes.length})</h3>
                {sortedNotes.length === 0 ? (
                  <p className="text-[#64748b] text-sm text-center py-8">No notes yet.</p>
                ) : (
                  <div className="space-y-3">
                    {sortedNotes.map((note) => {
                      const badge = getBadge(note.source);
                      return (
                        <div key={note.id} className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-4 group">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
                              <span className="text-[10px] text-[#64748b]">{new Date(note.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                            </div>
                            <button onClick={() => { if (confirm("Delete this note?")) handleDeleteNote(note.id); }} className="text-[#64748b]/0 group-hover:text-[#64748b] hover:!text-red-400 transition-all p-1" title="Delete note">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                            </button>
                          </div>
                          <p className="text-sm text-[#e2e8f0] whitespace-pre-wrap leading-relaxed">{note.content}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Key Decisions */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-yellow-500/30 to-transparent" />
                  <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Key Decisions</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-yellow-500/30 to-transparent" />
                </div>
                <div className="bg-[#12121a] rounded-xl border border-yellow-500/20 p-4 mb-3">
                  <div className="flex gap-2">
                    <input type="text" value={newDecision} onChange={(e) => setNewDecision(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddDecision()} placeholder="Record a key decision..." className="flex-1 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] placeholder-[#64748b] focus:outline-none focus:border-yellow-500/50" />
                    <button onClick={handleAddDecision} disabled={!newDecision.trim()} className="px-4 py-2 bg-yellow-600/20 border border-yellow-500/30 text-yellow-400 text-sm font-medium rounded-lg hover:bg-yellow-600/30 disabled:opacity-50 transition-colors">Add</button>
                  </div>
                </div>
                {decisions.length === 0 ? (
                  <p className="text-[#64748b] text-sm text-center py-4">No decisions recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {decisions.map((d) => (
                      <div key={d.id} className="flex items-start gap-3 bg-[#12121a] rounded-lg border border-[#1e1e2e] px-4 py-3 group">
                        <span className="text-yellow-400 mt-0.5 text-sm">&#9889;</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#e2e8f0]">{d.decision}</p>
                          <p className="text-[10px] text-[#64748b] mt-1">{new Date(d.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                        </div>
                        <button onClick={() => { if (confirm("Delete this decision?")) handleDeleteDecision(d.id); }} className="text-[#64748b]/0 group-hover:text-[#64748b] hover:!text-red-400 transition-all p-1 flex-shrink-0" title="Delete">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            );
          })()}

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
              {/* War Room Reports Section */}
              {warRoomNotes.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">🏛️</span>
                    <h3 className="text-sm font-bold text-white">War Room Reports</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30">{warRoomNotes.length} reports</span>
                  </div>
                  <div className="space-y-2">
                    {warRoomNotes
                      .sort((a, b) => {
                        const aIsSum = a.content.includes("[War Room Completed");
                        const bIsSum = b.content.includes("[War Room Completed");
                        if (aIsSum && !bIsSum) return -1;
                        if (!aIsSum && bIsSum) return 1;
                        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                      })
                      .map((note) => {
                        const agentName = getAgentNameFromNote(note.content);
                        const icon = Object.entries(AGENT_ICONS).find(([key]) => agentName.includes(key))?.[1] || "📄";
                        const isSum = note.content.includes("[War Room Completed");
                        const date = new Date(note.created_at);
                        const size = `${(note.content.length / 1024).toFixed(1)} KB`;
                        return (
                          <div key={note.id} className={`flex items-center gap-3 bg-[#12121a] border rounded-lg px-4 py-3 ${isSum ? "border-[#6366f1]/40 bg-[#6366f1]/5" : "border-[#1e1e2e]"}`}>
                            <div className="w-8 h-8 rounded bg-[#1e1e2e] flex items-center justify-center text-sm">{icon}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-[#e2e8f0] truncate font-medium">{agentName}</p>
                                {isSum && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#6366f1]/20 text-[#6366f1]">Summary</span>}
                              </div>
                              <p className="text-xs text-[#64748b]">{size} &middot; {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                            </div>
                            <button
                              onClick={() => { const blob = new Blob([note.content], { type: "text/plain" }); window.open(URL.createObjectURL(blob), "_blank"); }}
                              className="px-3 py-1.5 text-xs font-medium text-[#6366f1] bg-[#6366f1]/10 border border-[#6366f1]/30 rounded-lg hover:bg-[#6366f1]/20 transition-colors"
                            >
                              View
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Google Drive Files */}
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
              {/* ── Deploy Button ───────────────────── */}
              <div className="bg-gradient-to-r from-purple-500/10 via-violet-500/10 to-indigo-500/10 rounded-xl border border-purple-500/30 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">War Room</h3>
                    <p className="text-sm text-[#94a3b8]">Deploy 21 AI agents in two waves. Wave 1 (CFO, CTO, CLO, COO) builds the foundation. Wave 2 uses that briefing as context.</p>
                  </div>
                  <button
                    onClick={deployWarRoom}
                    disabled={warRoomDeploying}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 whitespace-nowrap ml-4"
                  >
                    {warRoomDeploying ? "Deploying..." : warRoomAgents.length > 0 ? "Re-deploy War Room" : "Deploy Full War Room"}
                  </button>
                </div>
                {warRoomDeploying && (
                  <div className="mt-4 flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-purple-300">Running 21 agents in 2 waves... estimated ~2 minutes</span>
                  </div>
                )}
                {warRoomDeployError && (
                  <div className="mt-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">{warRoomDeployError}</div>
                )}
              </div>

              {/* ── JARVIS Summary ──────────────────── */}
              {warRoomSummary && (
                <div className="bg-gradient-to-br from-purple-900/40 to-indigo-900/40 rounded-xl border border-purple-500/30 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">J</div>
                    <div>
                      <h3 className="text-lg font-bold text-white">JARVIS Summary</h3>
                      <p className="text-xs text-purple-300">Synthesized from all 21 agent analyses</p>
                    </div>
                  </div>
                  <div className="text-sm text-[#e2e8f0] whitespace-pre-wrap leading-relaxed">{warRoomSummary}</div>
                </div>
              )}

              {/* ── Org Chart Layout ────────────────── */}
              {warRoomAgents.length > 0 && (
                <>
                  {/* C-Suite Row */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-px flex-1 bg-gradient-to-r from-yellow-500/30 to-transparent" />
                      <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">C-Suite</span>
                      <div className="h-px flex-1 bg-gradient-to-l from-yellow-500/30 to-transparent" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {warRoomAgents.filter((a) => a.tier === "c-suite").map((agent) => {
                        const isExpanded = warRoomExpanded.has(agent.key);
                        const isRerunning = warRoomRerunning.has(agent.key);
                        const preview = agent.result.split(/[.!?]\s/).slice(0, 2).join(". ") + ".";
                        return (
                          <div key={agent.key} className="bg-[#12121a] rounded-xl border border-yellow-500/20 flex flex-col">
                            <button
                              onClick={() => setWarRoomExpanded((prev) => { const next = new Set(prev); next.has(agent.key) ? next.delete(agent.key) : next.add(agent.key); return next; })}
                              className="p-4 text-left w-full"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">{TIER_ICONS[agent.key] || "🏢"}</span>
                                <h4 className="text-sm font-bold text-white">{agent.name}</h4>
                                <span className="ml-auto text-[10px] text-yellow-500">{isExpanded ? "▲" : "▼"}</span>
                              </div>
                              <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-2">{agent.role}</p>
                              {!isExpanded && <p className="text-xs text-[#94a3b8] line-clamp-2">{preview}</p>}
                            </button>
                            {isExpanded && (
                              <div className="px-4 pb-4">
                                <div className="text-sm text-[#e2e8f0] whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto border-t border-[#1e1e2e] pt-3">{agent.result}</div>
                                <button
                                  onClick={() => rerunAgent(agent.key)}
                                  disabled={isRerunning}
                                  className="mt-3 w-full px-3 py-1.5 text-xs border border-yellow-500/30 text-yellow-400 rounded-lg hover:bg-yellow-500/10 disabled:opacity-50 transition-colors"
                                >
                                  {isRerunning ? "Re-running..." : "Re-run"}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* VP Layer Row */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-px flex-1 bg-gradient-to-r from-blue-500/30 to-transparent" />
                      <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">VP Layer</span>
                      <div className="h-px flex-1 bg-gradient-to-l from-blue-500/30 to-transparent" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {warRoomAgents.filter((a) => a.tier === "vp").map((agent) => {
                        const isExpanded = warRoomExpanded.has(agent.key);
                        const isRerunning = warRoomRerunning.has(agent.key);
                        const preview = agent.result.split(/[.!?]\s/).slice(0, 2).join(". ") + ".";
                        return (
                          <div key={agent.key} className="bg-[#12121a] rounded-xl border border-blue-500/20 flex flex-col">
                            <button
                              onClick={() => setWarRoomExpanded((prev) => { const next = new Set(prev); next.has(agent.key) ? next.delete(agent.key) : next.add(agent.key); return next; })}
                              className="p-4 text-left w-full"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">{TIER_ICONS[agent.key] || "🏢"}</span>
                                <h4 className="text-sm font-bold text-white">{agent.name}</h4>
                                <span className="ml-auto text-[10px] text-blue-500">{isExpanded ? "▲" : "▼"}</span>
                              </div>
                              <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-2">{agent.role}</p>
                              {!isExpanded && <p className="text-xs text-[#94a3b8] line-clamp-2">{preview}</p>}
                            </button>
                            {isExpanded && (
                              <div className="px-4 pb-4">
                                <div className="text-sm text-[#e2e8f0] whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto border-t border-[#1e1e2e] pt-3">{agent.result}</div>
                                <button
                                  onClick={() => rerunAgent(agent.key)}
                                  disabled={isRerunning}
                                  className="mt-3 w-full px-3 py-1.5 text-xs border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-500/10 disabled:opacity-50 transition-colors"
                                >
                                  {isRerunning ? "Re-running..." : "Re-run"}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Specialists Row */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/30 to-transparent" />
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Specialists</span>
                      <div className="h-px flex-1 bg-gradient-to-l from-emerald-500/30 to-transparent" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {warRoomAgents.filter((a) => a.tier === "specialist").map((agent) => {
                        const isExpanded = warRoomExpanded.has(agent.key);
                        const isRerunning = warRoomRerunning.has(agent.key);
                        const preview = agent.result.split(/[.!?]\s/).slice(0, 2).join(". ") + ".";
                        return (
                          <div key={agent.key} className="bg-[#12121a] rounded-xl border border-emerald-500/20 flex flex-col">
                            <button
                              onClick={() => setWarRoomExpanded((prev) => { const next = new Set(prev); next.has(agent.key) ? next.delete(agent.key) : next.add(agent.key); return next; })}
                              className="p-4 text-left w-full"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">{TIER_ICONS[agent.key] || "🏢"}</span>
                                <h4 className="text-sm font-bold text-white">{agent.name}</h4>
                                <span className="ml-auto text-[10px] text-emerald-500">{isExpanded ? "▲" : "▼"}</span>
                              </div>
                              <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-2">{agent.role}</p>
                              {!isExpanded && <p className="text-xs text-[#94a3b8] line-clamp-2">{preview}</p>}
                            </button>
                            {isExpanded && (
                              <div className="px-4 pb-4">
                                <div className="text-sm text-[#e2e8f0] whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto border-t border-[#1e1e2e] pt-3">{agent.result}</div>
                                <button
                                  onClick={() => rerunAgent(agent.key)}
                                  disabled={isRerunning}
                                  className="mt-3 w-full px-3 py-1.5 text-xs border border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-500/10 disabled:opacity-50 transition-colors"
                                >
                                  {isRerunning ? "Re-running..." : "Re-run"}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* ── Empty state ─────────────────────── */}
              {!warRoomDeploying && warRoomAgents.length === 0 && !warRoomSummary && (
                <div className="text-center py-16">
                  <div className="text-4xl mb-4">🏛️</div>
                  <h3 className="text-lg font-bold text-white mb-2">War Room Ready</h3>
                  <p className="text-sm text-[#64748b] max-w-md mx-auto">Deploy the full War Room to get comprehensive analysis from 21 specialized AI agents. Wave 1 builds the financial, technical, legal, and operational foundation. Wave 2 uses that briefing to provide informed recommendations across every function.</p>
                </div>
              )}

              {/* ── Move to Build ───────────────────── */}
              {warRoomAgents.length > 0 && (
                <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-4">
                  {!showBuildConfirm ? (
                    <button onClick={() => setShowBuildConfirm(true)} className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors">
                      War Room Complete — Move to Build
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-white">Move this project to <span className="font-bold text-green-400">Build</span> status? This marks the War Room as complete.</p>
                      <div className="flex gap-3">
                        <button onClick={() => setShowBuildConfirm(false)} className="flex-1 px-4 py-2 border border-[#1e1e2e] text-[#94a3b8] rounded-lg hover:bg-[#1e1e2e] transition-colors">Cancel</button>
                        <button onClick={moveToBuild} disabled={moveToBuildLoading} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors">{moveToBuildLoading ? "Moving..." : "Confirm"}</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
