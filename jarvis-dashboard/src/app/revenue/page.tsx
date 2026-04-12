"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import RevenueTab from "@/components/dashboard/RevenueTab";

// ── Scenarios ─────────────────────────────────────────────
type Scenario = "conservative" | "realistic" | "aggressive";

const SCENARIOS: Record<Scenario, { label: string; growth: number; churn: number; arpu: number; desc: string }> = {
  conservative: { label: "Conservative", growth: 1, churn: 8, arpu: 97, desc: "1 new client/mo, 8% churn" },
  realistic:    { label: "Realistic",    growth: 2, churn: 4, arpu: 97, desc: "2 new clients/mo, 4% churn" },
  aggressive:   { label: "Aggressive",   growth: 4, churn: 2, arpu: 97, desc: "4 new clients/mo, 2% churn" },
};

// ── Milestones ────────────────────────────────────────────
const MILESTONES = [
  { mrr: 1067, label: "11 Lindy clients", color: "#22c55e", emoji: "🚀" },
  { mrr: 5000, label: "$5K/mo", color: "#06b6d4", emoji: "💎" },
  { mrr: 10000, label: "$10K/mo", color: "#a855f7", emoji: "🔥" },
  { mrr: 8333, label: "$100K ARR", color: "#f59e0b", emoji: "🏆" },
];

interface MonthData {
  month: number;
  label: string;
  clients: number;
  mrr: number;
  cumulative: number;
  hitMilestones: typeof MILESTONES;
}

function projectRevenue(currentMrr: number, currentClients: number, growthRate: number, churnPct: number, arpu: number): MonthData[] {
  const months: MonthData[] = [];
  let mrr = currentMrr;
  let clients = currentClients;
  let cumulative = 0;
  const trackedMilestones = new Set<number>();

  const start = new Date();
  for (let i = 0; i < 12; i++) {
    // Apply churn: lose churn% of clients
    const churned = clients * (churnPct / 100);
    clients = Math.max(0, clients - churned + growthRate);
    mrr = clients * arpu;
    cumulative += mrr;

    const date = new Date(start.getFullYear(), start.getMonth() + i + 1, 1);
    const label = date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

    const hit = MILESTONES.filter((m) => mrr >= m.mrr && !trackedMilestones.has(m.mrr));
    hit.forEach((m) => trackedMilestones.add(m.mrr));

    months.push({
      month: i + 1,
      label,
      clients: Math.round(clients),
      mrr: Math.round(mrr),
      cumulative: Math.round(cumulative),
      hitMilestones: hit,
    });
  }
  return months;
}

