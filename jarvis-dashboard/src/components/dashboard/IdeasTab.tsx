"use client";

import { useState } from "react";
import Link from "next/link";
import type { Project } from "@/lib/types";

type ModalData = { title: string; body: string; actions?: { label: string; onClick: () => void }[] } | null;

const GradeTag = ({ grade }: { grade: "A" | "B" | "C" }) => {
  const colors = { A: "bg-jarvis-green/20 text-jarvis-green", B: "bg-jarvis-yellow/20 text-jarvis-yellow", C: "bg-jarvis-orange/20 text-jarvis-orange" };
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${colors[grade]}`}>Grade {grade}</span>;
};

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    Idea: "bg-jarvis-muted/20 text-jarvis-muted",
    Planning: "bg-jarvis-yellow/20 text-jarvis-yellow",
    Building: "bg-jarvis-accent/20 text-jarvis-accent",
    Launched: "bg-jarvis-green/20 text-jarvis-green",
    Revenue: "bg-jarvis-cyan/20 text-jarvis-cyan",
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${colors[status] || "bg-jarvis-border text-jarvis-muted"}`}>{status}</span>;
};

const CategoryBadge = ({ category }: { category: string }) => {
  const colors: Record<string, string> = {
    "AI Business": "bg-purple-500/20 text-purple-400",
    "Real Estate": "bg-blue-500/20 text-blue-400",
    "Side Hustles": "bg-orange-500/20 text-orange-400",
    Personal: "bg-green-500/20 text-green-400",
  };
  return <span className={`px-2 py-0.5 rounded text-xs ${colors[category] || "bg-jarvis-border text-jarvis-muted"}`}>{category}</span>;
};

interface IdeasTabProps {
  projects: Project[];
  openModal: (data: ModalData) => void;
  closeModal: () => void;
}

export default function IdeasTab({ projects, openModal, closeModal }: IdeasTabProps) {
  const [ideaFilter, setIdeaFilter] = useState<string>("All");
  const filteredProjects = ideaFilter === "All" ? projects : projects.filter((p) => p.category === ideaFilter);

  return (
    <div className="space-y-4 animate-[slideUp_0.3s_ease-out]">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Ideas Lab</h2>
        <button onClick={() => openModal({ title: "Add New Project", body: "Coming soon \u2014 new project creation form.", actions: [{ label: "Close", onClick: closeModal }] })} className="px-3 py-1.5 bg-jarvis-accent text-white rounded-lg text-sm hover:bg-jarvis-accent-hover transition-colors">
          + New Project
        </button>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {["All", "AI Business", "Real Estate", "Side Hustles", "Personal"].map((cat) => (
          <button key={cat} onClick={() => setIdeaFilter(cat)} className={`px-3 py-1.5 rounded-lg text-sm transition-all ${ideaFilter === cat ? "bg-jarvis-accent text-white" : "bg-jarvis-border text-jarvis-muted hover:text-jarvis-text"}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Project Cards */}
      <div className="space-y-3">
        {filteredProjects.map((project) => (
          <Link key={project.id} href={`/ideas/${project.id}`} className="block bg-jarvis-card border border-jarvis-border rounded-xl p-4 hover:border-jarvis-accent/50 transition-all cursor-pointer group">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-white group-hover:text-jarvis-accent transition-colors">{project.title}</h3>
                  <GradeTag grade={project.grade} />
                </div>
                <p className="text-xs text-jarvis-muted line-clamp-1">{project.description}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-4 flex-wrap justify-end">
                {project.war_room_completed_at && project.status !== "Building" && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-jarvis-green/20 text-jarvis-green border border-jarvis-green/30">War Room Complete</span>
                )}
                {project.status === "Building" && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">In Build</span>
                )}
                <CategoryBadge category={project.category} />
                <StatusBadge status={project.status} />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-jarvis-muted">Progress</span>
                <span className="text-xs text-jarvis-accent">{project.progress}%</span>
              </div>
              <div className="w-full bg-jarvis-border rounded-full h-1.5">
                <div className="bg-jarvis-accent rounded-full h-1.5 transition-all" style={{ width: `${project.progress}%` }} />
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-jarvis-border">
              <span className="text-xs text-jarvis-muted">Revenue: {project.revenue_goal}</span>
              <span className="text-xs text-jarvis-accent group-hover:translate-x-1 transition-transform">Open &rarr;</span>
            </div>
          </Link>
        ))}
        {filteredProjects.length === 0 && (
          <div className="text-center py-8 text-jarvis-muted text-sm">No projects in this category yet.</div>
        )}
      </div>
    </div>
  );
}
