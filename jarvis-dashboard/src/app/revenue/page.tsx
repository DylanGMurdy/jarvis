"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Scenarios ────────────────────────────────────────────
const SCENARIOS = {
  conservative: { label: "Conservative", clientsPerMonth: 2, churn: 5, arpu: 97 },
  realistic:    { label: "Realistic",    clientsPerMonth: 4, churn: 3, arpu: 97 },
  aggressive:   { label: "Aggressive",   clientsPerMonth: 8, churn: 1, arpu: 97 },
} as const;
type ScenarioKey = keyof typeof SCENARIOS;

// ── Milestones (in MRR $) ────────────────────────────────
const MILESTONES = [
  { mrr: 1067, label: "11 Lindy clients", color: "#22c55e" },
  { mrr: 5000, label: "$5K MRR", color: "#06b6d4" },
  { mrr: 8333, label: "$100K ARR", color: "#f59e0b" },
  { mrr: 10000, label: "$10K MRR", color: "#a855f7" },
];

interface MonthRow {
  month: number;
  label: string;
  clients: number;
  mrr: number;
}

function projectRevenue(startMrr: number, newClientsPerMonth: number, churnPct: number, arpu: number): MonthRow[] {
  const months: MonthRow[] = [];
  let clients = arpu > 0 ? Math.round(startMrr / arpu) : 0;
  const start = new Date();
  for (let i = 0; i < 12; i++) {
    const lost = clients * (churnPct / 100);
    clients = Math.max(0, clients - lost + newClientsPerMonth);
    const mrr = Math.round(clients * arpu);
    const date = new Date(start.getFullYear(), start.getMonth() + i, 1);
    months.push({
      month: i + 1,
      label: date.toLocaleDateString("en-US", { month: "short" }),
      clients: Math.round(clients),
      mrr,
    });
  }
  return months;
}

