"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const OrgChart = dynamic(() => import("@/components/OrgChart"), { ssr: false });

type ModalData = { title: string; body: string; actions?: { label: string; onClick: () => void }[] } | null;

const AGENTS = [
  { name: "Lead Nurture Bot", status: "active" as const, desc: "Monitoring 23 builder leads across 4 communities. Last engagement: 12 min ago. Sent 3 follow-ups today.", lastAction: "Sent follow-up to Ivory Homes lead #847" },
  { name: "Inbox Sentinel", status: "active" as const, desc: "Processing incoming emails, flagging priority items, drafting responses. 12 emails processed today, 3 flagged for review.", lastAction: "Flagged urgent email from broker" },
  { name: "Content Writer", status: "idle" as const, desc: "Ready to generate listing descriptions, social posts, and marketing copy. Last run: Yesterday, generated 4 listings.", lastAction: "Generated 4 listing descriptions" },
  { name: "Market Analyzer", status: "idle" as const, desc: "Tracks Utah County market data, inventory levels, and price trends. Next scheduled run: Tonight at 10pm.", lastAction: "Compiled weekly market report" },
  { name: "Scheduler", status: "active" as const, desc: "Managing calendar, coordinating showings, and protecting family time blocks. 2 showings scheduled this week.", lastAction: "Blocked family time 6-8pm" },
  { name: "CFO Agent", status: "active" as const, desc: "Financial analysis for all projects — revenue models, unit economics, funding needs, and risk assessment. Available in every project War Room.", lastAction: "Generated revenue model for Lindy Agent Business" },
  { name: "COO Agent", status: "active" as const, desc: "Operations strategy — daily operations plans, hiring roadmaps, process maps, and KPI definitions. Available in every project War Room.", lastAction: "Built operations plan for Lindy Agent Business" },
  { name: "VP of Product", status: "active" as const, desc: "Product strategy — vision, RICE-scored feature roadmaps, user personas, and competitive analysis. Available in every project War Room.", lastAction: "Created feature roadmap for Lindy Agent Business" },
  { name: "VP of Engineering", status: "active" as const, desc: "Technical planning — system architecture, 2-week sprint plans, tech debt prevention, and API design. Available in every project War Room.", lastAction: "Designed architecture for Lindy Agent Business" },
];

const StatusDot = ({ status }: { status: "active" | "idle" | "error" }) => (
  <span className={`inline-block w-2 h-2 rounded-full ${status === "active" ? "bg-jarvis-green animate-[pulse-dot_2s_ease-in-out_infinite]" : status === "idle" ? "bg-jarvis-yellow" : "bg-jarvis-red"}`} />
);

interface AgentsTabProps {
  openModal: (data: ModalData) => void;
  closeModal: () => void;
}

export default function AgentsTab({ openModal, closeModal }: AgentsTabProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ projectsProcessed: number; tasksGenerated: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function triggerDailyAgent() {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/agents/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Agent run failed");
      } else {
        setResult({ projectsProcessed: data.projectsProcessed, tasksGenerated: data.tasksGenerated });
      }
    } catch {
      setError("Network error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6 animate-[slideUp_0.3s_ease-out]">
      {/* Org Chart */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold">PE Business Empire</h2>
            <p className="text-xs text-jarvis-muted">21 Agents &middot; Click nodes for details &middot; Pinch to zoom</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-jarvis-muted">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-jarvis-green" /> 1 Active</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-jarvis-yellow" /> 2 In Dev</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-jarvis-muted" /> 18 Planned</span>
          </div>
        </div>
        <OrgChart />
      </div>

      {/* Agent Activity */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-jarvis-muted">Agent Activity</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={triggerDailyAgent}
              disabled={running}
              className="text-xs px-3 py-1.5 rounded-lg bg-jarvis-accent/20 text-jarvis-accent hover:bg-jarvis-accent/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running ? "Running..." : "Run Daily Agent"}
            </button>
            <div className="flex items-center gap-2 text-xs text-jarvis-muted">
              <StatusDot status="active" /> {AGENTS.filter((a) => a.status === "active").length} Active
              <StatusDot status="idle" /> {AGENTS.filter((a) => a.status === "idle").length} Idle
            </div>
          </div>
        </div>

        {result && (
          <div className="mb-3 p-3 rounded-lg bg-jarvis-green/10 border border-jarvis-green/30 text-sm text-jarvis-green">
            Processed {result.projectsProcessed} projects, generated {result.tasksGenerated} tasks
          </div>
        )}
        {error && (
          <div className="mb-3 p-3 rounded-lg bg-jarvis-red/10 border border-jarvis-red/30 text-sm text-jarvis-red">
            {error}
          </div>
        )}

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
}
