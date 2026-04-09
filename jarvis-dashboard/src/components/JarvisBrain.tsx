"use client";

import { useRef, useEffect, useCallback } from "react";

interface BrainNode {
  id: string;
  label: string;
  type: "projects" | "goals" | "people" | "tools" | "concepts";
  projectId?: string;
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
}

interface FiringEdge {
  from: number;
  to: number;
  startTime: number;
  duration: number;
  color: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  projects: "#22c55e",
  goals: "#eab308",
  people: "#3b82f6",
  tools: "#a855f7",
  concepts: "#06b6d4",
};

const NODE_DATA: Omit<BrainNode, "x" | "y" | "vx" | "vy" | "phase" | "freqX" | "freqY" | "baseX" | "baseY">[] = [
  // projects
  { id: "ai-lead-nurture", label: "AI Lead Nurture", type: "projects", projectId: "proj-1", radius: 22 },
  { id: "jarvis-saas", label: "Jarvis SaaS", type: "projects", projectId: "proj-2", radius: 22 },
  { id: "buyer-chatbot", label: "Buyer Chatbot", type: "projects", projectId: "proj-3", radius: 22 },
  { id: "narwhal-ops", label: "Narwhal Ops", type: "projects", projectId: "proj-4", radius: 22 },
  { id: "listing-gen", label: "Listing Gen", type: "projects", projectId: "proj-5", radius: 22 },
  // goals
  { id: "launch-product", label: "Launch Product", type: "goals", radius: 20 },
  { id: "master-tools", label: "Master Tools", type: "goals", radius: 20 },
  { id: "1k-revenue", label: "$1k/mo Revenue", type: "goals", radius: 20 },
  { id: "automate-ops", label: "Automate Ops", type: "goals", radius: 20 },
  // people
  { id: "narwhal-team", label: "Narwhal Team", type: "people", radius: 18 },
  { id: "family", label: "Family", type: "people", radius: 18 },
  // tools
  { id: "claude", label: "Claude", type: "tools", radius: 18 },
  { id: "gmail", label: "Gmail", type: "tools", radius: 18 },
  { id: "lindy", label: "Lindy", type: "tools", radius: 18 },
  { id: "nextjs", label: "Next.js", type: "tools", radius: 18 },
  // concepts
  { id: "ai", label: "AI", type: "concepts", radius: 24 },
  { id: "real-estate", label: "Real Estate", type: "concepts", radius: 22 },
  { id: "financial-freedom", label: "Financial Freedom", type: "concepts", radius: 22 },
  { id: "remote-work", label: "Remote Work", type: "concepts", radius: 20 },
];

const EDGES: [string, string][] = [
  // AI Lead Nurture
  ["ai-lead-nurture", "ai"],
  ["ai-lead-nurture", "real-estate"],
  ["ai-lead-nurture", "claude"],
  ["ai-lead-nurture", "launch-product"],
  ["ai-lead-nurture", "1k-revenue"],
  // Jarvis SaaS
  ["jarvis-saas", "ai"],
  ["jarvis-saas", "claude"],
  ["jarvis-saas", "1k-revenue"],
  ["jarvis-saas", "financial-freedom"],
  // Buyer Chatbot
  ["buyer-chatbot", "ai"],
  ["buyer-chatbot", "real-estate"],
  ["buyer-chatbot", "claude"],
  // Narwhal Ops
  ["narwhal-ops", "real-estate"],
  ["narwhal-ops", "narwhal-team"],
  ["narwhal-ops", "automate-ops"],
  ["narwhal-ops", "gmail"],
  ["narwhal-ops", "lindy"],
  // Listing Gen
  ["listing-gen", "ai"],
  ["listing-gen", "real-estate"],
  ["listing-gen", "claude"],
  // Launch Product
  ["launch-product", "1k-revenue"],
  ["launch-product", "financial-freedom"],
  ["launch-product", "ai"],
  // Master Tools
  ["master-tools", "claude"],
  ["master-tools", "nextjs"],
  ["master-tools", "ai"],
  // $1k/mo Revenue
  ["1k-revenue", "financial-freedom"],
  ["1k-revenue", "remote-work"],
  // Automate Ops
  ["automate-ops", "narwhal-team"],
  ["automate-ops", "gmail"],
  ["automate-ops", "lindy"],
  // Family
  ["family", "remote-work"],
  ["family", "financial-freedom"],
];

interface JarvisBrainProps {
  onNodeClick?: (node: { id: string; type: string; projectId?: string }) => void;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 255, g: 255, b: 255 };
}

