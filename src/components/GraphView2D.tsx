import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { Entity, EntityType, Relationship } from "../data/types";
import { IconMinus, IconPlus, IconTarget } from "./icons";

/**
 * Flat network view drawn on a 2D canvas.
 *
 * Positions come from a Fruchterman-Reingold relaxation run once per data change: linked
 * entities pull together, everything repels, and a weak pull to the centre stops detached
 * fragments drifting off. Nothing rotates and nothing is projected — a link chart is read, not
 * flown around, and depth cues only got in the way of comparing two nodes' distance.
 */

/** Muted and navy-anchored, matching the rest of the portal. Entity type is a quiet hue shift
 *  rather than a primary colour: saturation is held back for risk and selection, which are what
 *  an officer is actually scanning the graph for. */
export const typeColor: Record<EntityType, string> = {
  person: "#3b6fb5",
  organization: "#c78a3a",
  location: "#2f9182",
  vehicle: "#6d5fc0",
  phone: "#c05f77",
};

const BG = "#f0f2f5";
const RISK_HIGH = "#b91c1c";

/** Darken a hex colour toward black by `amount` (0–1), for a tone-on-tone rim that reads as a
 *  solid token rather than the white-outlined bubble the flat fill looked like before. */
function darken(hex: string, amount: number): string {
  const v = parseInt(hex.slice(1), 16);
  const r = Math.round(((v >> 16) & 255) * (1 - amount));
  const g = Math.round(((v >> 8) & 255) * (1 - amount));
  const b = Math.round((v & 255) * (1 - amount));
  return `rgb(${r}, ${g}, ${b})`;
}

/** The canvas sits on a near-white ground, where the platform's own arrow and open-hand cursors
 *  are pale enough to lose. These are drawn dark with a white keyline so they read on it, and
 *  the accent one marks "there is a node under you" before you click. */
function arrowCursor(fill: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">` +
    `<path d="M4 2 L4 17.4 L8.2 13.4 L10.7 19.2 L13.1 18.2 L10.7 12.5 L16 12.5 Z" ` +
    `fill="${fill}" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}") 4 2, default`;
}

const CURSOR_IDLE = arrowCursor("#0f2c4e");
const CURSOR_NODE = arrowCursor("#1d4ed8");
const LABEL_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, Helvetica, sans-serif';

interface Node2D {
  id: string;
  entity: Entity;
  x: number;
  y: number;
  radius: number;
  /** filled per frame */
  sx: number;
  sy: number;
}

const WORLD = 1000;

