"use client";

import { useCallback, useState } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// ─── Types ──────────────────────────────────────────────────
type AgentStatus = "active" | "indev" | "planned";
type Division = "founder" | "jarvis" | "csuite" | "revenue" | "opstech" | "finance" | "sub";

interface OrgNodeData {
  label: string;
  role: string;
  status: AgentStatus;
  division: Division;
  description: string;
  projects?: string[];
  capabilities?: string[];
  [key: string]: unknown;
}

// ─── Color scheme by division ───────────────────────────────
const DIV_COLORS: Record<Division, { bg: string; border: string; glow: string; text: string }> = {
  founder: { bg: "#1c1917", border: "#f59e0b", glow: "rgba(245,158,11,0.5)",  text: "#fcd34d" },
  jarvis:  { bg: "#1e1b4b", border: "#6366f1", glow: "rgba(99,102,241,0.4)",  text: "#a5b4fc" },
  csuite:  { bg: "#172554", border: "#3b82f6", glow: "rgba(59,130,246,0.3)",  text: "#93c5fd" },
  revenue: { bg: "#14532d", border: "#22c55e", glow: "rgba(34,197,94,0.3)",   text: "#86efac" },
  opstech: { bg: "#431407", border: "#f97316", glow: "rgba(249,115,22,0.3)",  text: "#fdba74" },
  finance: { bg: "#422006", border: "#eab308", glow: "rgba(234,179,8,0.3)",   text: "#fde047" },
  sub:     { bg: "#1e1e2e", border: "#475569", glow: "rgba(71,85,105,0.15)",  text: "#94a3b8" },
};

const STATUS_BADGES: Record<AgentStatus, { label: string; color: string; bg: string }> = {
  active:  { label: "Active",  color: "#22c55e", bg: "rgba(34,197,94,0.15)" },
  indev:   { label: "In Dev",  color: "#eab308", bg: "rgba(234,179,8,0.15)" },
  planned: { label: "Planned", color: "#64748b", bg: "rgba(100,116,139,0.15)" },
};

const DIV_LABELS: Record<string, { label: string; color: string }> = {
  csuite:  { label: "C-Suite Staff", color: "#3b82f6" },
  revenue: { label: "Revenue Growth", color: "#22c55e" },
  opstech: { label: "Ops & Tech", color: "#f97316" },
  finance: { label: "Finance & Legal", color: "#eab308" },
};

// ─── Custom Node ────────────────────────────────────────────
function OrgNode({ data, selected }: { data: OrgNodeData; selected?: boolean }) {
  const colors = DIV_COLORS[data.division];
  const status = STATUS_BADGES[data.status];
  const isJarvis = data.division === "jarvis" || data.division === "founder";

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-3 !h-3" />
      <div
        className="rounded-xl px-4 py-3 transition-all duration-200 cursor-pointer"
        style={{
          background: colors.bg,
          border: `1.5px solid ${selected ? "#fff" : colors.border}`,
          boxShadow: selected
            ? `0 0 24px ${colors.glow}, 0 0 48px ${colors.glow}`
            : isJarvis
              ? `0 0 20px ${colors.glow}, 0 0 40px ${colors.glow}`
              : `0 0 8px ${colors.glow}`,
          minWidth: isJarvis ? 200 : 160,
          maxWidth: isJarvis ? 220 : 190,
        }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ color: status.color, background: status.bg }}
          >
            {status.label}
          </span>
          {data.status === "active" && (
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: status.color }} />
          )}
        </div>
        <h3 className={`font-bold text-white leading-tight ${isJarvis ? "text-sm" : "text-xs"}`}>{data.label}</h3>
        <p className="text-[10px] mt-0.5" style={{ color: colors.text }}>{data.role}</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-3 !h-3" />
    </>
  );
}

const nodeTypes: NodeTypes = { orgNode: OrgNode };

// ─── Layout constants ───────────────────────────────────────
const COL = 200;  // horizontal spacing
const ROW = 120;  // vertical spacing

