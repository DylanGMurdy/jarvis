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
type AgentStatus = "active" | "development" | "planning" | "needed";
type RoleType = "ceo" | "chief" | "agent" | "future";

interface OrgNodeData {
  label: string;
  role: string;
  status: AgentStatus;
  roleType: RoleType;
  description: string;
  projects?: string[];
  capabilities?: string[];
  [key: string]: unknown;
}

// ─── Color scheme ───────────────────────────────────────────
const ROLE_COLORS: Record<RoleType, { bg: string; border: string; glow: string; text: string }> = {
  ceo:    { bg: "#1e3a5f", border: "#3b82f6", glow: "rgba(59,130,246,0.3)",  text: "#93c5fd" },
  chief:  { bg: "#14532d", border: "#22c55e", glow: "rgba(34,197,94,0.3)",   text: "#86efac" },
  agent:  { bg: "#3b1f6e", border: "#a855f7", glow: "rgba(168,85,247,0.3)",  text: "#d8b4fe" },
  future: { bg: "#1e1e2e", border: "#64748b", glow: "rgba(100,116,139,0.15)", text: "#94a3b8" },
};

const STATUS_BADGES: Record<AgentStatus, { label: string; color: string; bg: string }> = {
  active:      { label: "Active",      color: "#22c55e", bg: "rgba(34,197,94,0.15)" },
  development: { label: "In Dev",      color: "#eab308", bg: "rgba(234,179,8,0.15)" },
  planning:    { label: "Planning",    color: "#6366f1", bg: "rgba(99,102,241,0.15)" },
  needed:      { label: "Needed",      color: "#64748b", bg: "rgba(100,116,139,0.15)" },
};

// ─── Custom Node ────────────────────────────────────────────
function OrgNode({ data, selected }: { data: OrgNodeData; selected?: boolean }) {
  const colors = ROLE_COLORS[data.roleType];
  const status = STATUS_BADGES[data.status];

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-3 !h-3" />
      <div
        className="rounded-xl px-5 py-4 min-w-[180px] max-w-[220px] transition-all duration-200 cursor-pointer"
        style={{
          background: colors.bg,
          border: `1.5px solid ${selected ? "#fff" : colors.border}`,
          boxShadow: selected
            ? `0 0 20px ${colors.glow}, 0 0 40px ${colors.glow}`
            : `0 0 12px ${colors.glow}`,
        }}
      >
        {/* Status badge */}
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ color: status.color, background: status.bg }}
          >
            {status.label}
          </span>
          {data.status === "active" && (
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: status.color }} />
          )}
        </div>

        {/* Name */}
        <h3 className="text-sm font-bold text-white leading-tight">{data.label}</h3>
        <p className="text-[11px] mt-0.5" style={{ color: colors.text }}>{data.role}</p>

        {/* Quick stats */}
        {data.projects && data.projects.length > 0 && (
          <div className="mt-2 pt-2 border-t" style={{ borderColor: `${colors.border}40` }}>
            <p className="text-[10px] text-[#94a3b8]">{data.projects.length} project{data.projects.length > 1 ? "s" : ""}</p>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-3 !h-3" />
    </>
  );
}

const nodeTypes: NodeTypes = { orgNode: OrgNode };

