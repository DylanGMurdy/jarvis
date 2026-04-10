"use client";

import Link from "next/link";
import type { Goal } from "@/lib/types";
import dynamic from "next/dynamic";

const GoalCharts = dynamic(() => import("@/components/GoalCharts"), { ssr: false });

interface GoalsTabProps {
  goals: Goal[];
}

export default function GoalsTab({ goals }: GoalsTabProps) {
  return (
    <div className="space-y-6 animate-[slideUp_0.3s_ease-out]">
      <h2 className="text-lg font-bold">90-Day Goal Tracker</h2>

      {/* Goal Cards */}
      <div className="space-y-3">
        {goals.map((g) => (
          <Link key={g.id} href={`/goals/${g.id}`} className="block bg-jarvis-card border border-jarvis-border rounded-xl p-4 hover:border-jarvis-accent/50 transition-all cursor-pointer group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white group-hover:text-jarvis-accent transition-colors">{g.title}</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-jarvis-border text-jarvis-muted">{g.category}</span>
              </div>
              <span className="text-sm font-bold text-jarvis-accent">{g.progress}%</span>
            </div>
            <div className="w-full bg-jarvis-border rounded-full h-2 mb-2">
              <div className="bg-jarvis-accent rounded-full h-2 transition-all" style={{ width: `${g.progress}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-jarvis-muted">{g.target}</p>
              <span className="text-xs text-jarvis-accent group-hover:translate-x-1 transition-transform">Open &rarr;</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Bar Chart — lazy loaded */}
      <GoalCharts goals={goals} />
    </div>
  );
}
