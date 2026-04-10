"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import type { Goal } from "@/lib/types";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip);

export default function GoalCharts({ goals }: { goals: Goal[] }) {
  if (goals.length === 0) return null;

  return (
    <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4">
      <h3 className="text-sm font-semibold text-[#64748b] mb-4">Goal Progress Overview</h3>
      <div className="h-64">
        <Bar
          data={{
            labels: goals.map((g) => g.title.split(" ").slice(0, 3).join(" ")),
            datasets: [{
              label: "Progress %",
              data: goals.map((g) => g.progress),
              backgroundColor: ["#6366f1", "#818cf8", "#6366f1", "#818cf8"],
              borderRadius: 6,
            }],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { max: 100, grid: { color: "#1e1e2e" }, ticks: { color: "#64748b" } },
              x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 11 } } },
            },
          }}
        />
      </div>
    </div>
  );
}
