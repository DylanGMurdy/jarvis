"use client";

import { useState } from "react";
import type { Project } from "@/lib/types";

// ─── Agent definitions with API routes and actions ───────
type AgentAction = { key: string; label: string };

interface AgentDef {
  name: string;
  title: string;
  status: "active" | "building";
  route: string;
  actions: AgentAction[];
}

type ModalData = { title: string; body: string; actions?: { label: string; onClick: () => void }[] } | null;

// Master orchestrator
const JARVIS: AgentDef = {
  name: "JARVIS", title: "Master Orchestrator", status: "active", route: "/api/agents/run",
  actions: [{ key: "run", label: "Run Daily Agent" }],
};

// C-Suite row
const C_SUITE: AgentDef[] = [
  { name: "CMO", title: "Chief Marketing Officer", status: "active", route: "/api/agents/cmo",
    actions: [{ key: "market_analysis", label: "Market Analysis" }, { key: "content_strategy", label: "Content Strategy" }, { key: "growth_channels", label: "Growth Channels" }, { key: "brand_voice", label: "Brand Voice" }] },
  { name: "CFO", title: "Chief Financial Officer", status: "active", route: "/api/agents/cfo",
    actions: [{ key: "revenue_model", label: "Revenue Model" }, { key: "unit_economics", label: "Unit Economics" }, { key: "funding_needs", label: "Funding Needs" }, { key: "financial_risks", label: "Financial Risks" }] },
  { name: "CTO", title: "Chief Technology Officer", status: "active", route: "/api/agents/cto",
    actions: [{ key: "tech_stack", label: "Tech Stack" }, { key: "build_roadmap", label: "Build Roadmap" }, { key: "technical_risks", label: "Technical Risks" }, { key: "mvp_scope", label: "MVP Scope" }] },
  { name: "COO", title: "Chief Operating Officer", status: "active", route: "/api/agents/coo",
    actions: [{ key: "operations_plan", label: "Operations Plan" }, { key: "hiring_plan", label: "Hiring Plan" }, { key: "process_map", label: "Process Map" }, { key: "kpis", label: "KPIs" }] },
  { name: "CLO", title: "Chief Legal Officer", status: "active", route: "/api/agents/clo",
    actions: [{ key: "legal_risks", label: "Legal Risks" }, { key: "entity_structure", label: "Entity Structure" }, { key: "contracts_needed", label: "Contracts Needed" }, { key: "compliance_checklist", label: "Compliance Checklist" }] },
  { name: "CHRO", title: "Chief HR Officer", status: "active", route: "/api/agents/chro",
    actions: [{ key: "org_structure", label: "Org Structure" }, { key: "first_hires", label: "First 3 Hires" }, { key: "culture_values", label: "Culture & Values" }, { key: "compensation_model", label: "Compensation Model" }] },
];