// ─── All nodes (Dylan + 21 agents) ──────────────────────────
const NODES: Node<OrgNodeData>[] = [
  // DYLAN - top
  { id: "dylan", type: "orgNode", position: { x: COL * 4.5, y: 0 }, data: {
    label: "Dylan Murdock", role: "Founder & Owner", status: "active", division: "founder",
    description: "Founder and visionary. Real estate agent at Narwhal Homes building an AI-powered PE-style business empire. All agents report through JARVIS to Dylan.",
    capabilities: ["Vision & Strategy", "Sales & Relationships", "Product Direction", "Final Decisions"],
    projects: ["All Businesses"],
  }},

  // JARVIS - reports to Dylan
  { id: "jarvis", type: "orgNode", position: { x: COL * 4.5, y: ROW * 1.2 }, data: {
    label: "JARVIS", role: "CEO / Chief of Staff", status: "active", division: "jarvis",
    description: "Orchestrates all sub-agents, makes strategic decisions, brings key items to Dylan. Reviews all agent outputs and assigns tasks.",
    capabilities: ["Agent Orchestration", "Strategic Decisions", "Memory & Context", "Daily Briefs", "Task Delegation"],
    projects: ["All Divisions"],
  }},

  // ── DIVISION HEADS (Row 1) ──
  // C-Suite Staff
  { id: "coo-cs", type: "orgNode", position: { x: COL * 0.5, y: ROW * 2.7 }, data: {
    label: "COO Agent", role: "Strategic Planning", status: "planned", division: "csuite",
    description: "Strategic planning and cross-division coordination. Ensures all divisions are aligned on Dylan's goals.",
    capabilities: ["Cross-Division Coord", "Strategic Planning", "OKR Tracking", "Resource Allocation"],
  }},
  { id: "chro", type: "orgNode", position: { x: COL * 1.5, y: ROW * 2.7 }, data: {
    label: "CHRO Agent", role: "HR & Talent", status: "planned", division: "csuite",
    description: "Talent strategy and team building as the AI workforce grows.",
    capabilities: ["Recruiting Strategy", "Team Building", "Performance Mgmt"],
  }},

  // Revenue Growth
  { id: "cmo", type: "orgNode", position: { x: COL * 3, y: ROW * 2.7 }, data: {
    label: "CMO Agent", role: "Marketing Growth", status: "planned", division: "revenue",
    description: "Marketing growth across all businesses. Content strategy, brand building, paid acquisition.",
    capabilities: ["Content Strategy", "Brand Building", "Paid Ads", "Social Media", "Analytics"],
  }},
  { id: "cso", type: "orgNode", position: { x: COL * 4.5, y: ROW * 2.7 }, data: {
    label: "CSO Agent", role: "Sales & Biz Dev", status: "indev", division: "revenue",
    description: "Sales and business development. Closes deals for Lindy agent clients. First active revenue agent.",
    capabilities: ["Deal Closing", "Proposal Writing", "Client Relations", "Revenue Forecasting"],
    projects: ["Lindy Agent Business"],
  }},

  // Operations & Tech
  { id: "cto", type: "orgNode", position: { x: COL * 6, y: ROW * 2.7 }, data: {
    label: "CTO Agent", role: "Product Dev & Tech", status: "planned", division: "opstech",
    description: "Technical architecture and build decisions across all AI products.",
    capabilities: ["Architecture", "Tech Stack", "Build Decisions", "Code Reviews", "AI Integration"],
  }},
  { id: "coo-ops", type: "orgNode", position: { x: COL * 7.5, y: ROW * 2.7 }, data: {
    label: "COO Agent", role: "Process Ops & Quality", status: "planned", division: "opstech",
    description: "Process operations and quality control across all businesses.",
    capabilities: ["Process Design", "Quality Control", "Workflow Automation", "Efficiency"],
  }},

  // Finance & Legal
  { id: "cfo", type: "orgNode", position: { x: COL * 9, y: ROW * 2.7 }, data: {
    label: "CFO Agent", role: "Financial Planning", status: "planned", division: "finance",
    description: "Financial planning, budgeting, cash flow management across all businesses.",
    capabilities: ["Budgeting", "Cash Flow", "Fundraising", "Financial Reports"],
  }},
  { id: "clo", type: "orgNode", position: { x: COL * 10, y: ROW * 2.7 }, data: {
    label: "CLO Agent", role: "Legal & Compliance", status: "planned", division: "finance",
    description: "Legal and compliance for all AI businesses. Contracts, IP protection.",
    capabilities: ["Contract Review", "IP Protection", "Compliance", "Risk Assessment"],
  }},

  // ── SUB-AGENTS (Row 2) ──
  // Under CMO
  { id: "content-creator", type: "orgNode", position: { x: COL * 2.5, y: ROW * 4.2 }, data: {
    label: "Content Creator", role: "Content Production", status: "planned", division: "sub",
    description: "Generates blog posts, social content, video scripts for all Dylan's businesses.",
    capabilities: ["Blog Posts", "Social Content", "Video Scripts", "Copy"],
  }},
  { id: "lead-gen", type: "orgNode", position: { x: COL * 3.5, y: ROW * 4.2 }, data: {
    label: "Lead Generation", role: "Acquisition", status: "planned", division: "sub",
    description: "Runs paid ads, SEO, and outbound campaigns to generate leads for all businesses.",
    capabilities: ["Paid Ads", "SEO", "Outbound", "Landing Pages"],
  }},

  // Under CSO
  { id: "pipeline-mgmt", type: "orgNode", position: { x: COL * 4.5, y: ROW * 4.2 }, data: {
    label: "Pipeline Mgmt", role: "CRM & Follow-ups", status: "indev", division: "sub",
    description: "Tracks all sales opportunities, sends follow-ups, manages CRM for Lindy agent business.",
    capabilities: ["CRM Mgmt", "Follow-ups", "Deal Tracking", "Reporting"],
    projects: ["Lindy Agent Business"],
  }},

  // Under CTO
  { id: "devops", type: "orgNode", position: { x: COL * 5.5, y: ROW * 4.2 }, data: {
    label: "Software DevOps", role: "Deployment & CI/CD", status: "planned", division: "sub",
    description: "Code deployment, CI/CD pipelines, infrastructure management.",
    capabilities: ["CI/CD", "Deployment", "Monitoring", "Infrastructure"],
  }},
  { id: "revenue-analysis", type: "orgNode", position: { x: COL * 6.5, y: ROW * 4.2 }, data: {
    label: "Revenue Analysis", role: "Business Metrics", status: "planned", division: "sub",
    description: "Tracks MRR, forecasts revenue, identifies growth opportunities.",
    capabilities: ["MRR Tracking", "Forecasting", "Growth Analysis", "Dashboards"],
  }},

  // AI Debug Team (under CTO, row 3)
  { id: "code-analysis", type: "orgNode", position: { x: COL * 5.5, y: ROW * 5.4 }, data: {
    label: "Code Analysis", role: "Claude Sonnet", status: "planned", division: "sub",
    description: "Reviews code quality and identifies issues using Claude Sonnet.",
    capabilities: ["Code Review", "Bug Detection", "Best Practices"],
  }},
  { id: "error-resolution", type: "orgNode", position: { x: COL * 6.5, y: ROW * 5.4 }, data: {
    label: "Error Resolution", role: "Complex Logic", status: "planned", division: "sub",
    description: "Resolves complex logic errors in AI builds.",
    capabilities: ["Debug Complex Bugs", "Logic Analysis", "Fix Suggestions"],
  }},
  { id: "perf-optimization", type: "orgNode", position: { x: COL * 7.5, y: ROW * 5.4 }, data: {
    label: "Perf Optimization", role: "Speed & Efficiency", status: "planned", division: "sub",
    description: "Optimizes agent performance and response times.",
    capabilities: ["Latency Reduction", "Resource Optimization", "Caching"],
  }},

  // Under COO (Ops)
  { id: "infra-mgmt", type: "orgNode", position: { x: COL * 7.5, y: ROW * 4.2 }, data: {
    label: "Infrastructure Mgmt", role: "Servers & Infra", status: "planned", division: "sub",
    description: "Server and infrastructure management.",
    capabilities: ["Server Mgmt", "Scaling", "Uptime Monitoring"],
  }},

  // Under CFO
  { id: "budget-planning", type: "orgNode", position: { x: COL * 9, y: ROW * 4.2 }, data: {
    label: "Budget Planning", role: "Financial Forecasting", status: "planned", division: "sub",
    description: "Budget allocation and financial forecasting.",
    capabilities: ["Budget Allocation", "Forecasting", "Expense Tracking"],
  }},

  // Under CLO
  { id: "contract-mgmt", type: "orgNode", position: { x: COL * 9.5, y: ROW * 4.2 }, data: {
    label: "Contract Mgmt", role: "Client Contracts", status: "planned", division: "sub",
    description: "Manages all client contracts for Lindy agent business and future products.",
    capabilities: ["Contract Drafting", "Client Terms", "Renewals"],
  }},
  { id: "risk-mgmt", type: "orgNode", position: { x: COL * 10.5, y: ROW * 4.2 }, data: {
    label: "Risk Management", role: "Risk & Mitigation", status: "planned", division: "sub",
    description: "Identifies and mitigates business, legal and operational risks.",
    capabilities: ["Risk Assessment", "Mitigation Plans", "Compliance Audits"],
  }},
];