// ── Bar Chart ─────────────────────────────────────────────
function BarChart({ months }: { months: MonthData[] }) {
  const maxMrr = Math.max(...months.map((m) => m.mrr), 1000);
  const w = 600, h = 240, pad = 30;
  const barW = (w - pad * 2) / months.length - 4;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h + 40}`} className="w-full min-w-[500px]" preserveAspectRatio="xMidYMid meet">
        {/* Y-axis grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const y = h - p * h + 10;
          return (
            <g key={p}>
              <line x1={pad} y1={y} x2={w - pad} y2={y} stroke="#1e1e2e" strokeWidth="1" strokeDasharray="2 4" />
              <text x={pad - 4} y={y + 3} textAnchor="end" className="fill-[#64748b]" fontSize="9">
                ${Math.round((p * maxMrr) / 100) * 100}
              </text>
            </g>
          );
        })}

        {/* Milestone reference lines */}
        {MILESTONES.filter((m) => m.mrr <= maxMrr).map((m) => {
          const y = h - (m.mrr / maxMrr) * h + 10;
          return (
            <g key={m.mrr}>
              <line x1={pad} y1={y} x2={w - pad} y2={y} stroke={m.color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
              <text x={w - pad + 2} y={y + 3} className="fill-current" fontSize="8" fill={m.color}>
                {m.emoji} {m.label}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {months.map((m, i) => {
          const x = pad + i * (barW + 4);
          const barH = (m.mrr / maxMrr) * h;
          const y = h - barH + 10;
          const isMilestone = m.hitMilestones.length > 0;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx="2"
                fill={isMilestone ? "url(#milestoneGrad)" : "url(#barGrad)"}
              />
              <text x={x + barW / 2} y={h + 22} textAnchor="middle" className="fill-[#64748b]" fontSize="9">
                {m.label}
              </text>
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" className="fill-white" fontSize="8" fontWeight="600">
                ${m.mrr >= 1000 ? `${(m.mrr / 1000).toFixed(1)}k` : m.mrr}
              </text>
            </g>
          );
        })}

        {/* Gradients */}
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.5" />
          </linearGradient>
          <linearGradient id="milestoneGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.7" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────
export default function RevenuePage() {
  const [scenario, setScenario] = useState<Scenario>("realistic");
  const [currentMrr, setCurrentMrr] = useState(0);
  const [growthRate, setGrowthRate] = useState(SCENARIOS.realistic.growth);
  const [churnPct, setChurnPct] = useState(SCENARIOS.realistic.churn);
  const [arpu, setArpu] = useState(97);
  const [savingMrr, setSavingMrr] = useState(false);

  // Load saved MRR on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/revenue-settings");
        const data = await res.json();
        if (typeof data.data?.current_mrr === "number") {
          setCurrentMrr(data.data.current_mrr);
        }
      } catch { /* silent */ }
    })();
  }, []);

  // Apply scenario presets
  function applyScenario(s: Scenario) {
    setScenario(s);
    setGrowthRate(SCENARIOS[s].growth);
    setChurnPct(SCENARIOS[s].churn);
    setArpu(SCENARIOS[s].arpu);
  }

  async function saveCurrentMrr() {
    setSavingMrr(true);
    try {
      await fetch("/api/revenue-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_mrr: currentMrr }),
      });
    } catch { /* silent */ }
    setSavingMrr(false);
  }

  const currentClients = arpu > 0 ? Math.round(currentMrr / arpu) : 0;
  const months = useMemo(
    () => projectRevenue(currentMrr, currentClients, growthRate, churnPct, arpu),
    [currentMrr, currentClients, growthRate, churnPct, arpu]
  );

  const finalMrr = months[months.length - 1]?.mrr || 0;
  const finalClients = months[months.length - 1]?.clients || 0;
  const totalRevenue = months[months.length - 1]?.cumulative || 0;
  const finalArr = finalMrr * 12;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e2e8f0]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-8">
        {/* Header */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[#64748b] hover:text-white transition-colors text-sm mb-4 tap-target-auto"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Dashboard
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Revenue Projector</h1>
          <p className="text-sm text-[#64748b]">12-month forecast based on growth and churn assumptions</p>
        </div>

        {/* Scenario Toggle */}
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4 mb-6">
          <h3 className="text-xs uppercase tracking-wider text-[#64748b] font-semibold mb-3">Scenario</h3>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(SCENARIOS) as Scenario[]).map((key) => {
              const s = SCENARIOS[key];
              const active = scenario === key;
              return (
                <button
                  key={key}
                  onClick={() => applyScenario(key)}
                  className={`px-3 py-3 rounded-lg text-left transition-all ${
                    active
                      ? "bg-[#6366f1]/10 border border-[#6366f1]/50 text-[#6366f1]"
                      : "bg-[#0a0a0f] border border-[#1e1e2e] text-[#64748b] hover:text-white hover:border-[#6366f1]/30"
                  }`}
                >
                  <div className="text-sm font-semibold">{s.label}</div>
                  <div className="text-[10px] opacity-80 mt-0.5">{s.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Inputs */}
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5 mb-6">
          <h3 className="text-xs uppercase tracking-wider text-[#64748b] font-semibold mb-4">Assumptions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Current MRR */}
            <div>
              <label className="block text-xs text-[#64748b] mb-1.5">Current MRR ($)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={currentMrr}
                  onChange={(e) => setCurrentMrr(Math.max(0, parseInt(e.target.value) || 0))}
                  className="flex-1 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#6366f1]"
                />
                <button
                  onClick={saveCurrentMrr}
                  disabled={savingMrr}
                  className="px-3 py-2 bg-[#6366f1]/10 border border-[#6366f1]/30 text-[#6366f1] rounded-lg text-xs font-medium hover:bg-[#6366f1]/20 transition-colors disabled:opacity-50"
                >
                  {savingMrr ? "..." : "Save"}
                </button>
              </div>
              <p className="text-[10px] text-[#64748b] mt-1">≈ {currentClients} clients at ${arpu}/mo</p>
            </div>

            {/* ARPU */}
            <div>
              <label className="block text-xs text-[#64748b] mb-1.5">Average Revenue Per User ($/mo)</label>
              <input
                type="number"
                value={arpu}
                onChange={(e) => setArpu(Math.max(1, parseInt(e.target.value) || 97))}
                className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#6366f1]"
              />
            </div>

            {/* Growth slider */}
            <div>
              <div className="flex justify-between text-xs text-[#64748b] mb-1.5">
                <span>New clients per month</span>
                <span className="text-[#6366f1] font-semibold">{growthRate}</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={growthRate}
                onChange={(e) => setGrowthRate(parseInt(e.target.value))}
                className="w-full accent-[#6366f1] tap-target-auto"
              />
              <div className="flex justify-between text-[10px] text-[#64748b] mt-1">
                <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
              </div>
            </div>

            {/* Churn slider */}
            <div>
              <div className="flex justify-between text-xs text-[#64748b] mb-1.5">
                <span>Monthly churn rate</span>
                <span className="text-[#6366f1] font-semibold">{churnPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={churnPct}
                onChange={(e) => setChurnPct(parseInt(e.target.value))}
                className="w-full accent-[#6366f1] tap-target-auto"
              />
              <div className="flex justify-between text-[10px] text-[#64748b] mt-1">
                <span>0%</span><span>5%</span><span>10%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Forecast Summary KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4">
            <div className="text-xs text-[#64748b] mb-1">MRR in 12 mo</div>
            <div className="text-2xl font-bold text-white">${finalMrr.toLocaleString()}</div>
          </div>
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4">
            <div className="text-xs text-[#64748b] mb-1">ARR projected</div>
            <div className="text-2xl font-bold text-[#a855f7]">${finalArr.toLocaleString()}</div>
          </div>
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4">
            <div className="text-xs text-[#64748b] mb-1">Total clients</div>
            <div className="text-2xl font-bold text-white">{finalClients}</div>
          </div>
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4">
            <div className="text-xs text-[#64748b] mb-1">12-mo revenue</div>
            <div className="text-2xl font-bold text-[#22c55e]">${totalRevenue.toLocaleString()}</div>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5 mb-6">
          <h3 className="text-xs uppercase tracking-wider text-[#64748b] font-semibold mb-4">Monthly MRR Forecast</h3>
          <BarChart months={months} />
        </div>

        {/* Milestones */}
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5 mb-6">
          <h3 className="text-xs uppercase tracking-wider text-[#64748b] font-semibold mb-4">Milestones</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MILESTONES.map((m) => {
              const hitMonth = months.find((mo) => mo.mrr >= m.mrr);
              return (
                <div
                  key={m.mrr}
                  className="flex items-center gap-3 p-3 rounded-lg border"
                  style={{
                    borderColor: hitMonth ? `${m.color}50` : "#1e1e2e",
                    backgroundColor: hitMonth ? `${m.color}10` : "transparent",
                  }}
                >
                  <div className="text-2xl tap-target-auto">{m.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: hitMonth ? m.color : "#94a3b8" }}>
                      ${m.mrr.toLocaleString()}/mo · {m.label}
                    </div>
                    <div className="text-xs text-[#64748b] mt-0.5">
                      {hitMonth ? `Hit in ${hitMonth.label} (month ${hitMonth.month})` : "Not reached in 12 months"}
                    </div>
                  </div>
                  {hitMonth && <span className="text-xs font-bold text-[#22c55e] tap-target-auto">✓</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Table */}
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5 mb-6">
          <h3 className="text-xs uppercase tracking-wider text-[#64748b] font-semibold mb-4">Month-by-Month Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[#64748b] border-b border-[#1e1e2e]">
                  <th className="text-left py-2 font-semibold tap-target-auto">Month</th>
                  <th className="text-right py-2 font-semibold tap-target-auto">Clients</th>
                  <th className="text-right py-2 font-semibold tap-target-auto">MRR</th>
                  <th className="text-right py-2 font-semibold tap-target-auto">Cumulative</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m, i) => (
                  <tr
                    key={i}
                    className={`border-b border-[#1e1e2e]/50 ${m.hitMilestones.length > 0 ? "bg-[#6366f1]/5" : ""}`}
                  >
                    <td className="py-2 text-[#e2e8f0] tap-target-auto">
                      {m.label}
                      {m.hitMilestones.map((ms) => (
                        <span key={ms.mrr} className="ml-1.5 text-[10px]" style={{ color: ms.color }}>
                          {ms.emoji}
                        </span>
                      ))}
                    </td>
                    <td className="py-2 text-right text-[#94a3b8] tap-target-auto">{m.clients}</td>
                    <td className="py-2 text-right text-white font-semibold tap-target-auto">${m.mrr.toLocaleString()}</td>
                    <td className="py-2 text-right text-[#22c55e] tap-target-auto">${m.cumulative.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Existing live tracker (Lindy clients etc) */}
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5">
          <h3 className="text-xs uppercase tracking-wider text-[#64748b] font-semibold mb-4">Live Revenue Tracker</h3>
          <RevenueTab />
        </div>
      </div>
    </div>
  );
}