export default function RevenuePage() {
  const [currentMrr, setCurrentMrr] = useState(0);
  const [newClients, setNewClients] = useState(4);
  const [churn, setChurn] = useState(3);
  const [arpu, setArpu] = useState(97);

  function applyScenario(key: ScenarioKey) {
    const s = SCENARIOS[key];
    setNewClients(s.clientsPerMonth);
    setChurn(s.churn);
    setArpu(s.arpu);
  }

  const projection = useMemo(
    () => projectRevenue(currentMrr, newClients, churn, arpu),
    [currentMrr, newClients, churn, arpu]
  );

  const peakMrr = Math.max(...projection.map((m) => m.mrr), currentMrr);
  const totalRevenue = projection.reduce((acc, m) => acc + m.mrr, 0);
  const monthsTo100kARR = projection.findIndex((m) => m.mrr * 12 >= 100000);

  // SVG dimensions
  const W = 800;
  const H = 320;
  const padL = 50;
  const padR = 20;
  const padT = 20;
  const padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const barGap = 6;
  const barWidth = (chartW - barGap * 11) / 12;

  const yMax = Math.max(peakMrr, 11000) * 1.1;
  const yScale = (v: number) => padT + chartH - (v / yMax) * chartH;

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <Link href="/" className="text-xs text-jarvis-muted hover:text-jarvis-accent">← Back to Dashboard</Link>
            <h1 className="text-2xl font-bold text-white mt-1">Revenue Projector</h1>
            <p className="text-sm text-jarvis-muted">12-month MRR forecast based on your inputs</p>
          </div>
        </div>

        {/* Scenario buttons */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(Object.keys(SCENARIOS) as ScenarioKey[]).map((key) => {
            const s = SCENARIOS[key];
            const isActive = newClients === s.clientsPerMonth && churn === s.churn && arpu === s.arpu;
            return (
              <button
                key={key}
                onClick={() => applyScenario(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                  isActive
                    ? "bg-jarvis-accent text-white border-jarvis-accent"
                    : "bg-jarvis-card text-jarvis-muted hover:text-white border-jarvis-border hover:border-jarvis-accent/50"
                }`}
              >
                <div>{s.label}</div>
                <div className="text-[10px] opacity-80">{s.clientsPerMonth} clients/mo · {s.churn}% churn</div>
              </button>
            );
          })}
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Current MRR */}
          <div className="bg-jarvis-card border border-jarvis-border rounded-xl p-4">
            <label className="text-xs text-jarvis-muted block mb-2">Current MRR</label>
            <div className="flex items-center gap-2">
              <span className="text-jarvis-muted">$</span>
              <input
                type="number"
                value={currentMrr}
                onChange={(e) => setCurrentMrr(Math.max(0, Number(e.target.value) || 0))}
                className="flex-1 bg-jarvis-bg border border-jarvis-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-jarvis-accent"
              />
            </div>
          </div>

          {/* ARPU */}
          <div className="bg-jarvis-card border border-jarvis-border rounded-xl p-4">
            <label className="text-xs text-jarvis-muted block mb-2">Average Revenue Per Client</label>
            <div className="flex items-center gap-2">
              <span className="text-jarvis-muted">$</span>
              <input
                type="number"
                value={arpu}
                onChange={(e) => setArpu(Math.max(1, Number(e.target.value) || 1))}
                className="flex-1 bg-jarvis-bg border border-jarvis-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-jarvis-accent"
              />
              <span className="text-xs text-jarvis-muted">/mo</span>
            </div>
          </div>

          {/* New clients/month slider */}
          <div className="bg-jarvis-card border border-jarvis-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-jarvis-muted">New Clients per Month</label>
              <span className="text-sm font-bold text-jarvis-accent">{newClients}</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={newClients}
              onChange={(e) => setNewClients(Number(e.target.value))}
              className="w-full accent-jarvis-accent"
            />
            <div className="flex justify-between text-[10px] text-jarvis-muted mt-1">
              <span>1</span><span>10</span>
            </div>
          </div>

          {/* Churn slider */}
          <div className="bg-jarvis-card border border-jarvis-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-jarvis-muted">Monthly Churn Rate</label>
              <span className="text-sm font-bold text-jarvis-accent">{churn}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={20}
              step={1}
              value={churn}
              onChange={(e) => setChurn(Number(e.target.value))}
              className="w-full accent-jarvis-accent"
            />
            <div className="flex justify-between text-[10px] text-jarvis-muted mt-1">
              <span>0%</span><span>20%</span>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-jarvis-card border border-jarvis-border rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-jarvis-muted">Months to $100K ARR</div>
            <div className="text-2xl font-bold text-jarvis-accent mt-1">
              {monthsTo100kARR === -1 ? ">12" : `${monthsTo100kARR + 1}`}
            </div>
            <div className="text-[10px] text-jarvis-muted mt-1">at current pace</div>
          </div>
          <div className="bg-jarvis-card border border-jarvis-border rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-jarvis-muted">Total 12-month Revenue</div>
            <div className="text-2xl font-bold text-jarvis-green mt-1">
              ${totalRevenue.toLocaleString()}
            </div>
            <div className="text-[10px] text-jarvis-muted mt-1">cumulative MRR</div>
          </div>
          <div className="bg-jarvis-card border border-jarvis-border rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-jarvis-muted">Peak MRR</div>
            <div className="text-2xl font-bold text-purple-400 mt-1">
              ${peakMrr.toLocaleString()}
            </div>
            <div className="text-[10px] text-jarvis-muted mt-1">highest month</div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-jarvis-card border border-jarvis-border rounded-xl p-4 mb-6 overflow-x-auto">
          <h3 className="text-sm font-bold text-white mb-4">12-Month MRR Forecast</h3>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
            {/* Y axis grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
              const v = yMax * frac;
              const y = yScale(v);
              return (
                <g key={frac}>
                  <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#1e1e2e" strokeWidth={1} />
                  <text x={padL - 6} y={y + 3} textAnchor="end" fontSize={9} fill="#64748b">${Math.round(v).toLocaleString()}</text>
                </g>
              );
            })}

            {/* Milestone lines */}
            {MILESTONES.filter((m) => m.mrr <= yMax).map((m) => {
              const y = yScale(m.mrr);
              return (
                <g key={m.label}>
                  <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={m.color} strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />
                  <text x={W - padR - 4} y={y - 3} textAnchor="end" fontSize={9} fill={m.color} fontWeight="bold">
                    {m.label} (${m.mrr.toLocaleString()})
                  </text>
                </g>
              );
            })}

            {/* Bars */}
            {projection.map((m, i) => {
              const x = padL + i * (barWidth + barGap);
              const y = yScale(m.mrr);
              const h = padT + chartH - y;
              const hitsMilestone = MILESTONES.find((ms) => m.mrr >= ms.mrr && (i === 0 || projection[i - 1].mrr < ms.mrr));
              return (
                <g key={i}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(h, 1)}
                    fill={hitsMilestone ? hitsMilestone.color : "#6366f1"}
                    rx={3}
                  />
                  <text x={x + barWidth / 2} y={H - padB + 14} textAnchor="middle" fontSize={9} fill="#64748b">
                    {m.label}
                  </text>
                  <text x={x + barWidth / 2} y={H - padB + 26} textAnchor="middle" fontSize={8} fill="#94a3b8">
                    ${(m.mrr / 1000).toFixed(1)}K
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 mt-4 text-[10px] text-jarvis-muted">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#6366f1]" /> MRR</div>
            {MILESTONES.map((m) => (
              <div key={m.label} className="flex items-center gap-1.5">
                <span className="w-3 h-0.5" style={{ background: m.color }} /> {m.label}
              </div>
            ))}
          </div>
        </div>

        {/* Monthly breakdown table */}
        <div className="bg-jarvis-card border border-jarvis-border rounded-xl p-4">
          <h3 className="text-sm font-bold text-white mb-3">Month-by-Month Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-jarvis-border text-jarvis-muted">
                  <th className="text-left py-2 px-2">Month</th>
                  <th className="text-right py-2 px-2">Clients</th>
                  <th className="text-right py-2 px-2">MRR</th>
                  <th className="text-right py-2 px-2">ARR</th>
                </tr>
              </thead>
              <tbody>
                {projection.map((m, i) => (
                  <tr key={i} className="border-b border-jarvis-border/40 hover:bg-jarvis-border/20">
                    <td className="py-2 px-2 text-white">M{m.month} — {m.label}</td>
                    <td className="text-right py-2 px-2 text-jarvis-text">{m.clients}</td>
                    <td className="text-right py-2 px-2 text-jarvis-accent font-semibold">${m.mrr.toLocaleString()}</td>
                    <td className="text-right py-2 px-2 text-jarvis-green">${(m.mrr * 12).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