// ─── Initial nodes ──────────────────────────────────────────
const INITIAL_NODES: Node<OrgNodeData>[] = [
  {
    id: "dylan",
    type: "orgNode",
    position: { x: 350, y: 0 },
    data: {
      label: "Dylan Murdoch",
      role: "CEO / Founder",
      status: "active",
      roleType: "ceo",
      description: "Founder and visionary. Real estate agent at Narwhal Homes building AI businesses for financial freedom.",
      projects: ["AI Lead Nurture", "Jarvis SaaS", "Football Film Platform", "Narwhal Ops"],
      capabilities: ["Strategy", "Sales", "Product Vision", "Builder Relationships"],
    },
  },
  {
    id: "jarvis",
    type: "orgNode",
    position: { x: 350, y: 140 },
    data: {
      label: "JARVIS",
      role: "Chief of Staff",
      status: "active",
      roleType: "chief",
      description: "AI Chief of Staff. Manages all sub-agents, tracks goals, holds context across all projects, generates daily briefs.",
      projects: ["Dashboard", "Memory System", "Daily Briefs", "Agent Coordination"],
      capabilities: ["Memory", "Planning", "Delegation", "Reporting"],
    },
  },
  {
    id: "lead-nurture",
    type: "orgNode",
    position: { x: 0, y: 300 },
    data: {
      label: "Lead Nurture Agent",
      role: "Sales & Outreach",
      status: "development",
      roleType: "agent",
      description: "Automated lead follow-up for new construction builders. Monitors leads, sends personalized sequences, qualifies prospects.",
      projects: ["AI Lead Nurture MVP"],
      capabilities: ["Email Sequences", "Lead Scoring", "CRM Integration", "Follow-up Automation"],
    },
  },
  {
    id: "content-lead",
    type: "orgNode",
    position: { x: 230, y: 300 },
    data: {
      label: "Content Team Lead",
      role: "Content & Marketing",
      status: "planning",
      roleType: "agent",
      description: "Generates listing descriptions, social posts, marketing copy, and video scripts. White-label for builder clients.",
      projects: ["AI Listing Content Generator"],
      capabilities: ["MLS Descriptions", "Social Media", "Marketing Copy", "SEO"],
    },
  },
  {
    id: "research",
    type: "orgNode",
    position: { x: 470, y: 300 },
    data: {
      label: "Research & Analysis",
      role: "Market Intelligence",
      status: "planning",
      roleType: "agent",
      description: "Tracks Utah County market data, inventory levels, price trends, and competitor analysis. Weekly reports.",
      projects: ["Market Analyzer"],
      capabilities: ["Market Data", "Trend Analysis", "Competitor Intel", "Reporting"],
    },
  },
  {
    id: "deploy",
    type: "orgNode",
    position: { x: 700, y: 300 },
    data: {
      label: "Deployment & Tech",
      role: "Engineering & DevOps",
      status: "active",
      roleType: "agent",
      description: "Manages deployments, monitors uptime, handles CI/CD, and coordinates with Claude Code for builds.",
      projects: ["Jarvis Dashboard", "Vercel Deployments"],
      capabilities: ["CI/CD", "Monitoring", "Database", "API Management"],
    },
  },
];

// ─── Initial edges ──────────────────────────────────────────
const INITIAL_EDGES: Edge[] = [
  { id: "e-dylan-jarvis", source: "dylan", target: "jarvis", type: "smoothstep", animated: true, style: { stroke: "#22c55e", strokeWidth: 2 } },
  { id: "e-jarvis-lead", source: "jarvis", target: "lead-nurture", type: "smoothstep", style: { stroke: "#a855f7", strokeWidth: 1.5 } },
  { id: "e-jarvis-content", source: "jarvis", target: "content-lead", type: "smoothstep", style: { stroke: "#a855f7", strokeWidth: 1.5 } },
  { id: "e-jarvis-research", source: "jarvis", target: "research", type: "smoothstep", style: { stroke: "#a855f7", strokeWidth: 1.5 } },
  { id: "e-jarvis-deploy", source: "jarvis", target: "deploy", type: "smoothstep", style: { stroke: "#a855f7", strokeWidth: 1.5 } },
];

// ─── Detail Panel ───────────────────────────────────────────
function DetailPanel({ node, onClose }: { node: Node<OrgNodeData>; onClose: () => void }) {
  const d = node.data;
  const colors = ROLE_COLORS[d.roleType];
  const status = STATUS_BADGES[d.status];

  return (
    <div className="absolute top-4 right-4 w-72 bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5 z-10 shadow-2xl animate-[slideUp_0.2s_ease-out]">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-white text-base">{d.label}</h3>
          <p className="text-xs" style={{ color: colors.text }}>{d.role}</p>
        </div>
        <button onClick={onClose} className="text-[#64748b] hover:text-white text-lg leading-none p-1">x</button>
      </div>

      <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mb-3" style={{ color: status.color, background: status.bg }}>
        {status.label}
      </span>

      <p className="text-xs text-[#94a3b8] mb-4 leading-relaxed">{d.description}</p>

      {d.capabilities && d.capabilities.length > 0 && (
        <div className="mb-4">
          <h4 className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider mb-1.5">Capabilities</h4>
          <div className="flex flex-wrap gap-1">
            {d.capabilities.map((c) => (
              <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e1e2e] text-[#94a3b8]">{c}</span>
            ))}
          </div>
        </div>
      )}

      {d.projects && d.projects.length > 0 && (
        <div>
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
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────
export default function OrgChart() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState<Node<OrgNodeData> | null>(null);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node as Node<OrgNodeData>);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Suppress unused variable warnings
  void setNodes;
  void setEdges;

  return (
    <div className="w-full h-[520px] bg-[#0a0a0f] rounded-xl border border-[#1e1e2e] overflow-hidden relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.4}
        maxZoom={1.5}
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

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-[#12121a]/90 border border-[#1e1e2e] rounded-lg px-3 py-2 flex flex-wrap gap-3 z-10">
        {Object.entries(STATUS_BADGES).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: val.color }} />
            <span className="text-[10px] text-[#94a3b8]">{val.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