export default function JarvisBrain({ onNodeClick }: JarvisBrainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<BrainNode[]>([]);
  const hoveredNodeRef = useRef<number>(-1);
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const firingsRef = useRef<FiringEdge[]>([]);
  const lastFireTimeRef = useRef<number>(0);
  const nextFireDelayRef = useRef<number>(2000);
  const animFrameRef = useRef<number>(0);
  const sizeRef = useRef<{ w: number; h: number }>({ w: 800, h: 400 });
  const dprRef = useRef<number>(1);
  const initializedRef = useRef(false);

  const initNodes = useCallback((w: number, h: number) => {
    const cx = w / 2;
    const cy = h / 2;
    const count = NODE_DATA.length;
    const radiusSpread = Math.min(w, h) * 0.35;

    nodesRef.current = NODE_DATA.map((nd, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const jitter = (Math.random() - 0.5) * radiusSpread * 0.3;
      const r = radiusSpread + jitter;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;

      return {
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
      };
    });
    initializedRef.current = true;
  }, []);

  const repositionNodes = useCallback((w: number, h: number) => {
    if (!initializedRef.current || nodesRef.current.length === 0) {
      initNodes(w, h);
      return;
    }
    const oldW = sizeRef.current.w;
    const oldH = sizeRef.current.h;
    if (oldW === 0 || oldH === 0) {
      initNodes(w, h);
      return;
    }
    const scaleX = w / oldW;
    const scaleY = h / oldH;
    for (const node of nodesRef.current) {
      node.baseX *= scaleX;
      node.baseY *= scaleY;
      node.x *= scaleX;
      node.y *= scaleY;
    }
  }, [initNodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      if (w === 0 || h === 0) return;

      if (initializedRef.current) {
        repositionNodes(w, h);
      }

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      if (!initializedRef.current) {
        initNodes(w, h);
      }

      sizeRef.current = { w, h };
    };

    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(container);
    resizeCanvas();

    // Edge index lookup
    const nodeIndexMap = new Map<string, number>();
    NODE_DATA.forEach((n, i) => nodeIndexMap.set(n.id, i));
    const edgeIndices = EDGES.map(([a, b]) => [nodeIndexMap.get(a)!, nodeIndexMap.get(b)!] as [number, number]);

    // Mouse events
    const getMousePos = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onMouseMove = (e: MouseEvent) => {
      const pos = getMousePos(e);
      mousePosRef.current = pos;

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
      canvas.style.cursor = found >= 0 && nodes[found].projectId ? "pointer" : found >= 0 ? "default" : "default";
    };

    const onClick = (e: MouseEvent) => {
      const pos = getMousePos(e);
      const nodes = nodesRef.current;
      for (let i = 0; i < nodes.length; i++) {
        const dx = pos.x - nodes[i].x;
        const dy = pos.y - nodes[i].y;
        if (dx * dx + dy * dy < (nodes[i].radius + 4) * (nodes[i].radius + 4)) {
          if (nodes[i].projectId && onNodeClick) {
            onNodeClick({ id: nodes[i].id, type: nodes[i].type, projectId: nodes[i].projectId });
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

      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Update node positions (gentle floating)
      for (const node of nodes) {
        node.x = node.baseX + Math.sin(time * node.freqX + node.phase) * 8;
        node.y = node.baseY + Math.cos(time * node.freqY + node.phase * 1.3) * 6;
      }

      // Schedule firings
      if (time - lastFireTimeRef.current > nextFireDelayRef.current) {
        const edgeIdx = Math.floor(Math.random() * edgeIndices.length);
        const [from, to] = edgeIndices[edgeIdx];
        const fromNode = nodes[from];
        const color = CATEGORY_COLORS[fromNode.type];
        firingsRef.current.push({ from, to, startTime: time, duration: 800, color });
        lastFireTimeRef.current = time;
        nextFireDelayRef.current = 2000 + Math.random() * 2000;
      }

      // Build set of currently firing edges for lookup
      const firingSet = new Set<string>();
      for (const f of firingsRef.current) {
        firingSet.add(`${f.from}-${f.to}`);
        firingSet.add(`${f.to}-${f.from}`);
      }

      // Draw edges (non-firing)
      ctx.lineWidth = 1;
      for (const [ai, bi] of edgeIndices) {
        const key = `${ai}-${bi}`;
        if (firingSet.has(key)) continue;

        const a = nodes[ai];
        const b = nodes[bi];
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
        // Ease: bright in middle, dim at start/end
        const intensity = Math.sin(progress * Math.PI);
        const rgb = hexToRgb(f.color);

        const a = nodes[f.from];
        const b = nodes[f.to];

        // Glow line
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
        const color = CATEGORY_COLORS[node.type];
        const rgb = hexToRgb(color);
        const isHovered = hoveredNodeRef.current === i;

        // Pulsing glow
        const glowPulse = 15 + Math.sin(time * 0.002 + node.phase) * 5;

        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = isHovered ? glowPulse + 12 : glowPulse;

        // Fill
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isHovered ? 0.5 : 0.3})`;
        ctx.fill();

        // Stroke
        ctx.lineWidth = isHovered ? 2.5 : 1.5;
        ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`;
        ctx.stroke();
        ctx.restore();

        // Inner bright dot
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 0.25, 0, Math.PI * 2);
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
        const padY = 6;
        const tooltipW = textW + padX * 2;
        const tooltipH = 24;
        let tx = node.x - tooltipW / 2;
        let ty = node.y - node.radius - tooltipH - 8;

        // Clamp to canvas bounds
        if (tx < 4) tx = 4;
        if (tx + tooltipW > w - 4) tx = w - 4 - tooltipW;
        if (ty < 4) ty = node.y + node.radius + 8;

        // Background
        ctx.fillStyle = "rgba(10, 10, 20, 0.9)";
        ctx.beginPath();
        ctx.roundRect(tx, ty, tooltipW, tooltipH, 6);
        ctx.fill();

        // Border
        const color = CATEGORY_COLORS[node.type];
        ctx.strokeStyle = `${color}66`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Text
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
  }, [onNodeClick, initNodes, repositionNodes]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
