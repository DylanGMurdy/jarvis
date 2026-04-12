"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

interface Project {
  id: string;
  title: string;
  description: string;
  category: string;
  status: "Idea" | "Planning" | "Building" | "Launched" | "Revenue";
  grade: "A" | "B" | "C";
  progress: number;
  revenue_goal: string;
  war_room_completed_at?: string | null;
  created_at: string;
}

type SortOption = "newest" | "oldest" | "grade" | "progress";

const STATUS_FILTERS = ["All", "Idea", "Planning", "Building", "Launched"] as const;
const GRADE_FILTERS = ["All", "A", "B", "C"] as const;

const GRADE_COLORS: Record<string, string> = {
  A: "bg-green-500/20 text-green-400 border-green-500/30",
  B: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  C: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  Idea: "bg-[#64748b]/20 text-[#64748b]",
  Planning: "bg-yellow-500/20 text-yellow-400",
  Building: "bg-[#6366f1]/20 text-[#6366f1]",
  Launched: "bg-green-500/20 text-green-400",
  Revenue: "bg-cyan-500/20 text-cyan-400",
};

export default function IdeasPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Filter & sort state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [gradeFilter, setGradeFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects");
      if (response.ok) {
        const json = await response.json();
        setProjects(json.data || json || []);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let result = [...projects];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) => p.title.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== "All") {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Grade filter
    if (gradeFilter !== "All") {
      result = result.filter((p) => p.grade === gradeFilter);
    }

    // Sort
    switch (sortBy) {
      case "newest":
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "oldest":
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "grade":
        result.sort((a, b) => (a.grade || "C").localeCompare(b.grade || "C"));
        break;
      case "progress":
        result.sort((a, b) => (b.progress || 0) - (a.progress || 0));
        break;
    }

    return result;
  }, [projects, search, statusFilter, gradeFilter, sortBy]);

  const handleCreateProject = async () => {
    if (!newTitle.trim()) return;
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, description: newDescription }),
      });
      if (response.ok) {
        const newProject = await response.json();
        setProjects([newProject.data || newProject, ...projects]);
        setShowModal(false);
        setNewTitle("");
        setNewDescription("");
      }
    } catch (error) {
      console.error("Error creating project:", error);
    }
  };

  const handleDeleteProject = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      const response = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (response.ok) setProjects(projects.filter((p) => p.id !== id));
    } catch (error) {
      console.error("Error deleting project:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] px-6 py-8">
        <div className="max-w-6xl mx-auto animate-pulse">
          <div className="h-8 bg-[#1e1e2e] rounded w-48 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-[#1e1e2e] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-6 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Ideas Lab</h1>
            <p className="text-sm text-[#64748b] mt-1">
              {filtered.length} idea{filtered.length !== 1 ? "s" : ""}
              {(search || statusFilter !== "All" || gradeFilter !== "All") && ` (of ${projects.length} total)`}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-[#6366f1] text-white rounded-lg text-sm font-medium hover:bg-[#5558e6] transition-colors"
          >
            + New Project
          </button>
        </div>

        {/* Search + Filters Bar */}
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4 mb-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"
              className="absolute left-3 top-1/2 -translate-y-1/2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or description..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg text-sm text-[#e2e8f0] placeholder-[#64748b] focus:outline-none focus:border-[#6366f1] transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-white text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Status filters */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider mr-1">Status</span>
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    statusFilter === s
                      ? "bg-[#6366f1] text-white"
                      : "bg-[#0a0a0f] text-[#64748b] hover:text-[#e2e8f0] border border-[#1e1e2e]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Grade filters */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider mr-1">Grade</span>
              {GRADE_FILTERS.map((g) => (
                <button
                  key={g}
                  onClick={() => setGradeFilter(g)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    gradeFilter === g
                      ? "bg-[#6366f1] text-white"
                      : "bg-[#0a0a0f] text-[#64748b] hover:text-[#e2e8f0] border border-[#1e1e2e]"
                  }`}
                >
                  {g === "All" ? "All" : `Grade ${g}`}
                </button>
              ))}
            </div>

            {/* Sort dropdown */}
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider mr-1">Sort</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-md px-2.5 py-1 text-xs text-[#e2e8f0] focus:border-[#6366f1] outline-none"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="grade">Grade (A first)</option>
                <option value="progress">Progress (highest)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Project Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[#64748b] text-sm">
              {projects.length === 0 ? "No projects yet. Create your first project to get started!" : "No projects match your filters."}
            </p>
            {projects.length > 0 && (
              <button
                onClick={() => { setSearch(""); setStatusFilter("All"); setGradeFilter("All"); }}
                className="mt-3 text-xs text-[#6366f1] hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((project) => (
              <Link
                key={project.id}
                href={`/ideas/${project.id}`}
                className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5 hover:border-[#6366f1]/50 transition-all group relative"
              >
                {/* Top: Title + Grade */}
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-white group-hover:text-[#6366f1] transition-colors text-sm leading-tight flex-1 min-w-0 mr-2">
                    {project.title}
                  </h3>
                  {project.grade && (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex-shrink-0 ${GRADE_COLORS[project.grade] || ""}`}>
                      {project.grade}
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-[#64748b] line-clamp-2 mb-3">{project.description}</p>

                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  {project.status && (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${STATUS_COLORS[project.status] || ""}`}>
                      {project.status}
                    </span>
                  )}
                  {project.war_room_completed_at && project.status !== "Building" && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
                      War Room
                    </span>
                  )}
                  {project.status === "Building" && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      In Build
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                {project.progress != null && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-[#64748b]">Progress</span>
                      <span className="text-[10px] text-[#6366f1]">{project.progress}%</span>
                    </div>
                    <div className="w-full bg-[#1e1e2e] rounded-full h-1">
                      <div className="bg-[#6366f1] rounded-full h-1 transition-all" style={{ width: `${project.progress}%` }} />
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-[#1e1e2e]">
                  <span className="text-[10px] text-[#64748b]">{project.revenue_goal || "No revenue goal"}</span>
                  <span className="text-[10px] text-[#6366f1] group-hover:translate-x-1 transition-transform">Open &rarr;</span>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteProject(project.id, project.title); }}
                  className="absolute top-3 right-3 p-1.5 text-[#64748b] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete project"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
              </Link>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-lg font-bold text-white mb-4">Create New Project</h2>
              <div className="mb-4">
                <label className="block text-xs font-medium text-[#64748b] mb-1">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg text-sm text-[#e2e8f0] placeholder-[#64748b] focus:outline-none focus:border-[#6366f1]"
                  placeholder="Enter project title"
                  autoFocus
                />
              </div>
              <div className="mb-6">
                <label className="block text-xs font-medium text-[#64748b] mb-1">Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg text-sm text-[#e2e8f0] placeholder-[#64748b] focus:outline-none focus:border-[#6366f1]"
                  placeholder="Enter project description"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowModal(false); setNewTitle(""); setNewDescription(""); }}
                  className="px-4 py-2 text-sm text-[#64748b] border border-[#1e1e2e] rounded-lg hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!newTitle.trim()}
                  className="px-4 py-2 bg-[#6366f1] text-white rounded-lg text-sm font-medium hover:bg-[#5558e6] disabled:opacity-50 transition-colors"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