function layout(entities: Entity[], relationships: Relationship[]): Node2D[] {
  const n = entities.length;
  if (n === 0) return [];

  const degree = new Map<string, number>();
  relationships.forEach((r) => {
    degree.set(r.source, (degree.get(r.source) ?? 0) + 1);
    degree.set(r.target, (degree.get(r.target) ?? 0) + 1);
  });

  // Deterministic seeding on a golden-angle spiral. Random starts make the graph jump to a
  // different shape on every filter change, which reads as the data having changed.
  const golden = Math.PI * (3 - Math.sqrt(5));
  const nodes: Node2D[] = entities.map((e, i) => {
    const r = (WORLD / 2.6) * Math.sqrt((i + 0.5) / n);
    const a = golden * i;
    const d = degree.get(e.id) ?? 0;
    return {
      id: e.id,
      entity: e,
      x: Math.cos(a) * r,
      y: Math.sin(a) * r,
      radius: 6 + Math.min(d, 8) * 1.35,
      sx: 0,
      sy: 0,
    };
  });

  const index = new Map(nodes.map((nd, i) => [nd.id, i]));
  const links = relationships
    .map((r) => [index.get(r.source), index.get(r.target)] as const)
    .filter((l): l is readonly [number, number] => l[0] !== undefined && l[1] !== undefined);

  const k = Math.sqrt((WORLD * WORLD) / n);
  const passes = 320;
  let temp = WORLD / 8;

  const dispX = new Array(n).fill(0);
  const dispY = new Array(n).fill(0);

  for (let pass = 0; pass < passes; pass++) {
    dispX.fill(0);
    dispY.fill(0);

    // repulsion between every pair
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = nodes[i].x - nodes[j].x;
        let dy = nodes[i].y - nodes[j].y;
        let dist = Math.hypot(dx, dy);
        if (dist < 0.01) {
          // Identical positions have no direction to separate along; nudge deterministically.
          dx = (i % 2 === 0 ? 1 : -1) * 0.5;
          dy = (j % 2 === 0 ? 1 : -1) * 0.5;
          dist = Math.hypot(dx, dy);
        }
        const force = (k * k) / dist;
        const ux = (dx / dist) * force;
        const uy = (dy / dist) * force;
        dispX[i] += ux;
        dispY[i] += uy;
        dispX[j] -= ux;
        dispY[j] -= uy;
      }
    }

    // attraction along links
    for (const [a, b] of links) {
      const dx = nodes[a].x - nodes[b].x;
      const dy = nodes[a].y - nodes[b].y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const force = (dist * dist) / k;
      const ux = (dx / dist) * force;
      const uy = (dy / dist) * force;
      dispX[a] -= ux;
      dispY[a] -= uy;
      dispX[b] += ux;
      dispY[b] += uy;
    }

    for (let i = 0; i < n; i++) {
      // Weak pull to the origin, so entities with no links stay in the picture instead of
      // being pushed to the edge of the world by repulsion alone.
      dispX[i] -= nodes[i].x * 0.012;
      dispY[i] -= nodes[i].y * 0.012;

      const d = Math.hypot(dispX[i], dispY[i]) || 1;
      const step = Math.min(d, temp);
      nodes[i].x += (dispX[i] / d) * step;
      nodes[i].y += (dispY[i] / d) * step;
    }

    temp *= 0.975;
  }

  return nodes;
}

