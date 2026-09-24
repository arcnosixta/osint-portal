"use client";

import { useEffect, useRef } from "react";
import { isReducedMotion } from "@/lib/animations";
import type { EntityType } from "@/lib/graph";

export interface GraphNode {
  id: string;
  label: string;
  type: EntityType;
}

export interface GraphLink {
  source: string;
  target: string;
  kind: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export const NODE_TYPES: EntityType[] = ["username", "domain", "host", "ip", "email", "url", "port"];

export const NODE_COLORS: Record<EntityType, string> = {
  username: "#ffd166",
  domain: "#c084fc",
  host: "#38bdf8",
  ip: "#f472b6",
  email: "#4ade80",
  url: "#94a3b8",
  port: "#565a66",
};

const RADIUS: Record<EntityType, number> = {
  username: 7,
  domain: 10,
  host: 8,
  ip: 8,
  email: 7,
  url: 6,
  port: 4,
};

interface PhyNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  fixed?: boolean;
}

const MAX_NODES = 500;

interface RenderProps {
  graph: GraphData;
  onSelect?: (node: GraphNode | null) => void;
  selectedId?: string | null;
  initialLayout?: Record<string, { x: number; y: number }> | null;
  onLayout?: (layout: Record<string, { x: number; y: number }>) => void;
  ariaLabel?: string;
  className?: string;
}