// ─── Edges ──────────────────────────────────────────────────
function edgeStyle(division: Division, animated = false): Partial<Edge> {
  const color = DIV_COLORS[division].border;
  return { type: "smoothstep", animated, style: { stroke: color, strokeWidth: animated ? 2 : 1.5, opacity: 0.7 } };
}

const EDGES: Edge[] = [
  // Dylan to JARVIS
  { id: "d-j", source: "dylan", target: "jarvis", ...edgeStyle("jarvis", true) },

  // JARVIS to division heads
  { id: "j-coo-cs",  source: "jarvis", target: "coo-cs",  ...edgeStyle("csuite") },
  { id: "j-chro",    source: "jarvis", target: "chro",    ...edgeStyle("csuite") },
  { id: "j-cmo",     source: "jarvis", target: "cmo",     ...edgeStyle("revenue") },
  { id: "j-cso",     source: "jarvis", target: "cso",     ...edgeStyle("revenue", true) },
  { id: "j-cto",     source: "jarvis", target: "cto",     ...edgeStyle("opstech") },
  { id: "j-coo-ops", source: "jarvis", target: "coo-ops", ...edgeStyle("opstech") },
  { id: "j-cfo",     source: "jarvis", target: "cfo",     ...edgeStyle("finance") },
  { id: "j-clo",     source: "jarvis", target: "clo",     ...edgeStyle("finance") },

  // CMO subs
  { id: "cmo-cc",  source: "cmo", target: "content-creator", ...edgeStyle("sub") },
  { id: "cmo-lg",  source: "cmo", target: "lead-gen",        ...edgeStyle("sub") },

  // CSO subs
  { id: "cso-pm",  source: "cso", target: "pipeline-mgmt", ...edgeStyle("sub", true) },

  // CTO subs
  { id: "cto-do",  source: "cto", target: "devops",           ...edgeStyle("sub") },
  { id: "cto-ra",  source: "cto", target: "revenue-analysis", ...edgeStyle("sub") },
  { id: "cto-ca",  source: "cto", target: "code-analysis",    ...edgeStyle("sub") },
  { id: "cto-er",  source: "cto", target: "error-resolution", ...edgeStyle("sub") },
  { id: "cto-po",  source: "cto", target: "perf-optimization",...edgeStyle("sub") },

  // COO (Ops) subs
  { id: "coo-im",  source: "coo-ops", target: "infra-mgmt",  ...edgeStyle("sub") },

  // CFO subs
  { id: "cfo-bp",  source: "cfo", target: "budget-planning",  ...edgeStyle("sub") },

  // CLO subs
  { id: "clo-cm",  source: "clo", target: "contract-mgmt",   ...edgeStyle("sub") },
  { id: "clo-rm",  source: "clo", target: "risk-mgmt",       ...edgeStyle("sub") },
];

