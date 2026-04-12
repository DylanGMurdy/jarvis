"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

// Static agent list for client-side matching
const AGENT_NAMES = [
  { name: "JARVIS", title: "Master Orchestrator" },
  { name: "CMO", title: "Chief Marketing Officer" },
  { name: "CFO", title: "Chief Financial Officer" },
  { name: "CTO", title: "Chief Technology Officer" },
  { name: "COO", title: "Chief Operating Officer" },
  { name: "CLO", title: "Chief Legal Officer" },
  { name: "CHRO", title: "Chief HR Officer" },
  { name: "CSO", title: "Chief Sales Officer" },
  { name: "VP Sales", title: "VP of Sales" },
  { name: "VP Product", title: "VP of Product" },
  { name: "VP Engineering", title: "VP of Engineering" },
  { name: "VP Marketing", title: "VP of Marketing" },
  { name: "VP Finance", title: "VP of Finance" },
  { name: "VP Operations", title: "VP of Operations" },
  { name: "Head of Growth", title: "Head of Growth" },
  { name: "Head of Content", title: "Head of Content" },
  { name: "Head of Design", title: "Head of Design" },
  { name: "Head of CX", title: "Head of CX" },
  { name: "Head of PR", title: "Head of PR" },
  { name: "Data Analytics", title: "Data Analytics" },
  { name: "SDR", title: "Sales Dev Rep" },
  { name: "Partnerships", title: "Partnerships" },
  { name: "Customer Success", title: "Customer Success" },
];

const TYPE_ICONS: Record<string, string> = {
  project: "💡",
  note: "📝",
  agent: "🤖",
  memory: "🧠",
};

const TYPE_LABELS: Record<string, string> = {
  project: "Projects",
  note: "Notes",
  agent: "Agents",
  memory: "Memories",
};

interface CommandPaletteProps {
  externalOpen?: boolean;
  onClose?: () => void;
  onNavigateTab?: (tab: string) => void;
  onNavigateMemory?: () => void;
}

export default function CommandPalette({ externalOpen, onClose, onNavigateTab, onNavigateMemory }: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen || internalOpen;
  const setOpen = (v: boolean) => { setInternalOpen(v); if (!v && onClose) onClose(); };
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const router = useRouter();

  // Cmd+K shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setInternalOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
    }
  }, [open]);

  // Search with debounce
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);

    // Match agents client-side
    const lower = q.toLowerCase();
    const agentMatches: SearchResult[] = AGENT_NAMES
      .filter((a) => a.name.toLowerCase().includes(lower) || a.title.toLowerCase().includes(lower))
      .slice(0, 5)
      .map((a) => ({
        type: "agent",
        id: a.name,
        title: a.name,
        subtitle: a.title,
        href: "#agents",
      }));

    // Search API for projects, notes, memories
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults([...agentMatches, ...(data.results || [])]);
    } catch {
      setResults(agentMatches);
    }
    setLoading(false);
    setSelectedIdx(0);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  function handleSelect(result: SearchResult) {
    setOpen(false);
    if (result.href === "#agents" && onNavigateTab) {
      onNavigateTab("agents");
    } else if (result.href === "#memory" && onNavigateMemory) {
      onNavigateMemory();
    } else if (result.href.startsWith("/")) {
      router.push(result.href);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIdx]) {
      e.preventDefault();
      handleSelect(results[selectedIdx]);
    }
  }

  // Group results by type
  const grouped: Record<string, SearchResult[]> = {};
  for (const r of results) {
    if (!grouped[r.type]) grouped[r.type] = [];
    grouped[r.type].push(r);
  }
  const groupOrder = ["project", "agent", "note", "memory"];
  let flatIdx = 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]" onClick={() => setOpen(false)}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Palette */}
      <div className="relative flex justify-center pt-[15vh] px-4" onClick={(e) => e.stopPropagation()}>
        <div className="w-full max-w-lg bg-jarvis-card border border-jarvis-border rounded-2xl shadow-2xl overflow-hidden animate-[slideUp_0.15s_ease-out]">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-jarvis-border">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search projects, agents, notes, memories..."
              className="flex-1 bg-transparent text-sm text-jarvis-text placeholder:text-jarvis-muted outline-none"
              autoComplete="off"
            />
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-jarvis-border text-[10px] text-jarvis-muted font-mono tap-target-auto">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[50vh] overflow-y-auto">
            {query.length < 2 && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-jarvis-muted">Type to search across Jarvis</p>
                <p className="text-xs text-jarvis-muted/60 mt-1">Projects, agents, notes, and memories</p>
              </div>
            )}

            {query.length >= 2 && loading && (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-jarvis-muted animate-pulse">Searching...</p>
              </div>
            )}

            {query.length >= 2 && !loading && results.length === 0 && (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-jarvis-muted">No results for &ldquo;{query}&rdquo;</p>
              </div>
            )}

            {groupOrder.map((type) => {
              const items = grouped[type];
              if (!items || items.length === 0) return null;
              return (
                <div key={type}>
                  <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-jarvis-muted bg-jarvis-bg/50 tap-target-auto">
                    {TYPE_ICONS[type]} {TYPE_LABELS[type]}
                  </div>
                  {items.map((r) => {
                    const idx = flatIdx++;
                    return (
                      <button
                        key={`${r.type}-${r.id}`}
                        onClick={() => handleSelect(r)}
                        onMouseEnter={() => setSelectedIdx(idx)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          selectedIdx === idx ? "bg-jarvis-accent/10 text-jarvis-accent" : "text-jarvis-text hover:bg-jarvis-border/50"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{r.title}</div>
                          <div className="text-xs text-jarvis-muted truncate">{r.subtitle}</div>
                        </div>
                        {r.href.startsWith("/") && (
                          <span className="text-[10px] text-jarvis-muted flex-shrink-0 tap-target-auto">Open &rarr;</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          {results.length > 0 && (
            <div className="px-4 py-2 border-t border-jarvis-border flex items-center gap-4 text-[10px] text-jarvis-muted">
              <span><kbd className="font-mono bg-jarvis-border px-1 rounded tap-target-auto">↑↓</kbd> navigate</span>
              <span><kbd className="font-mono bg-jarvis-border px-1 rounded tap-target-auto">↵</kbd> open</span>
              <span><kbd className="font-mono bg-jarvis-border px-1 rounded tap-target-auto">esc</kbd> close</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
