"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";

interface BrainNode {
  id: string;
  label: string;
  type: "personal" | "business" | "health" | "goals" | "relationships" | "preferences" | "ideas" | "core";
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  phase: number;
  freqX: number;
  freqY: number;
  baseX: number;
  baseY: number;
  isNew?: boolean;
  spawnTime?: number;
}

interface FiringEdge {
  from: number;
  to: number;
  startTime: number;
  duration: number;
  color: string;
}

export interface MemoryForBrain {
  id: string;
  fact: string;
  category: string;
  created_at: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  personal: "#3b82f6",
  business: "#22c55e",
  health: "#ef4444",
  goals: "#eab308",
  relationships: "#ec4899",
  preferences: "#a855f7",
  ideas: "#06b6d4",
  core: "#6366f1",
};

// Core nodes that always exist (the brain's foundation)
const CORE_NODES: { id: string; label: string; type: "core" }[] = [
  { id: "core-dylan", label: "Dylan", type: "core" },
  { id: "core-jarvis", label: "JARVIS", type: "core" },
  { id: "core-ai", label: "AI", type: "core" },
  { id: "core-re", label: "Real Estate", type: "core" },
];

interface JarvisBrainProps {
  memories?: MemoryForBrain[];
  onNodeClick?: (node: { id: string; type: string }) => void;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 255, g: 255, b: 255 };
}

function truncateLabel(text: string, maxLen: number = 18): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "\u2026";
}