interface GraphView2DProps {
  entities: Entity[];
  relationships: Relationship[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  highlightEdgeIds?: Set<string>;
  hiddenEdgeIds?: Set<string>;
  dimmedNodeIds?: Set<string>;
  nodeColorOverride?: Map<string, string>;
}

export default function GraphView2D({
  entities,
  relationships,
  selectedId,
  onSelect,
  highlightEdgeIds,
  hiddenEdgeIds,
  dimmedNodeIds,
  nodeColorOverride,
}: GraphView2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const needsFit = useRef(true);

  const camera = useRef({ x: 0, y: 0, zoom: 1 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const nodes = useMemo(() => layout(entities, relationships), [entities, relationships]);
  const nodesRef = useRef<Node2D[]>(nodes);
  nodesRef.current = nodes;

  const live = useRef({ selectedId, highlightEdgeIds, hiddenEdgeIds, dimmedNodeIds, nodeColorOverride, relationships });
  live.current = { selectedId, highlightEdgeIds, hiddenEdgeIds, dimmedNodeIds, nodeColorOverride, relationships };

  useLayoutEffect(() => {
    needsFit.current = true;
  }, [nodes]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    const list = nodesRef.current;
    if (list.length === 0) return;

    // Frame the whole graph on first paint after a layout, whatever the pane size.
    if (needsFit.current && w > 120 && h > 120) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      list.forEach((nd) => {
        if (nd.x < minX) minX = nd.x;
        if (nd.x > maxX) maxX = nd.x;
        if (nd.y < minY) minY = nd.y;
        if (nd.y > maxY) maxY = nd.y;
      });
      const spanX = Math.max(maxX - minX, 1);
      const spanY = Math.max(maxY - minY, 1);
      // Pad for node radii and labels, which sit outside the position bounding box.
      camera.current.zoom = Math.max(0.2, Math.min(2.6, Math.min((w - 130) / spanX, (h - 110) / spanY)));
      camera.current.x = (minX + maxX) / 2;
      camera.current.y = (minY + maxY) / 2;
      needsFit.current = false;
    }

    const { x: camX, y: camY, zoom } = camera.current;
    const cx = w / 2;
    const cy = h / 2;
    list.forEach((nd) => {
      nd.sx = cx + (nd.x - camX) * zoom;
      nd.sy = cy + (nd.y - camY) * zoom;
    });

    const byId = new Map(list.map((nd) => [nd.id, nd]));
    const { selectedId: sel, highlightEdgeIds: hl, hiddenEdgeIds: hidden, dimmedNodeIds: dim, nodeColorOverride: override, relationships: rels } = live.current;

    const neighbours = new Set<string>();
    if (sel) {
      rels.forEach((r) => {
        if (r.source === sel) neighbours.add(r.target);
        if (r.target === sel) neighbours.add(r.source);
      });
    }

    // edges
    for (const r of rels) {
      if (hidden?.has(r.id)) continue;
      const a = byId.get(r.source);
      const b = byId.get(r.target);
      if (!a || !b) continue;

      const isPath = hl?.has(r.id) ?? false;
      const touchesSel = sel != null && (r.source === sel || r.target === sel);

      if (isPath) {
        ctx.strokeStyle = "#ea580c";
        ctx.lineWidth = 2.4;
      } else if (touchesSel) {
        ctx.strokeStyle = "#c98a1f";
        ctx.lineWidth = 1.9;
      } else {
        ctx.strokeStyle = "#c3cad6";
        ctx.lineWidth = 1;
      }
      ctx.globalAlpha = sel && !touchesSel && !isPath ? 0.3 : 1;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // nodes
    for (const nd of list) {
      const base = override?.get(nd.id) ?? typeColor[nd.entity.type];
      const isSel = nd.id === sel;
      const isNeighbour = neighbours.has(nd.id);
      const dimmed = dim?.has(nd.id) ?? false;
      const r = nd.radius * Math.max(0.65, Math.min(1.5, zoom));
      if (!Number.isFinite(r) || !Number.isFinite(nd.sx) || !Number.isFinite(nd.sy)) continue;

      ctx.globalAlpha = dimmed ? 0.16 : sel && !isSel && !isNeighbour ? 0.4 : 1;

      // A ring of background colour behind each node so the edges stop cleanly at its rim instead
      // of visually piercing through it — the single biggest thing that made the old nodes read
      // as flat pasted-on discs.
      ctx.beginPath();
      ctx.fillStyle = BG;
      ctx.arc(nd.sx, nd.sy, r + 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Soft drop shadow lifts the node off the canvas; kept faint so a dense graph does not turn
      // muddy. The fill is painted under the shadow, then the shadow is cleared for the rim.
      const highRisk = nd.entity.riskLevel === "high" && !dimmed;
      ctx.save();
      ctx.shadowColor = "rgba(15, 23, 42, 0.22)";
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 1;
      ctx.beginPath();
      ctx.fillStyle = base;
      ctx.arc(nd.sx, nd.sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Tone-on-tone rim (or red at high risk). Reads as a solid token, not a white-outlined ball.
      ctx.beginPath();
      ctx.strokeStyle = highRisk ? RISK_HIGH : darken(base, 0.32);
      ctx.lineWidth = highRisk ? 2 : 1.25;
      ctx.arc(nd.sx, nd.sy, r, 0, Math.PI * 2);
      ctx.stroke();

      if (isSel) {
        ctx.beginPath();
        ctx.strokeStyle = "#0f2c4e";
        ctx.lineWidth = 2;
        ctx.arc(nd.sx, nd.sy, r + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      const worthLabel = isSel || isNeighbour || nd.radius >= 12;
      if (worthLabel && !dimmed) {
        ctx.globalAlpha = 1;
        ctx.font = `${isSel ? 600 : 500} 11px ${LABEL_FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const label = nd.entity.label;
        const tw = ctx.measureText(label).width;
        const ty = nd.sy + r + 5;
        // A soft rounded chip behind the label keeps it legible over edges without the fuzzy
        // stroke-outline that made the old labels look haloed.
        const padX = 5;
        const chipH = 15;
        ctx.fillStyle = "rgba(255, 255, 255, 0.86)";
        const rx = nd.sx - tw / 2 - padX;
        const rw = tw + padX * 2;
        const radius = 4;
        ctx.beginPath();
        ctx.moveTo(rx + radius, ty);
        ctx.arcTo(rx + rw, ty, rx + rw, ty + chipH, radius);
        ctx.arcTo(rx + rw, ty + chipH, rx, ty + chipH, radius);
        ctx.arcTo(rx, ty + chipH, rx, ty, radius);
        ctx.arcTo(rx, ty, rx + rw, ty, radius);
        ctx.fill();
        ctx.fillStyle = isSel ? "#0f2c4e" : "#334155";
        ctx.fillText(label, nd.sx, ty + 2);
      }

      ctx.globalAlpha = 1;
    }
  }, []);

  // Nothing here animates, so the graph is drawn when something changes rather than on a
  // permanent sixty-times-a-second loop. That also survives the browser throttling animation
  // frames in a background tab, where a render loop simply stops and leaves a blank canvas.
  useLayoutEffect(() => {
    draw();
  });

  // Re-frame whenever the pane resizes. Without this the first paint, which can land while the
  // pane is still settling, permanently decides the zoom.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      needsFit.current = true;
      draw();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  // pointer: drag to pan, click to select
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onDown = (e: PointerEvent) => {
      drag.current = { x: e.clientX, y: e.clientY, moved: false };
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(e.pointerId);
    };

    /** Nearest node under a point in canvas coordinates, or null. */
    const nodeAt = (mx: number, my: number): Node2D | null => {
      let hit: Node2D | null = null;
      let best = Infinity;
      for (const nd of nodesRef.current) {
        const r = nd.radius * Math.max(0.65, Math.min(1.5, camera.current.zoom)) + 4;
        const dist = Math.hypot(nd.sx - mx, nd.sy - my);
        if (dist <= r && dist < best) {
          best = dist;
          hit = nd;
        }
      }
      return hit;
    };

    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) {
        const rect = canvas.getBoundingClientRect();
        const over = nodeAt(e.clientX - rect.left, e.clientY - rect.top);
        canvas.style.cursor = over ? CURSOR_NODE : CURSOR_IDLE;
        return;
      }
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      camera.current.x -= dx / camera.current.zoom;
      camera.current.y -= dy / camera.current.zoom;
      d.x = e.clientX;
      d.y = e.clientY;
      draw();
    };

    const onUp = (e: PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      canvas.style.cursor = CURSOR_IDLE;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      if (!d || d.moved) return;

      const rect = canvas.getBoundingClientRect();
      const hit = nodeAt(e.clientX - rect.left, e.clientY - rect.top);
      onSelect(hit ? hit.id : null);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.current.zoom = Math.max(0.2, Math.min(3, camera.current.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
      draw();
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [onSelect, draw]);

  return (
    <>
      <div ref={wrapRef} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}>
        <canvas ref={canvasRef} style={{ display: "block", cursor: CURSOR_IDLE, touchAction: "none" }} />
      </div>

      <div className="icon-dock icon-dock-bottom-left">
        <button
          className="icon-dock-btn"
          onClick={() => {
            needsFit.current = true;
          }}
          aria-label="Fit to view"
          title="Fit to view"
        >
          <IconTarget />
        </button>
        <button
          className="icon-dock-btn"
          onClick={() => {
            camera.current.zoom = Math.min(3, camera.current.zoom * 1.2);
          }}
          aria-label="Zoom in"
        >
          <IconPlus />
        </button>
        <button
          className="icon-dock-btn"
          onClick={() => {
            camera.current.zoom = Math.max(0.2, camera.current.zoom / 1.2);
          }}
          aria-label="Zoom out"
        >
          <IconMinus />
        </button>
      </div>
    </>
  );
}