// VP row
const VPS: AgentDef[] = [
  { name: "CSO", title: "Chief Sales Officer", status: "active", route: "/api/agents/cso",
    actions: [{ key: "sales_strategy", label: "Sales Strategy" }, { key: "prospect_list", label: "Prospect List" }, { key: "sales_script", label: "Sales Script" }, { key: "pricing_strategy", label: "Pricing Strategy" }] },
  { name: "VP Sales", title: "VP of Sales", status: "active", route: "/api/agents/vp_sales",
    actions: [{ key: "pipeline_structure", label: "Pipeline Structure" }, { key: "objection_handling", label: "Objection Handling" }, { key: "demo_script", label: "Demo Script" }, { key: "close_playbook", label: "Close Playbook" }] },
  { name: "VP Product", title: "VP of Product", status: "active", route: "/api/agents/vp_product",
    actions: [{ key: "product_vision", label: "Product Vision" }, { key: "feature_roadmap", label: "Feature Roadmap" }, { key: "user_personas", label: "User Personas" }, { key: "competitive_analysis", label: "Competitive Analysis" }] },
  { name: "VP Eng", title: "VP of Engineering", status: "active", route: "/api/agents/vp_engineering",
    actions: [{ key: "architecture_plan", label: "Architecture Plan" }, { key: "sprint_plan", label: "Sprint Plan" }, { key: "tech_debt_audit", label: "Tech Debt Audit" }, { key: "api_design", label: "API Design" }] },
  { name: "VP Marketing", title: "VP of Marketing", status: "active", route: "/api/agents/vp_marketing",
    actions: [{ key: "brand_strategy", label: "Brand Strategy" }, { key: "launch_plan", label: "90-Day Launch Plan" }, { key: "marketing_budget", label: "Marketing Budget" }, { key: "campaign_ideas", label: "Campaign Ideas" }] },
  { name: "VP Finance", title: "VP of Finance", status: "active", route: "/api/agents/vp_finance",
    actions: [{ key: "financial_model", label: "Financial Model" }, { key: "cash_flow", label: "Cash Flow" }, { key: "pricing_analysis", label: "Pricing Analysis" }, { key: "investor_metrics", label: "Investor Metrics" }] },
  { name: "VP Ops", title: "VP of Operations", status: "active", route: "/api/agents/vp_operations",
    actions: [{ key: "operations_stack", label: "Operations Stack" }, { key: "sop_framework", label: "SOP Framework" }, { key: "vendor_strategy", label: "Vendor Strategy" }, { key: "scale_plan", label: "Scale Plan" }] },
];

// Specialists row
const SPECIALISTS: AgentDef[] = [
  { name: "Head of Growth", title: "Head of Growth", status: "active", route: "/api/agents/head_of_growth",
    actions: [{ key: "growth_loops", label: "Growth Loops" }, { key: "acquisition_channels", label: "Acquisition Channels" }, { key: "retention_strategy", label: "Retention Strategy" }, { key: "growth_experiments", label: "Growth Experiments" }] },
  { name: "Head of Content", title: "Head of Content", status: "active", route: "/api/agents/head_of_content",
    actions: [{ key: "content_calendar", label: "Content Calendar" }, { key: "seo_strategy", label: "SEO Strategy" }, { key: "content_pillars", label: "Content Pillars" }, { key: "viral_hooks", label: "Viral Hooks" }] },
  { name: "Head of Design", title: "Head of Design", status: "active", route: "/api/agents/head_of_design",
    actions: [{ key: "design_system", label: "Design System" }, { key: "brand_assets", label: "Brand Assets" }, { key: "ux_principles", label: "UX Principles" }, { key: "landing_page_copy", label: "Landing Page Copy" }] },
  { name: "Head of CX", title: "Head of CX", status: "active", route: "/api/agents/head_cx",
    actions: [{ key: "cx_strategy", label: "CX Strategy" }, { key: "nps_program", label: "NPS Program" }, { key: "support_stack", label: "Support Stack" }, { key: "voice_of_customer", label: "Voice of Customer" }] },
  { name: "Data Analytics", title: "Data Analytics", status: "active", route: "/api/agents/data_analytics",
    actions: [{ key: "metrics_framework", label: "Metrics Framework" }, { key: "dashboard_design", label: "Dashboard Design" }, { key: "data_infrastructure", label: "Data Infrastructure" }, { key: "ab_testing_framework", label: "A/B Testing" }] },
  { name: "SDR", title: "Sales Dev Rep", status: "active", route: "/api/agents/sdr",
    actions: [{ key: "cold_outreach", label: "Cold Outreach" }, { key: "lead_qualification", label: "Lead Qualification" }, { key: "follow_up_sequences", label: "Follow-Up Sequences" }, { key: "outreach_personalization", label: "Personalization" }] },
  { name: "Partnerships", title: "Partnerships", status: "active", route: "/api/agents/partnerships",
    actions: [{ key: "partnership_targets", label: "Partnership Targets" }, { key: "partnership_pitch", label: "Partnership Pitch" }, { key: "affiliate_program", label: "Affiliate Program" }, { key: "integration_opportunities", label: "Integrations" }] },
  { name: "Head of PR", title: "Head of PR", status: "active", route: "/api/agents/head_of_pr",
    actions: [{ key: "pr_strategy", label: "PR Strategy" }, { key: "press_release", label: "Press Release" }, { key: "media_list", label: "Media List" }, { key: "thought_leadership", label: "Thought Leadership" }] },
  { name: "Customer Success", title: "Customer Success", status: "active", route: "/api/agents/customer_success",
    actions: [{ key: "onboarding_flow", label: "Onboarding Flow" }, { key: "support_playbook", label: "Support Playbook" }, { key: "churn_prevention", label: "Churn Prevention" }, { key: "upsell_strategy", label: "Upsell Strategy" }] },
];

