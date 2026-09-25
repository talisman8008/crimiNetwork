import { createElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Building2, CarFront, MapPin, Smartphone, UserRound, type LucideIcon } from "lucide-react";
import type { Entity, EntityType, Relationship } from "../data/types";

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
  person: "#3d5a80",
  organization: "#7c6a45",
  location: "#3f6f66",
  vehicle: "#5b5476",
  phone: "#7a4f58",
};

const BG = "#f0f2f5";
const RISK_HIGH = "#b91c1c";

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

const presentationPositions: Record<string, [number, number]> = {
  vikram: [-410, -175], rajan: [-65, -5], imran: [330, -145], nasreen: [-400, 165],
  rk: [-40, -240], arun: [-240, 225], car: [80, 215], andheri: [225, 195],
  dharavi: [-145, 245], salim: [440, 100], bike: [385, 235], malad: [130, -55], "phone-key": [245, 5],
};
const presentationRoles: Record<string, string> = {
  rajan: "Key suspect", imran: "Coordinator", vikram: "Financier", nasreen: "Financial link",
  arun: "Driver", rk: "Front company", andheri: "Origin site", dharavi: "Meeting point",
  malad: "Interception", salim: "Associate", car: "Vehicle", bike: "Vehicle", "phone-key": "Encrypted device",
};
const paleTypeColor: Record<EntityType, string> = { person: "#eef5ff", organization: "#fff6e7", location: "#edf8f1", vehicle: "#f4eff8", phone: "#f9eef1" };
const lucideByType: Record<EntityType, LucideIcon> = { person: UserRound, organization: Building2, location: MapPin, vehicle: CarFront, phone: Smartphone };
const lucideImages: Partial<Record<EntityType, HTMLImageElement>> = {};

function loadLucideIcon(type: EntityType, redraw: () => void): HTMLImageElement | null {
  const existing = lucideImages[type];
  if (existing) return existing.complete ? existing : null;
  const svg = renderToStaticMarkup(createElement(lucideByType[type], { size: 48, strokeWidth: 2.2 }));
  const image = new Image();
  image.onload = redraw;
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  lucideImages[type] = image;
  return null;
}