// ─── Detail Panel ───────────────────────────────────────────
function DetailPanel({ node, onClose }: { node: Node<OrgNodeData>; onClose: () => void }) {
  const d = node.data;
  const colors = DIV_COLORS[d.division];
  const status = STATUS_BADGES[d.status];
  const divLabel = DIV_LABELS[d.division as string];

  return (
    <div className="absolute top-4 right-4 w-80 bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5 z-10 shadow-2xl animate-[slideUp_0.2s_ease-out] max-h-[90%] overflow-y-auto">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-white text-base">{d.label}</h3>
          <p className="text-xs" style={{ color: colors.text }}>{d.role}</p>
        </div>
        <button onClick={onClose} className="text-[#64748b] hover:text-white text-lg leading-none p-1">x</button>
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        {divLabel && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: divLabel.color, background: `${divLabel.color}20` }}>
            {divLabel.label}
          </span>
        )}
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: status.color, background: status.bg }}>
          {status.label}
        </span>
      </div>

      <p className="text-xs text-[#94a3b8] mb-4 leading-relaxed">{d.description}</p>

      {d.capabilities && d.capabilities.length > 0 && (
        <div className="mb-4">
          <h4 className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider mb-1.5">Capabilities</h4>
          <div className="space-y-1">
            {d.capabilities.map((c) => (
              <div key={c} className="flex items-center gap-2 text-xs text-[#94a3b8]">
                <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: colors.border }} />
                {c}
              </div>
            ))}
          </div>
        </div>
      )}

      {d.projects && d.projects.length > 0 && (
        <div className="mb-4">
          <h4 className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider mb-1.5">Projects</h4>
          <div className="space-y-1">
            {d.projects.map((p) => (
              <div key={p} className="text-xs text-[#e2e8f0] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: colors.border }} />
                {p}
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors bg-[#1e1e2e] text-[#94a3b8] hover:bg-[#6366f1]/20 hover:text-[#a5b4fc] mt-2">
        Activate Agent
      </button>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────
export default function OrgChart() {
  const [nodes, , onNodesChange] = useNodesState(NODES);
  const [edges, , onEdgesChange] = useEdgesState(EDGES);
  const [selectedNode, setSelectedNode] = useState<Node<OrgNodeData> | null>(null);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node as Node<OrgNodeData>);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div className="w-full h-[600px] bg-[#0a0a0f] rounded-xl border border-[#1e1e2e] overflow-hidden relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={2}
        className="org-chart-flow"
      >
        <Background color="#1e1e2e" gap={24} variant={BackgroundVariant.Dots} />
        <Controls
          showInteractive={false}
          className="!bg-[#12121a] !border-[#1e1e2e] !rounded-lg !shadow-lg [&>button]:!bg-[#12121a] [&>button]:!border-[#1e1e2e] [&>button]:!text-[#94a3b8] [&>button:hover]:!bg-[#1e1e2e]"
        />
      </ReactFlow>

      {selectedNode && (
        <DetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
      )}

      {/* Division Legend */}
      <div className="absolute bottom-4 left-4 bg-[#12121a]/90 border border-[#1e1e2e] rounded-lg px-3 py-2 flex flex-wrap gap-3 z-10">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: "#6366f1" }} /><span className="text-[10px] text-[#94a3b8]">JARVIS</span></div>
        {Object.entries(DIV_LABELS).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: val.color }} />
            <span className="text-[10px] text-[#94a3b8]">{val.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