const ALL_AGENTS = [JARVIS, ...C_SUITE, ...VPS, ...SPECIALISTS];

// ─── Components ──────────────────────────────────────────

function AgentCard({ agent, onClick }: { agent: AgentDef; onClick: () => void }) {
  const isJarvis = agent.name === "JARVIS";
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center text-center p-2 rounded-xl border transition-all hover:scale-105 cursor-pointer min-w-0 ${
        isJarvis
          ? "bg-jarvis-accent/20 border-jarvis-accent/50 hover:border-jarvis-accent shadow-lg shadow-jarvis-accent/10"
          : "bg-jarvis-card border-jarvis-border hover:border-jarvis-accent/50"
      }`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${
        isJarvis ? "bg-jarvis-accent text-black" : agent.status === "active" ? "bg-jarvis-green/20 text-jarvis-green" : "bg-jarvis-yellow/20 text-jarvis-yellow"
      }`}>
        {agent.name.slice(0, 2)}
      </div>
      <span className="text-[11px] font-semibold text-white leading-tight truncate w-full">{agent.name}</span>
      <span className="text-[9px] text-jarvis-muted leading-tight truncate w-full">{agent.title}</span>
      <span className={`text-[8px] mt-0.5 px-1.5 py-0.5 rounded-full ${
        agent.status === "active" ? "bg-jarvis-green/20 text-jarvis-green" : "bg-jarvis-yellow/20 text-jarvis-yellow"
      }`}>
        {agent.status === "active" ? "Active" : "Building"}
      </span>
    </button>
  );
}

