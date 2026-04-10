"use client";

import { useRef, useEffect, useCallback } from "react";

export interface MemoryForBrain {
  id: string;
  fact: string;
  category: string;
  created_at: string;
}

interface JarvisBrainProps {
  memories?: MemoryForBrain[];
  onNodeClick?: (node: { id: string; type: string }) => void;
}

// ─── 3D Types ───────────────────────────────────────────────
interface Node3D {
  id: string;
  label: string;
  type: string;
  x: number; y: number; z: number;
  radius: number;
  phase: number;
  speed: number;
  orbitRadius: number;
  orbitTilt: number;
}

interface Edge3D { from: number; to: number; }

const COLORS: Record<string, [number, number, number]> = {
  core:          [99, 102, 241],
  personal:      [59, 130, 246],
  business:      [34, 197, 94],
  health:        [239, 68, 68],
  goals:         [234, 179, 8],
  relationships: [236, 72, 153],
  preferences:   [168, 85, 247],
  ideas:         [6, 182, 212],
};

const CORE_LABELS = ["Dylan", "JARVIS", "AI", "Real Estate"];

export default function JarvisBrain({ memories = [], onNodeClick }: JarvisBrainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    nodes: [] as Node3D[],
    edges: [] as Edge3D[],
    rotX: -0.3,
    rotY: 0,
    dragging: false,
    lastMouse: { x: 0, y: 0 },
    hovered: -1,
    w: 0, h: 0, dpr: 1,
    built: false,
    animId: 0,
  });

  // Build 3D nodes from memories
  const buildScene = useCallback((w: number, h: number) => {
    const s = stateRef.current;
    const nodes: Node3D[] = [];
    const edges: Edge3D[] = [];
    const scale = Math.min(w, h) * 0.55;

    // Core nodes — tight cluster in center
    for (let i = 0; i < CORE_LABELS.length; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / CORE_LABELS.length);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      nodes.push({
        id: `core-${i}`, label: CORE_LABELS[i], type: "core",
        x: Math.sin(phi) * Math.cos(theta) * scale * 0.12,
        y: Math.cos(phi) * scale * 0.12,
        z: Math.sin(phi) * Math.sin(theta) * scale * 0.12,
        radius: 14, phase: i * 1.5, speed: 0.0004 + Math.random() * 0.0002,
        orbitRadius: scale * 0.12, orbitTilt: phi,
      });
    }

    // Connect core nodes
    for (let i = 0; i < CORE_LABELS.length; i++)
      for (let j = i + 1; j < CORE_LABELS.length; j++)
        edges.push({ from: i, to: j });

    // Category hub nodes — middle sphere
    const cats = [...new Set(memories.map((m) => m.category))];
    const catStartIdx = nodes.length;
    for (let i = 0; i < cats.length; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / Math.max(cats.length, 1));
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = scale * 0.4;
      nodes.push({
        id: `cat-${cats[i]}`, label: cats[i].charAt(0).toUpperCase() + cats[i].slice(1), type: cats[i],
        x: Math.sin(phi) * Math.cos(theta) * r,
        y: Math.cos(phi) * r,
        z: Math.sin(phi) * Math.sin(theta) * r,
        radius: 10, phase: i * 2.1, speed: 0.0003 + Math.random() * 0.0002,
        orbitRadius: r, orbitTilt: phi,
      });
      // Connect to a core node
      const coreTarget = cats[i] === "business" || cats[i] === "ideas" ? 2
        : cats[i] === "relationships" || cats[i] === "personal" ? 0
        : cats[i] === "goals" ? 0 : 1;
      edges.push({ from: catStartIdx + i, to: coreTarget });
    }

    // Memory nodes — outer sphere (cap at 40 for perf)
    const mems = memories.slice(0, 40);
    const memStartIdx = nodes.length;
    for (let i = 0; i < mems.length; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / Math.max(mems.length, 1));
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = scale * (0.65 + Math.random() * 0.15);
      const label = mems[i].fact.length > 20 ? mems[i].fact.slice(0, 19) + "\u2026" : mems[i].fact;
      nodes.push({
        id: `mem-${mems[i].id}`, label, type: mems[i].category,
        x: Math.sin(phi) * Math.cos(theta) * r,
        y: Math.cos(phi) * r,
        z: Math.sin(phi) * Math.sin(theta) * r,
        radius: 6, phase: i * 0.7, speed: 0.0002 + Math.random() * 0.0003,
        orbitRadius: r, orbitTilt: phi,
      });
      // Connect to category hub
      const catIdx = cats.indexOf(mems[i].category);
      if (catIdx >= 0) edges.push({ from: memStartIdx + i, to: catStartIdx + catIdx });
    }

    s.nodes = nodes;
    s.edges = edges;
    s.built = true;
  }, [memories]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const s = stateRef.current;
    const dpr = window.devicePixelRatio || 1;
    s.dpr = dpr;

    function resize() {
      const rect = container!.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w === 0 || h === 0) return;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      s.w = w;
      s.h = h;
      buildScene(w, h);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // ─── Input handling ───────────────────────────────
    function getPos(e: MouseEvent | Touch) {
      const rect = canvas!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function onPointerDown(e: MouseEvent) {
      s.dragging = true;
      s.lastMouse = getPos(e);
    }
    function onPointerUp() { s.dragging = false; }
    function onPointerMove(e: MouseEvent) {
      const pos = getPos(e);
      if (s.dragging) {
        const dx = pos.x - s.lastMouse.x;
        const dy = pos.y - s.lastMouse.y;
        s.rotY += dx * 0.008;
        s.rotX += dy * 0.008;
        s.rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, s.rotX));
        s.lastMouse = pos;
      }
      // Hit test for hover
      s.hovered = hitTest(pos.x, pos.y);
      canvas!.style.cursor = s.hovered >= 0 ? "pointer" : "grab";
    }
    function onClick(e: MouseEvent) {
      if (!onNodeClick) return;
      const pos = getPos(e);
      const idx = hitTest(pos.x, pos.y);
      if (idx >= 0) onNodeClick({ id: s.nodes[idx].id, type: s.nodes[idx].type });
    }

    // Touch
    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 1) {
        s.dragging = true;
        s.lastMouse = getPos(e.touches[0]);
      }
    }
    function onTouchMove(e: TouchEvent) {
      if (!s.dragging || e.touches.length !== 1) return;
      e.preventDefault();
      const pos = getPos(e.touches[0]);
      const dx = pos.x - s.lastMouse.x;
      const dy = pos.y - s.lastMouse.y;
      s.rotY += dx * 0.008;
      s.rotX += dy * 0.008;
      s.rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, s.rotX));
      s.lastMouse = pos;
    }
    function onTouchEnd() { s.dragging = false; }

    canvas.addEventListener("mousedown", onPointerDown);
    canvas.addEventListener("mouseup", onPointerUp);
    canvas.addEventListener("mouseleave", onPointerUp);
    canvas.addEventListener("mousemove", onPointerMove);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    // ─── Project 3D → 2D ─────────────────────────────
    function project(x: number, y: number, z: number): { sx: number; sy: number; depth: number } {
      // Rotate Y
      const cosY = Math.cos(s.rotY), sinY = Math.sin(s.rotY);
      let rx = x * cosY + z * sinY;
      let rz = -x * sinY + z * cosY;
      // Rotate X
      const cosX = Math.cos(s.rotX), sinX = Math.sin(s.rotX);
      const ry = y * cosX - rz * sinX;
      rz = y * sinX + rz * cosX;
      // Perspective
      const fov = 500;
      const scale = fov / (fov + rz + 100);
      return { sx: s.w / 2 + rx * scale, sy: s.h / 2 + ry * scale, depth: rz };
    }

    function hitTest(mx: number, my: number): number {
      const nodes = s.nodes;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const p = project(nodes[i].x, nodes[i].y, nodes[i].z);
        const r = nodes[i].radius * (500 / (500 + p.depth + 100)) * 2.5;
        const dx = mx - p.sx, dy = my - p.sy;
        if (dx * dx + dy * dy < (r + 6) * (r + 6)) return i;
      }
      return -1;
    }

    // ─── Draw loop ────────────────────────────────────
    function draw(time: number) {
      const ctx = canvas!.getContext("2d");
      if (!ctx || !s.built) { s.animId = requestAnimationFrame(draw); return; }

      const { w, h, dpr: d, nodes, edges } = s;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Slow auto-rotation when not dragging
      if (!s.dragging) s.rotY += 0.002;

      // Animate node positions (gentle orbit)
      for (const n of nodes) {
        const t = time * n.speed + n.phase;
        const wobble = n.type === "core" ? 3 : n.id.startsWith("cat-") ? 5 : 8;
        n.x += Math.sin(t) * wobble * 0.01;
        n.y += Math.cos(t * 0.7) * wobble * 0.008;
        n.z += Math.sin(t * 1.3) * wobble * 0.01;
      }

      // Project all nodes
      const projected = nodes.map((n) => ({ ...project(n.x, n.y, n.z), node: n }));

      // Sort by depth (back to front)
      const sortedIndices = projected.map((_, i) => i).sort((a, b) => projected[a].depth - projected[b].depth);

      // Draw edges
      for (const edge of edges) {
        const a = projected[edge.from];
        const b = projected[edge.to];
        const avgDepth = (a.depth + b.depth) / 2;
        const alpha = Math.max(0.03, Math.min(0.25, 0.15 - avgDepth * 0.0003));
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.strokeStyle = `rgba(99,102,241,${alpha})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }

      // Draw firing pulses on random edges
      const fireIdx = Math.floor((time * 0.001) % Math.max(edges.length, 1));
      const fireProgress = (time * 0.001) % 1;
      if (edges.length > 0) {
        const fe = edges[fireIdx];
        const a = projected[fe.from];
        const b = projected[fe.to];
        const px = a.sx + (b.sx - a.sx) * fireProgress;
        const py = a.sy + (b.sy - a.sy) * fireProgress;
        const col = COLORS[nodes[fe.from].type] || COLORS.core;
        const pulseAlpha = Math.sin(fireProgress * Math.PI) * 0.8;

        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${pulseAlpha})`;
        ctx.fill();

        // Pulse line segment
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${pulseAlpha * 0.4})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Draw nodes (sorted back-to-front)
      for (const idx of sortedIndices) {
        const p = projected[idx];
        const n = p.node;
        const col = COLORS[n.type] || COLORS.core;
        const depthScale = 500 / (500 + p.depth + 100);
        const r = n.radius * depthScale * 2.5;
        const isHovered = s.hovered === idx;
        const alpha = Math.max(0.2, Math.min(1, 0.6 + depthScale * 0.5));

        // Outer glow
        if (isHovered || n.type === "core") {
          const glowR = r * (isHovered ? 3.5 : 2.2);
          const grad = ctx.createRadialGradient(p.sx, p.sy, r * 0.5, p.sx, p.sy, glowR);
          grad.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${isHovered ? 0.25 : 0.1})`);
          grad.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, glowR, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Node body
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha * (isHovered ? 0.7 : 0.4)})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha * 0.9})`;
        ctx.lineWidth = isHovered ? 2 : 1;
        ctx.stroke();

        // Inner bright core
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha * 0.8})`;
        ctx.fill();

        // Label for core/category/hovered nodes
        if (n.type === "core" || n.id.startsWith("cat-") || isHovered) {
          ctx.font = `${isHovered ? 600 : 500} ${Math.max(10, 13 * depthScale)}px system-ui, -apple-system, sans-serif`;
          ctx.fillStyle = `rgba(255,255,255,${alpha * 0.9})`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(n.label, p.sx, p.sy - r - 6 * depthScale);
        }
      }

      // Scanline effect (subtle)
      const scanY = (time * 0.05) % h;
      const scanGrad = ctx.createLinearGradient(0, scanY - 2, 0, scanY + 2);
      scanGrad.addColorStop(0, "rgba(99,102,241,0)");
      scanGrad.addColorStop(0.5, "rgba(99,102,241,0.03)");
      scanGrad.addColorStop(1, "rgba(99,102,241,0)");
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 2, w, 4);

      s.animId = requestAnimationFrame(draw);
    }

    s.animId = requestAnimationFrame(draw);

    return () => {
      ro.disconnect();
      canvas.removeEventListener("mousedown", onPointerDown);
      canvas.removeEventListener("mouseup", onPointerUp);
      canvas.removeEventListener("mouseleave", onPointerUp);
      canvas.removeEventListener("mousemove", onPointerMove);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      cancelAnimationFrame(s.animId);
    };
  }, [buildScene, onNodeClick]);

  return (
    <div ref={containerRef} className="w-full h-full relative select-none">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