export default function GraphCanvas({
  graph,
  onSelect,
  selectedId,
  initialLayout,
  onLayout,
  ariaLabel,
  className,
}: RenderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef({ graph, onSelect, onLayout });
  const layoutRef = useRef<Record<string, { x: number; y: number }> | null>(initialLayout ?? null);
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    propsRef.current = { graph, onSelect, onLayout };
  }, [graph, onSelect, onLayout]);
  useEffect(() => {
    layoutRef.current = initialLayout ?? null;
  }, [initialLayout]);
  useEffect(() => {
    selectedIdRef.current = selectedId ?? null;
  }, [selectedId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let width = wrap.clientWidth;
    let height = wrap.clientHeight;
    let canDraw = false;

    const resize = () => {
      width = wrap.clientWidth;
      height = wrap.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      if (canDraw) draw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const reduced = isReducedMotion();
    let byId = new Map<string, PhyNode>();
    let physics: PhyNode[] = [];
    let links: { source: PhyNode; target: PhyNode; kind: string }[] = [];
    let animAt = reduced ? 1 : 0;
    let selected: PhyNode | null = null;
    let hover: PhyNode | null = null;
    let dragging: PhyNode | null = null;
    let panStart: { x: number; y: number } | null = null;
    const cam = { x: width / 2, y: height / 2, scale: 1 };
    let raf = 0;
    let frozen = false;
    let calm = 0;
    let lastActive = performance.now();
    let live = false;

    const seed = () => {
      const prev = byId;
      const layout = layoutRef.current ?? {};
      const nodes = graph.nodes.slice(0, MAX_NODES);
      const fresh = new Map<string, PhyNode>();
      for (const n of nodes) {
        const old = prev.get(n.id);
        const laid = layout[n.id];
        let x: number;
        let y: number;
        if (old) { x = old.x; y = old.y; }
        else if (laid && Number.isFinite(laid.x) && Number.isFinite(laid.y)) { x = laid.x; y = laid.y; }
        else {
          x = (Math.random() - 0.5) * width * 0.6 + width / 2;
          y = (Math.random() - 0.5) * height * 0.6 + height / 2;
        }
        fresh.set(n.id, { ...n, x, y, vx: 0, vy: 0, r: RADIUS[n.type] });
      }
      byId = fresh;
      physics = [...byId.values()];
      links = graph.links
        .map((l) => ({ source: byId.get(l.source), target: byId.get(l.target), kind: l.kind }))
        .filter((l): l is { source: PhyNode; target: PhyNode; kind: string } => Boolean(l.source && l.target));
      selected = selected && byId.get(selected.id) ? byId.get(selected.id)! : null;
      hover = null;
      frozen = false;
      calm = 0;
      lastActive = performance.now();
    };
    seed();

    const stepPhysics = () => {
      const n = physics.length;
      // repulsion between all pairs (spatial hashing would be overkill here)
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = physics[i];
          const b = physics[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) {
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
            d2 = 1;
          }
          const d = Math.sqrt(d2);
          const force = 5200 / d2;
          const fx = (dx / d) * force;
          if (!(a.fixed || a === dragging)) { a.vx -= fx; a.vy -= (dy / d) * force; }
          if (!(b.fixed || b === dragging)) { b.vx += fx; b.vy += (dy / d) * force; }
        }
      }
      for (const l of links) {
        const { source: a, target: b } = l;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const rest = 46 + (a.r + b.r) * 0.5;
        const f = (d - rest) * 0.02;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        if (!(a.fixed || a === dragging)) { a.vx += fx; a.vy += fy; }
        if (!(b.fixed || b === dragging)) { b.vx -= fx; b.vy -= fy; }
      }
      for (const p of physics) {
        if (p === dragging) {
          p.x += (dragging.x - p.x) * 0.4;
          p.y += (dragging.y - p.y) * 0.4;
          p.vx = 0;
          p.vy = 0;
          continue;
        }
        p.x += p.vx * 0.5;
        p.y += p.vy * 0.5;
        p.vx *= 0.86;
        p.vy *= 0.86;
      }
    };

    const worldToScreen = (x: number, y: number): [number, number] => [
      (x - cam.x) * cam.scale + width / 2,
      (y - cam.y) * cam.scale + height / 2,
    ];
    const screenToWorld = (x: number, y: number): [number, number] => [
      (x - width / 2) / cam.scale + cam.x,
      (y - height / 2) / cam.scale + cam.y,
    ];

    const pick = (sx: number, sy: number): PhyNode | null => {
      let best: PhyNode | null = null;
      let bestD = 22 / cam.scale;
      for (const p of physics) {
        const [x, y] = worldToScreen(p.x, p.y);
        const d = Math.hypot(sx - x, sy - y);
        if (d < Math.max(bestD, (p.r + 3) * cam.scale) && d < 22) {
          bestD = d;
          best = p;
        }
      }
      return best;
    };

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const glow = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.55);
      glow.addColorStop(0, "rgba(0,255,65,0.05)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      const fade = physics.length ? animAt : 1;
      if (fade <= 0.01) return;

      const selSet = new Set<string>();
      const hoverSet = new Set<string>();
      const focus =
        selected ?? (selectedIdRef.current ? byId.get(selectedIdRef.current) ?? null : null);
      if (focus) {
        for (const l of links) {
          if (l.source.id === focus.id) { selSet.add(l.target.id); selSet.add(l.source.id); }
          if (l.target.id === focus.id) { selSet.add(l.source.id); selSet.add(l.target.id); }
        }
      }
      if (hover) {
        for (const l of links) {
          if (l.source.id === hover.id) hoverSet.add(l.target.id);
          if (l.target.id === hover.id) hoverSet.add(l.source.id);
        }
      }

      ctx.lineWidth = 1;
      ctx.globalAlpha = fade;
      for (const l of links) {
        const [x1, y1] = worldToScreen(l.source.x, l.source.y);
        const [x2, y2] = worldToScreen(l.target.x, l.target.y);
        const active =
          (focus && (l.source.id === focus.id || l.target.id === focus.id)) ||
          (hover && (l.source.id === hover.id || l.target.id === hover.id));
        ctx.strokeStyle = active ? NODE_COLORS[l.kind === "port" ? "port" : "host"] : "rgba(148,163,184,0.18)";
        if (active) {
          ctx.strokeStyle = "rgba(0,255,65,0.55)";
          ctx.lineWidth = 1.6;
        } else {
          ctx.strokeStyle = "rgba(148,163,184,0.16)";
          ctx.lineWidth = 1;
        }
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.lineWidth = 1;

      for (const p of physics) {
        const dim = (focus && !selSet.has(p.id)) || (hover && !hoverSet.has(p.id));
        const [x, y] = worldToScreen(p.x, p.y);
        if (x < -30 || y < -30 || x > width + 30 || y > height + 30) continue;

        const rr = Math.max(2, p.r * cam.scale);
        ctx.globalAlpha = fade * (dim ? 0.25 : 1);
        ctx.fillStyle = NODE_COLORS[p.type];
        if (p.type === "ip") {
          ctx.save();
          ctx.rotate(0.785);
          ctx.beginPath();
          ctx.rect(x - rr * 0.7, y - rr * 0.7, rr * 1.4, rr * 1.4);
          ctx.fill();
          ctx.restore();
        } else if (p.type === "port") {
          ctx.beginPath();
          ctx.arc(x, y, rr * 0.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(x, y, rr, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = fade * (dim ? 0.2 : 0.9);
        ctx.fillStyle = "#d7e0d9";
        ctx.font = `${Math.max(10, 11 * cam.scale)}px 'JetBrains Mono', monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(p.label, x, y + rr + 3, Math.max(90, 130 * cam.scale));
      }
      ctx.globalAlpha = 1;
    };
    canDraw = true;

    const ENERGY_STOP = 0.05;
    const CALM_FRAMES = 12;
    const MAX_SIM_MS = 4000;

    const meanSpeed = () =>
      physics.length
        ? Math.sqrt(physics.reduce((s, p) => s + p.vx * p.vx + p.vy * p.vy, 0) / physics.length)
        : 0;

    const emitLayout = () => {
      if (!physics.length) return;
      const out: Record<string, { x: number; y: number }> = {};
      for (const p of physics) out[p.id] = { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 };
      propsRef.current.onLayout?.(out);
    };

    const freeze = () => {
      if (frozen) return;
      frozen = true;
      calm = 0;
      for (const p of physics) { p.vx = 0; p.vy = 0; }
      emitLayout();
    };

    const tick = () => {
      raf = 0;
      if (!reduced) animAt = Math.min(1, animAt + 0.04);
      if (dragging) {
        updateDrag();
        if (!reduced) stepPhysics();
        draw();
      } else if (panStart) {
        draw();
      } else if (!reduced && !frozen) {
        for (let s = 0; s < 2; s++) stepPhysics();
        draw();
        if (meanSpeed() < ENERGY_STOP) {
          if (++calm >= CALM_FRAMES) freeze();
        } else calm = 0;
        if (!frozen && performance.now() - lastActive > MAX_SIM_MS) freeze();
      } else {
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const wake = () => {
      frozen = false;
      calm = 0;
      lastActive = performance.now();
      startLoop();
    };

    const renderNow = () => {
      if (!raf) draw();
    };

    const pointer = { down: false, id: 0, last: { x: 0, y: 0 }, moved: false };

    const updateDrag = () => {
      if (dragging) {
        const [wx, wy] = screenToWorld(pointer.last.x, pointer.last.y);
        dragging.x = wx;
        dragging.y = wy;
      }
    };

    const onDown = (e: PointerEvent) => {
      const sx = e.offsetX;
      const sy = e.offsetY;
      pointer.down = true;
      pointer.id = e.pointerId;
      pointer.last = { x: sx, y: sy };
      pointer.moved = false;
      live = false;
      const target = pick(sx, sy);
      if (target) {
        dragging = target;
        target.fixed = true;
        updateDrag();
        canvas.setPointerCapture(e.pointerId);
      } else {
        panStart = { x: sx, y: sy };
      }
    };
    const onMove = (e: PointerEvent) => {
      const sx = e.offsetX;
      const sy = e.offsetY;
      if (pointer.down) {
        pointer.moved = pointer.moved || Math.hypot(sx - pointer.last.x, sy - pointer.last.y) > 3;
        if (!live && pointer.moved) {
          live = true;
          if (dragging) {
            wake();
          } else {
            startLoop();
          }
        }
        if (panStart && !dragging) {
          cam.x -= (sx - pointer.last.x) / cam.scale;
          cam.y -= (sy - pointer.last.y) / cam.scale;
        }
        pointer.last = { x: sx, y: sy };
      } else {
        const target = pick(sx, sy);
        if (target !== hover) {
          hover = target;
          canvas.style.cursor = target ? "pointer" : "grab";
          renderNow();
        }
      }
    };
    const onUp = () => {
      pointer.down = false;
      panStart = null;
      if (dragging) {
        dragging.fixed = false;
        if (!pointer.moved) {
          selected = dragging;
          propsRef.current.onSelect?.(dragging);
        }
        dragging = null;
        emitLayout();
      }
      live = false;
      renderNow();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0012);
      cam.scale = Math.min(3, Math.max(0.25, cam.scale * factor));
      renderNow();
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    animAt = reduced ? 1 : 0;
    if (reduced) {
      frozen = true;
    }
    draw();
    if (!reduced) {
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(raf);
      emitLayout();
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [graph]);

  return (
    <div ref={wrapRef} className={className ?? "relative h-full w-full overflow-hidden rounded-xl border border-border bg-black/30"}>
      <canvas ref={canvasRef} className="block h-full w-full touch-none" aria-label={ariaLabel ?? "Entity relation graph"} />
    </div>
  );
}