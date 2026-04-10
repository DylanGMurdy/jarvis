"use client";

import { useState } from "react";
import type { Memory, MemoryCategory } from "@/lib/types";

const MEMORY_CATEGORIES: { key: MemoryCategory; label: string; color: string; icon: string }[] = [
  { key: "personal", label: "Personal", color: "bg-blue-500/20 text-blue-400", icon: "👤" },
  { key: "business", label: "Business", color: "bg-green-500/20 text-green-400", icon: "💼" },
  { key: "health", label: "Health", color: "bg-red-500/20 text-red-400", icon: "❤️" },
  { key: "goals", label: "Goals", color: "bg-yellow-500/20 text-yellow-400", icon: "🎯" },
  { key: "relationships", label: "Relationships", color: "bg-pink-500/20 text-pink-400", icon: "🤝" },
  { key: "preferences", label: "Preferences", color: "bg-purple-500/20 text-purple-400", icon: "⚙️" },
  { key: "ideas", label: "Ideas", color: "bg-cyan-500/20 text-cyan-400", icon: "💡" },
];

interface MemoryTabProps {
  memories: Memory[];
  onDeleteMemory: (id: string) => void;
  onExtractMemories: () => void;
  memoryLoading: boolean;
  chatMessageCount: number;
  onAddMemory: () => void;
}

export default function MemoryTab({ memories, onDeleteMemory, onExtractMemories, memoryLoading, chatMessageCount, onAddMemory }: MemoryTabProps) {
  const [memoryFilter, setMemoryFilter] = useState<string>("all");

  const filteredMemories = memoryFilter === "all" ? memories : memories.filter((m) => m.category === memoryFilter);
  const memoryCounts = memories.reduce<Record<string, number>>((acc, m) => {
    acc[m.category] = (acc[m.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4 animate-[slideUp_0.3s_ease-out]">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold">JARVIS Memory Bank</h2>
          <p className="text-xs text-jarvis-muted">{memories.length} memories stored across {Object.keys(memoryCounts).length} categories</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onAddMemory}
            className="px-3 py-1.5 bg-jarvis-accent text-white rounded-lg text-sm hover:bg-jarvis-accent-hover transition-colors"
          >
            + Add Memory
          </button>
          <button
            onClick={onExtractMemories}
            disabled={memoryLoading || chatMessageCount < 2}
            className="px-3 py-1.5 bg-jarvis-border text-jarvis-text rounded-lg text-sm hover:bg-jarvis-accent/20 transition-colors disabled:opacity-50"
          >
            {memoryLoading ? "Extracting..." : "Extract from Chat"}
          </button>
        </div>
      </div>

      {/* Category Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {MEMORY_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setMemoryFilter(memoryFilter === cat.key ? "all" : cat.key)}
            className={`p-3 rounded-xl border transition-all text-left ${
              memoryFilter === cat.key
                ? "bg-jarvis-accent/20 border-jarvis-accent/50"
                : "bg-jarvis-card border-jarvis-border hover:border-jarvis-accent/30"
            }`}
          >
            <div className="text-lg mb-1">{cat.icon}</div>
            <div className="text-xs font-semibold text-jarvis-text">{cat.label}</div>
            <div className="text-lg font-bold text-white">{memoryCounts[cat.key] || 0}</div>
          </button>
        ))}
      </div>

      {/* Memory List */}
      <div className="space-y-2">
        {filteredMemories.length === 0 && (
          <div className="text-center py-12 text-jarvis-muted">
            <div className="text-4xl mb-3">🧠</div>
            <p className="text-sm">{memories.length === 0 ? "No memories yet. Start chatting with JARVIS or add memories manually." : "No memories in this category."}</p>
          </div>
        )}
        {filteredMemories.map((mem) => {
          const catInfo = MEMORY_CATEGORIES.find((c) => c.key === mem.category);
          return (
            <div key={mem.id} className="bg-jarvis-card border border-jarvis-border rounded-xl p-4 hover:border-jarvis-accent/30 transition-all group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded ${catInfo?.color || "bg-jarvis-border text-jarvis-muted"}`}>
                      {catInfo?.icon} {catInfo?.label || mem.category}
                    </span>
                    <span className="text-xs text-jarvis-muted">
                      {new Date(mem.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      mem.source === "manual" ? "bg-jarvis-accent/20 text-jarvis-accent" :
                      mem.source === "chat_extraction" ? "bg-jarvis-green/20 text-jarvis-green" :
                      "bg-jarvis-border text-jarvis-muted"
                    }`}>
                      {mem.source === "manual" ? "manual" : mem.source === "chat_extraction" ? "auto" : mem.source}
                    </span>
                  </div>
                  <p className="text-sm text-jarvis-text">{mem.fact}</p>
                </div>
                <button
                  onClick={() => onDeleteMemory(mem.id)}
                  className="text-jarvis-muted hover:text-jarvis-red transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 p-1"
                  title="Delete memory"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