function OrgRow({ label, agents, onAgentClick }: { label: string; agents: AgentDef[]; onAgentClick: (a: AgentDef) => void }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-jarvis-muted uppercase tracking-wider mb-2 text-center">{label}</div>
      <div className="flex flex-wrap justify-center gap-2">
        {agents.map((a) => (
          <div key={a.name} className="w-[calc(16.666%-8px)] min-w-[90px] max-w-[130px]">
            <AgentCard agent={a} onClick={() => onAgentClick(a)} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────

interface AgentsTabProps {
  openModal: (data: ModalData) => void;
  closeModal: () => void;
  projects: Project[];
}

export default function AgentsTab({ openModal, closeModal, projects }: AgentsTabProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ agent: string; action: string; result: string } | null>(null);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  async function runAgentAction(agent: AgentDef, actionKey: string) {
    if (!selectedProject) return;
    setRunningAction(`${agent.name}:${actionKey}`);
    closeModal();

    try {
      // Special case for the daily agent runner
      if (agent.route === "/api/agents/run") {
        const res = await fetch("/api/agents/run", { method: "POST" });
        const data = await res.json();
        setLastResult({
          agent: agent.name,
          action: "Daily Run",
          result: data.ok ? `Processed ${data.projectsProcessed} projects, generated ${data.tasksGenerated} tasks` : (data.error || "Failed"),
        });
        return;
      }

      const res = await fetch(agent.route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionKey,
          projectId: selectedProject.id,
          projectTitle: selectedProject.title,
          projectDescription: selectedProject.description,
        }),
      });
      const data = await res.json();
      setLastResult({
        agent: agent.name,
        action: data.action || actionKey,
        result: data.ok ? (data.result?.slice(0, 500) + (data.result?.length > 500 ? "..." : "")) : (data.error || "Failed"),
      });
    } catch {
      setLastResult({ agent: agent.name, action: actionKey, result: "Network error" });
    } finally {
      setRunningAction(null);
    }
  }

  function openAgentModal(agent: AgentDef) {
    if (!selectedProject) {
      openModal({
        title: agent.name,
        body: `${agent.title}\n\nSelect a project first to run ${agent.name} actions.`,
        actions: [{ label: "OK", onClick: closeModal }],
      });
      return;
    }

    openModal({
      title: `${agent.name} — ${agent.title}`,
      body: `Project: ${selectedProject.title}\n\nSelect an action to run:`,
      actions: agent.actions.map((a) => ({
        label: runningAction === `${agent.name}:${a.key}` ? "Running..." : a.label,
        onClick: () => runAgentAction(agent, a.key),
      })),
    });
  }

  const activeCount = ALL_AGENTS.filter((a) => a.status === "active").length;
  const buildingCount = ALL_AGENTS.filter((a) => a.status === "building").length;

  return (
    <div className="space-y-6 animate-[slideUp_0.3s_ease-out]">
      {/* Header with project selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold">PE Business Empire</h2>
          <p className="text-xs text-jarvis-muted">{ALL_AGENTS.length} Agents &middot; {activeCount} Active &middot; {buildingCount} Building</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="bg-jarvis-card border border-jarvis-border rounded-lg px-3 py-1.5 text-sm text-white focus:border-jarvis-accent outline-none min-w-[200px]"
          >
            <option value="">Select a project...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 text-xs text-jarvis-muted">
            <span className="w-2 h-2 rounded-full bg-jarvis-green" /> Active
            <span className="w-2 h-2 rounded-full bg-jarvis-yellow" /> Building
          </div>
        </div>
      </div>

      {/* Last result banner */}
      {runningAction && (
        <div className="p-3 rounded-lg bg-jarvis-accent/10 border border-jarvis-accent/30 text-sm text-jarvis-accent animate-pulse">
          Running {runningAction.replace(":", " — ")}...
        </div>
      )}
      {lastResult && !runningAction && (
        <div className="p-3 rounded-lg bg-jarvis-green/10 border border-jarvis-green/30 text-sm">
          <div className="font-semibold text-jarvis-green mb-1">{lastResult.agent} — {lastResult.action}</div>
          <div className="text-jarvis-muted text-xs whitespace-pre-wrap">{lastResult.result}</div>
        </div>
      )}

      {/* Org Chart Layout */}
      <div className="space-y-4">
        {/* JARVIS — Top */}
        <div className="flex justify-center">
          <div className="w-[140px]">
            <AgentCard agent={JARVIS} onClick={() => openAgentModal(JARVIS)} />
          </div>
        </div>

        {/* Connector line */}
        <div className="flex justify-center">
          <div className="w-px h-6 bg-jarvis-border" />
        </div>

        {/* C-Suite */}
        <OrgRow label="C-Suite" agents={C_SUITE} onAgentClick={openAgentModal} />

        {/* Connector */}
        <div className="flex justify-center">
          <div className="w-px h-6 bg-jarvis-border" />
        </div>

        {/* VPs */}
        <OrgRow label="Vice Presidents" agents={VPS} onAgentClick={openAgentModal} />

        {/* Connector */}
        <div className="flex justify-center">
          <div className="w-px h-6 bg-jarvis-border" />
        </div>

        {/* Specialists */}
        <OrgRow label="Specialists & Leads" agents={SPECIALISTS} onAgentClick={openAgentModal} />
      </div>
    </div>
  );
}
