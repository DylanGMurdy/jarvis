"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Memory, MemoryCategory } from "@/lib/types";

const CATEGORIES: { key: MemoryCategory; label: string; color: string; icon: string }[] = [
  { key: "personal", label: "Personal", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: "👤" },
  { key: "business", label: "Business", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: "💼" },
  { key: "health", label: "Health", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: "❤️" },
  { key: "goals", label: "Goals", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: "🎯" },
  { key: "relationships", label: "Relationships", color: "bg-pink-500/20 text-pink-400 border-pink-500/30", icon: "🤝" },
  { key: "preferences", label: "Preferences", color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: "⚙️" },
  { key: "ideas", label: "Ideas", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30", icon: "💡" },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

export default function MemoryPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [newFact, setNewFact] = useState("");
  const [newCategory, setNewCategory] = useState<MemoryCategory>("business");
  const [adding, setAdding] = useState(false);

  const fetchMemories = useCallback(async () => {
    try {
      const res = await fetch("/api/memories");
      const data = await res.json();
      setMemories(data.memories || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchMemories(); }, [fetchMemories]);

  async function handleAdd() {
    if (!newFact.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fact: newFact.trim(), category: newCategory, source: "manual", confidence: 1.0 }),
      });
      const data = await res.json();
      if (data.memory) setMemories((prev) => [data.memory, ...prev]);
      setNewFact("");
      setShowAdd(false);
    } catch { /* silent */ }
    setAdding(false);
  }

  async function handleDelete(id: string) {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    try {
      await fetch("/api/memories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      fetchMemories(); // Revert on failure
    }
  }

  // Filter and search
  const filtered = memories.filter((m) => {
    if (filter !== "all" && m.category !== filter) return false;
    if (search && !m.fact.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Stats
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const thisWeek = memories.filter((m) => new Date(m.created_at) >= weekAgo).length;
  const categoryCounts = memories.reduce<Record<string, number>>((acc, m) => {
    acc[m.category] = (acc[m.category] || 0) + 1;
    return acc;
  }, {});
  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];

  if (loading) {
    return <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center"><div className="text-[#64748b]">Loading memories...</div></div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e2e8f0]">
      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-[#64748b] hover:text-[#e2e8f0] transition-colors text-sm mb-6">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Back to Dashboard
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Memory Manager</h1>
            <p className="text-sm text-[#64748b] mt-1">Everything JARVIS remembers about you and your business</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-[#6366f1] text-white rounded-lg text-sm font-medium hover:bg-[#5558e6] transition-colors">
            + Add Memory
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4">
            <div className="text-xs text-[#64748b] font-semibold uppercase mb-1">Total Memories</div>
            <div className="text-2xl font-bold text-white">{memories.length}</div>
          </div>
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4">
            <div className="text-xs text-[#64748b] font-semibold uppercase mb-1">Added This Week</div>
            <div className="text-2xl font-bold text-[#22c55e]">{thisWeek}</div>
          </div>
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4">
            <div className="text-xs text-[#64748b] font-semibold uppercase mb-1">Top Category</div>
            <div className="text-2xl font-bold text-white flex items-center gap-2">
              {topCategory ? (
                <>
                  <span>{CAT_MAP[topCategory[0]]?.icon || "📌"}</span>
                  <span>{CAT_MAP[topCategory[0]]?.label || topCategory[0]}</span>
                  <span className="text-sm text-[#64748b] font-normal">({topCategory[1]})</span>
                </>
              ) : "—"}
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search memories..."
              className="w-full bg-[#12121a] border border-[#1e1e2e] rounded-lg pl-10 pr-4 py-2.5 text-sm text-[#e2e8f0] placeholder-[#64748b] focus:outline-none focus:border-[#6366f1]"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            <button onClick={() => setFilter("all")} className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${filter === "all" ? "bg-[#6366f1] text-white" : "bg-[#12121a] border border-[#1e1e2e] text-[#64748b] hover:text-[#e2e8f0]"}`}>
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button key={cat.key} onClick={() => setFilter(cat.key)} className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${filter === cat.key ? "bg-[#6366f1] text-white" : "bg-[#12121a] border border-[#1e1e2e] text-[#64748b] hover:text-[#e2e8f0]"}`}>
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Memory List */}
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-3xl mb-3">🧠</div>
            <p className="text-sm text-[#64748b]">{search ? `No memories matching "${search}"` : "No memories yet"}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((m) => {
              const cat = CAT_MAP[m.category];
              return (
                <div key={m.id} className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4 group hover:border-[#6366f1]/20 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#e2e8f0] leading-relaxed">{m.fact}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${cat?.color || "bg-[#1e1e2e] text-[#64748b] border-[#1e1e2e]"}`}>
                          {cat?.icon} {cat?.label || m.category}
                        </span>
                        <span className="text-[10px] text-[#64748b]">
                          {new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        {m.source && m.source !== "manual" && (
                          <span className="text-[10px] text-[#64748b]">via {m.source}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-[#64748b]/40 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1 shrink-0"
                      title="Delete memory"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 text-xs text-[#64748b] text-center">
          Showing {filtered.length} of {memories.length} memories
        </div>
      </div>

      {/* Add Memory Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div onClick={(e) => e.stopPropagation()} className="relative bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Add Memory</h2>
              <button onClick={() => setShowAdd(false)} className="text-[#64748b] hover:text-white text-xl p-1">&times;</button>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-[#64748b] mb-1">What should JARVIS remember?</label>
              <textarea
                value={newFact}
                onChange={(e) => setNewFact(e.target.value)}
                placeholder="e.g. Dylan prefers morning standups at 7am..."
                rows={3}
                className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg p-3 text-sm text-[#e2e8f0] placeholder-[#64748b] resize-none focus:outline-none focus:border-[#6366f1]"
                autoFocus
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs text-[#64748b] mb-1">Category</label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => setNewCategory(cat.key)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${newCategory === cat.key ? "bg-[#6366f1] text-white" : "bg-[#1e1e2e] text-[#64748b] hover:text-[#e2e8f0]"}`}
                  >
                    {cat.icon} {cat.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!newFact.trim() || adding}
                className="flex-1 px-4 py-2.5 bg-[#6366f1] text-white rounded-lg text-sm font-medium hover:bg-[#5558e6] disabled:opacity-50 transition-colors"
              >
                {adding ? "Saving..." : "Save Memory"}
              </button>
              <button onClick={() => setShowAdd(false)} className="px-4 py-2.5 bg-[#1e1e2e] text-[#e2e8f0] rounded-lg text-sm hover:bg-[#6366f1]/20 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