function layout(entities: Entity[], relationships: Relationship[]): Node2D[] {
  const n = entities.length;
  if (n === 0) return [];

  const presentation = entities.length > 3 && entities.every((entity) => presentationPositions[entity.id]);
  if (presentation) {
    return entities.map((entity) => ({ id: entity.id, entity, x: presentationPositions[entity.id][0], y: presentationPositions[entity.id][1], radius: entity.id === "rajan" ? 56 : 42, sx: 0, sy: 0 }));
  }

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
  highlightNodeIds?: Set<string>;
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
  highlightNodeIds,
}: GraphView2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const needsFit = useRef(true);

  const camera = useRef({ x: 0, y: 0, zoom: 1 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const nodes = useMemo(() => layout(entities, relationships), [entities, relationships]);
  const nodesRef = useRef<Node2D[]>(nodes);
  nodesRef.current = nodes;

  const live = useRef({ selectedId, highlightEdgeIds, hiddenEdgeIds, dimmedNodeIds, nodeColorOverride, highlightNodeIds, relationships });
  live.current = { selectedId, highlightEdgeIds, hiddenEdgeIds, dimmedNodeIds, nodeColorOverride, highlightNodeIds, relationships };

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
    const { selectedId: sel, highlightEdgeIds: hl, hiddenEdgeIds: hidden, dimmedNodeIds: dim, nodeColorOverride: override, highlightNodeIds: highlighted, relationships: rels } = live.current;

    const neighbours = new Set<string>();
    if (sel) {
      rels.forEach((r) => {
        if (r.source === sel) neighbours.add(r.target);
        if (r.target === sel) neighbours.add(r.source);
      });
    }

    const presentation = list.length > 3 && list.every((node) => presentationPositions[node.id]);
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
        // A selection is a direct-evidence query: all of its incident links should be
        // unmistakable, while the rest of the graph stays available as context.
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 3;
      } else {
        ctx.strokeStyle = "#c3cad6";
        ctx.lineWidth = 1;
      }
      ctx.globalAlpha = sel && !touchesSel && !isPath ? 0.16 : 1;
      ctx.setLineDash(presentation && (r.type === "associate" || r.type === "communication") ? [6, 5] : []);
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
      ctx.setLineDash([]);
      if (presentation) {
        const angle = Math.atan2(b.sy - a.sy, b.sx - a.sx);
        const end = Math.max(8, b.radius * zoom * 0.75);
        const ex = b.sx - Math.cos(angle) * end;
        const ey = b.sy - Math.sin(angle) * end;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - Math.cos(angle - 0.45) * 7, ey - Math.sin(angle - 0.45) * 7);
        ctx.lineTo(ex - Math.cos(angle + 0.45) * 7, ey - Math.sin(angle + 0.45) * 7);
        ctx.closePath();
        ctx.fill();
        const mx = (a.sx + b.sx) / 2;
        const my = (a.sy + b.sy) / 2 - 8;
        ctx.font = `10px ${LABEL_FONT}`;
        ctx.textAlign = "center";
        ctx.fillStyle = "#475569";
        ctx.fillText(`${r.type.replace(/\b\w/g, (letter) => letter.toUpperCase())} · ${r.observedOn.slice(0, 10)}`, mx, my);
      }
    }
    ctx.globalAlpha = 1;

    // nodes
    for (const nd of list) {
      const base = override?.get(nd.id) ?? typeColor[nd.entity.type];
      const isSel = nd.id === sel;
      const isNeighbour = neighbours.has(nd.id);
      const isHighlighted = highlighted?.has(nd.id) ?? false;
      const dimmed = dim?.has(nd.id) ?? false;
      const r = nd.radius * Math.max(0.65, Math.min(1.5, zoom));
      if (!Number.isFinite(r) || !Number.isFinite(nd.sx) || !Number.isFinite(nd.sy)) continue;

      ctx.globalAlpha = dimmed ? 0.16 : sel && !isSel && !isNeighbour ? 0.45 : 1;

      ctx.beginPath();
      ctx.fillStyle = presentation ? paleTypeColor[nd.entity.type] : base;
      ctx.arc(nd.sx, nd.sy, r, 0, Math.PI * 2);
      ctx.fill();

      // Risk rides on the node's own border, and only at the top level: most entities in a live
      // case carry some flag, so ringing anything above "low" is a field of targets.
      const highRisk = nd.entity.riskLevel === "high" && !dimmed;
      ctx.beginPath();
      ctx.strokeStyle = highRisk ? RISK_HIGH : presentation ? base : "#ffffff";
      ctx.lineWidth = highRisk ? 2.4 : presentation ? 1.8 : 1.5;
      ctx.arc(nd.sx, nd.sy, r, 0, Math.PI * 2);
      ctx.stroke();

      if (isSel || isHighlighted) {
        ctx.beginPath();
        ctx.strokeStyle = isSel ? "#0f2c4e" : "#2563eb";
        ctx.lineWidth = isSel ? 1.5 : 3;
        ctx.arc(nd.sx, nd.sy, r + (isSel ? 5 : 4), 0, Math.PI * 2);
        ctx.stroke();
      }

      if (presentation && !dimmed) {
        const icon = loadLucideIcon(nd.entity.type, draw);
        if (icon) {
          const iconSize = r * 0.43;
          ctx.drawImage(icon, nd.sx - iconSize / 2, nd.sy - r * 0.68, iconSize, iconSize);
        }
        const words = nd.entity.label.split(" ");
        const firstLine = words.length > 1 ? words.slice(0, Math.ceil(words.length / 2)).join(" ") : nd.entity.label;
        const secondLine = words.length > 1 ? words.slice(Math.ceil(words.length / 2)).join(" ") : "";
        ctx.font = `600 ${Math.max(7, Math.min(10, r / 4.4))}px ${LABEL_FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#1e293b";
        ctx.fillText(firstLine, nd.sx, nd.sy + r * 0.05);
        if (secondLine) ctx.fillText(secondLine, nd.sx, nd.sy + r * 0.24);
        ctx.font = `${Math.max(6.5, Math.min(8, r / 5.6))}px ${LABEL_FONT}`; ctx.fillStyle = base; ctx.fillText(presentationRoles[nd.id] ?? nd.entity.type, nd.sx, nd.sy + r * 0.58);
      }
      const worthLabel = !presentation && (isSel || isNeighbour || isHighlighted || nd.radius >= 12);
      if (worthLabel && !dimmed) {
        ctx.globalAlpha = 1;
        ctx.font = `${isSel ? 600 : 400} 11px ${LABEL_FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const label = nd.entity.label;
        const ty = nd.sy + r + 4;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(240, 242, 245, 0.9)";
        ctx.strokeText(label, nd.sx, ty);
        ctx.fillStyle = "#1e293b";
        ctx.fillText(label, nd.sx, ty);
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

    </>
  );
}