export default function JarvisBrain({ memories = [], onNodeClick }: JarvisBrainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<BrainNode[]>([]);
  const edgesRef = useRef<[number, number][]>([]);
  const hoveredNodeRef = useRef<number>(-1);
  const firingsRef = useRef<FiringEdge[]>([]);
  const lastFireTimeRef = useRef<number>(0);
  const nextFireDelayRef = useRef<number>(2000);
  const animFrameRef = useRef<number>(0);
  const sizeRef = useRef<{ w: number; h: number }>({ w: 800, h: 400 });
  const dprRef = useRef<number>(1);
  const prevMemoryCountRef = useRef<number>(0);

  // Build nodes from memories + core nodes
  const nodeData = useMemo(() => {
    const nodes: { id: string; label: string; type: BrainNode["type"]; radius: number }[] = [];

    // Core nodes in center
    for (const core of CORE_NODES) {
      nodes.push({ ...core, radius: 26 });
    }

    // Category hub nodes
    const categories = new Set(memories.map((m) => m.category));
    for (const cat of categories) {
      nodes.push({
        id: `cat-${cat}`,
        label: cat.charAt(0).toUpperCase() + cat.slice(1),
        type: cat as BrainNode["type"],
        radius: 20,
      });
    }

    // Individual memory nodes (limit to 60 for performance)
    const recentMemories = memories.slice(0, 60);
    for (const mem of recentMemories) {
      nodes.push({
        id: `mem-${mem.id}`,
        label: truncateLabel(mem.fact),
        type: mem.category as BrainNode["type"],
        radius: 12 + Math.min(mem.fact.length / 20, 4),
      });
    }

    return nodes;
  }, [memories]);

  // Build edges
  const edgeData = useMemo(() => {
    const edges: [string, string][] = [];
    const nodeIds = new Set(nodeData.map((n) => n.id));

    // Connect core nodes to each other
    for (let i = 0; i < CORE_NODES.length; i++) {
      for (let j = i + 1; j < CORE_NODES.length; j++) {
        edges.push([CORE_NODES[i].id, CORE_NODES[j].id]);
      }
    }

    // Connect category hubs to core
    const categories = new Set(memories.map((m) => m.category));
    for (const cat of categories) {
      const catId = `cat-${cat}`;
      if (!nodeIds.has(catId)) continue;
      // Connect to most relevant core
      if (cat === "business" || cat === "ideas") {
        edges.push([catId, "core-ai"]);
        edges.push([catId, "core-re"]);
      } else if (cat === "relationships" || cat === "personal") {
        edges.push([catId, "core-dylan"]);
      } else if (cat === "goals") {
        edges.push([catId, "core-dylan"]);
        edges.push([catId, "core-ai"]);
      } else {
        edges.push([catId, "core-jarvis"]);
      }
    }

    // Connect memories to their category hub
    const recentMemories = memories.slice(0, 60);
    for (const mem of recentMemories) {
      const catId = `cat-${mem.category}`;
      const memId = `mem-${mem.id}`;
      if (nodeIds.has(catId) && nodeIds.has(memId)) {
        edges.push([memId, catId]);
      }
    }

    // Convert to index pairs
    const idxMap = new Map<string, number>();
    nodeData.forEach((n, i) => idxMap.set(n.id, i));

    return edges
      .filter(([a, b]) => idxMap.has(a) && idxMap.has(b))
      .map(([a, b]) => [idxMap.get(a)!, idxMap.get(b)!] as [number, number]);
  }, [nodeData, memories]);

  // Rebuild positioned nodes when nodeData changes
  useEffect(() => {
    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) return;

    const cx = w / 2;
    const cy = h / 2;
    const now = performance.now();
    const isGrowing = nodeData.length > prevMemoryCountRef.current;

    const existingMap = new Map<string, BrainNode>();
    for (const node of nodesRef.current) {
      existingMap.set(node.id, node);
    }

    const newNodes: BrainNode[] = [];
    const coreCount = CORE_NODES.length;
    const catNodes = nodeData.filter((n) => n.id.startsWith("cat-"));
    const memNodes = nodeData.filter((n) => n.id.startsWith("mem-"));

    for (let i = 0; i < nodeData.length; i++) {
      const nd = nodeData[i];
      const existing = existingMap.get(nd.id);

      if (existing) {
        // Keep existing position, update label/radius
        newNodes.push({ ...existing, label: nd.label, radius: nd.radius, type: nd.type });
        continue;
      }

      // Calculate new position based on type
      let x: number, y: number;
      if (nd.id.startsWith("core-")) {
        // Core nodes in tight center cluster
        const coreIdx = CORE_NODES.findIndex((c) => c.id === nd.id);
        const angle = (coreIdx / coreCount) * Math.PI * 2 - Math.PI / 2;
        const r = Math.min(w, h) * 0.08;
        x = cx + Math.cos(angle) * r;
        y = cy + Math.sin(angle) * r;
      } else if (nd.id.startsWith("cat-")) {
        // Category hubs in middle ring
        const catIdx = catNodes.findIndex((c) => c.id === nd.id);
        const angle = (catIdx / Math.max(catNodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
        const r = Math.min(w, h) * 0.22;
        x = cx + Math.cos(angle) * r + (Math.random() - 0.5) * 20;
        y = cy + Math.sin(angle) * r + (Math.random() - 0.5) * 20;
      } else {
        // Memory nodes in outer ring, clustered near their category
        const cat = nd.type;
        const catNode = newNodes.find((n) => n.id === `cat-${cat}`);
        if (catNode) {
          const memIdx = memNodes.filter((m) => m.type === cat).findIndex((m) => m.id === nd.id);
          const spreadAngle = ((memIdx || 0) / 8) * Math.PI * 0.8 - Math.PI * 0.4;
          const catAngle = Math.atan2(catNode.baseY - cy, catNode.baseX - cx);
          const angle = catAngle + spreadAngle * 0.5;
          const r = Math.min(w, h) * (0.3 + Math.random() * 0.1);
          x = cx + Math.cos(angle) * r;
          y = cy + Math.sin(angle) * r;
        } else {
          const angle = Math.random() * Math.PI * 2;
          const r = Math.min(w, h) * 0.35;
          x = cx + Math.cos(angle) * r;
          y = cy + Math.sin(angle) * r;
        }
      }

      // Clamp to canvas
      x = Math.max(30, Math.min(w - 30, x));
      y = Math.max(30, Math.min(h - 30, y));

      newNodes.push({
        ...nd,
        x,
        y,
        baseX: x,
        baseY: y,
        vx: 0,
        vy: 0,
        phase: Math.random() * Math.PI * 2,
        freqX: 0.0003 + Math.random() * 0.0004,
        freqY: 0.0004 + Math.random() * 0.0003,
        isNew: isGrowing,
        spawnTime: isGrowing ? now : undefined,
      });
    }

    nodesRef.current = newNodes;
    edgesRef.current = edgeData;
    prevMemoryCountRef.current = nodeData.length;
  }, [nodeData, edgeData]);

  const initSize = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w === 0 || h === 0) return;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    // Rescale existing nodes if size changed
    const oldW = sizeRef.current.w;
    const oldH = sizeRef.current.h;
    if (oldW > 0 && oldH > 0 && (oldW !== w || oldH !== h)) {
      const sx = w / oldW;
      const sy = h / oldH;
      for (const node of nodesRef.current) {
        node.baseX *= sx;
        node.baseY *= sy;
        node.x *= sx;
        node.y *= sy;
      }
    }

    sizeRef.current = { w, h };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    initSize();

    const ro = new ResizeObserver(initSize);
    ro.observe(container);

    // Mouse events
    const getMousePos = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onMouseMove = (e: MouseEvent) => {
      const pos = getMousePos(e);
      const nodes = nodesRef.current;
      let found = -1;
      for (let i = 0; i < nodes.length; i++) {
        const dx = pos.x - nodes[i].x;
        const dy = pos.y - nodes[i].y;
        if (dx * dx + dy * dy < (nodes[i].radius + 4) * (nodes[i].radius + 4)) {
          found = i;
          break;
        }
      }
      hoveredNodeRef.current = found;
      canvas.style.cursor = found >= 0 ? "pointer" : "default";
    };

    const onClick = (e: MouseEvent) => {
      const pos = getMousePos(e);
      const nodes = nodesRef.current;
      for (let i = 0; i < nodes.length; i++) {
        const dx = pos.x - nodes[i].x;
        const dy = pos.y - nodes[i].y;
        if (dx * dx + dy * dy < (nodes[i].radius + 4) * (nodes[i].radius + 4)) {
          if (onNodeClick) {
            onNodeClick({ id: nodes[i].id, type: nodes[i].type });
          }
          break;
        }
      }
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onClick);

    // Animation loop
    const draw = (time: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { w, h } = sizeRef.current;
      const d = dprRef.current;
      const nodes = nodesRef.current;
      const edges = edgesRef.current;

      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.clearRect(0, 0, w, h);

      if (nodes.length === 0) {
        // Empty state
        ctx.font = "500 14px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "#64748b";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Memories will appear here as Jarvis learns", w / 2, h / 2);
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      // Update node positions (gentle floating)
      for (const node of nodes) {
        // Spawn animation for new nodes
        let scale = 1;
        if (node.isNew && node.spawnTime) {
          const age = time - node.spawnTime;
          if (age < 1000) {
            scale = Math.min(1, age / 1000);
          } else {
            node.isNew = false;
          }
        }

        node.x = node.baseX + Math.sin(time * node.freqX + node.phase) * 8 * scale;
        node.y = node.baseY + Math.cos(time * node.freqY + node.phase * 1.3) * 6 * scale;
      }

      // Schedule firings
      if (edges.length > 0 && time - lastFireTimeRef.current > nextFireDelayRef.current) {
        const edgeIdx = Math.floor(Math.random() * edges.length);
        const [from] = edges[edgeIdx];
        const fromNode = nodes[from];
        if (fromNode) {
          const color = CATEGORY_COLORS[fromNode.type] || "#6366f1";
          firingsRef.current.push({ from: edges[edgeIdx][0], to: edges[edgeIdx][1], startTime: time, duration: 800, color });
        }
        lastFireTimeRef.current = time;
        nextFireDelayRef.current = 1500 + Math.random() * 2000;
      }

      // Build firing set
      const firingSet = new Set<string>();
      for (const f of firingsRef.current) {
        firingSet.add(`${f.from}-${f.to}`);
        firingSet.add(`${f.to}-${f.from}`);
      }

      // Draw non-firing edges
      ctx.lineWidth = 0.8;
      for (const [ai, bi] of edges) {
        if (firingSet.has(`${ai}-${bi}`)) continue;
        const a = nodes[ai];
        const b = nodes[bi];
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = "rgba(30, 30, 46, 0.4)";
        ctx.stroke();
      }

      // Draw firing edges
      const activeFirings: FiringEdge[] = [];
      for (const f of firingsRef.current) {
        const elapsed = time - f.startTime;
        if (elapsed > f.duration) continue;
        activeFirings.push(f);

        const progress = elapsed / f.duration;
        const intensity = Math.sin(progress * Math.PI);
        const rgb = hexToRgb(f.color);

        const a = nodes[f.from];
        const b = nodes[f.to];
        if (!a || !b) continue;

        ctx.save();
        ctx.lineWidth = 1.5 + intensity * 2;
        ctx.shadowColor = f.color;
        ctx.shadowBlur = intensity * 20;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.15 + intensity * 0.85})`;
        ctx.stroke();
        ctx.restore();
      }
      firingsRef.current = activeFirings;

      // Draw nodes
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const color = CATEGORY_COLORS[node.type] || "#6366f1";
        const rgb = hexToRgb(color);
        const isHovered = hoveredNodeRef.current === i;

        let scale = 1;
        if (node.isNew && node.spawnTime) {
          const age = time - node.spawnTime;
          scale = Math.min(1, age / 1000);
        }

        const r = node.radius * scale;
        const glowPulse = 15 + Math.sin(time * 0.002 + node.phase) * 5;

        // New node spawn glow
        if (node.isNew && node.spawnTime) {
          const age = time - node.spawnTime;
          if (age < 2000) {
            const spawnGlow = Math.max(0, 1 - age / 2000) * 30;
            ctx.save();
            ctx.shadowColor = color;
            ctx.shadowBlur = spawnGlow + 20;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.15 * (1 - age / 2000)})`;
            ctx.fill();
            ctx.restore();
          }
        }

        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = isHovered ? glowPulse + 12 : glowPulse;

        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isHovered ? 0.5 : 0.3})`;
        ctx.fill();

        ctx.lineWidth = isHovered ? 2.5 : 1.5;
        ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`;
        ctx.stroke();
        ctx.restore();

        // Inner bright dot
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`;
        ctx.fill();
      }

      // Tooltip for hovered node
      if (hoveredNodeRef.current >= 0) {
        const node = nodes[hoveredNodeRef.current];
        const label = node.label;
        ctx.font = "600 12px system-ui, -apple-system, sans-serif";
        const metrics = ctx.measureText(label);
        const textW = metrics.width;
        const padX = 10;
        const tooltipW = textW + padX * 2;
        const tooltipH = 24;
        let tx = node.x - tooltipW / 2;
        let ty = node.y - node.radius - tooltipH - 8;

        if (tx < 4) tx = 4;
        if (tx + tooltipW > w - 4) tx = w - 4 - tooltipW;
        if (ty < 4) ty = node.y + node.radius + 8;

        ctx.fillStyle = "rgba(10, 10, 20, 0.9)";
        ctx.beginPath();
        ctx.roundRect(tx, ty, tooltipW, tooltipH, 6);
        ctx.fill();

        const borderColor = CATEGORY_COLORS[node.type] || "#6366f1";
        ctx.strokeStyle = `${borderColor}66`;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, tx + tooltipW / 2, ty + tooltipH / 2);
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      ro.disconnect();
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onClick);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [onNodeClick, initSize]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
