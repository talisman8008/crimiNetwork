import { useCallback, useEffect, useRef, useState } from "react";
import type { Entity, EntityType, Relationship } from "../data/types";
import { IconMinus, IconPlus, IconTarget } from "./icons";

/**
 * Orbitable 3D network view drawn on a plain 2D canvas.
 *
 * There is no 3D library here. Nodes hold real x/y/z positions; each frame they are rotated by
 * the current yaw/pitch, projected through a pinhole camera, sorted back-to-front and painted.
 * Depth is carried by size and by fog that washes distant nodes and edges toward the background
 * colour, with only a soft top-lit gradient on each node. Deliberately restrained: gloss,
 * specular highlights and drop shadows read as decoration rather than as data.
 */

/** Matches --font-sans, so labels sit in the same voice as the rest of the portal. */
const LABEL_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, Helvetica, sans-serif';

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

const riskRing: Record<string, string> = {
  high: "#b91c1c",
  medium: "#b45309",
  low: "#cbd5e1",
};

const BG = "#f0f2f5";
const CAMERA_DISTANCE = 900;
const FOCAL = 780;

interface Node3D {
  id: string;
  entity: Entity;
  x: number;
  y: number;
  z: number;
  radius: number;
  /** filled per frame */
  sx: number;
  sy: number;
  sz: number;
  scale: number;
}

/** Fibonacci sphere, then relaxed so linked entities pull together and everything else pushes
 *  apart. Gives a readable ball of nodes rather than a shell with the structure hidden inside. */
function layout(entities: Entity[], relationships: Relationship[]): Node3D[] {
  const n = entities.length;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const spread = 190 + n * 16;

  const degree = new Map<string, number>();
  relationships.forEach((r) => {
    degree.set(r.source, (degree.get(r.source) ?? 0) + 1);
    degree.set(r.target, (degree.get(r.target) ?? 0) + 1);
  });

  const nodes: Node3D[] = entities.map((e, i) => {
    const t = n === 1 ? 0 : i / (n - 1);
    const y = 1 - t * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    // pull higher-degree entities toward the middle so hubs sit at the core
    const d = degree.get(e.id) ?? 0;
    const pull = 1 - Math.min(d, 8) / 26;
    const r = spread * pull * (0.72 + 0.28 * ring);
    return {
      id: e.id,
      entity: e,
      x: Math.cos(theta) * r,
      y: y * spread * pull * 0.82,
      z: Math.sin(theta) * r,
      radius: 6 + Math.min(d, 8) * 1.35,
      sx: 0,
      sy: 0,
      sz: 0,
      scale: 1,
    };
  });

  const index = new Map(nodes.map((nd, i) => [nd.id, i]));
  const links = relationships
    .map((r) => [index.get(r.source), index.get(r.target)] as const)
    .filter((l): l is readonly [number, number] => l[0] !== undefined && l[1] !== undefined);

  // a few relaxation passes: springs on links, repulsion everywhere
  for (let pass = 0; pass < 90; pass++) {
    for (const [a, b] of links) {
      const A = nodes[a];
      const B = nodes[b];
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const dz = B.z - A.z;
      const dist = Math.hypot(dx, dy, dz) || 1;
      const target = 205;
      const f = ((dist - target) / dist) * 0.02;
      A.x += dx * f;
      A.y += dy * f;
      A.z += dz * f;
      B.x -= dx * f;
      B.y -= dy * f;
      B.z -= dz * f;
    }

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const A = nodes[i];
        const B = nodes[j];
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const dz = B.z - A.z;
        const distSq = dx * dx + dy * dy + dz * dz || 1;
        const min = 132;
        if (distSq < min * min) {
          const dist = Math.sqrt(distSq);
          const push = ((min - dist) / dist) * 0.24;
          A.x -= dx * push;
          A.y -= dy * push;
          A.z -= dz * push;
          B.x += dx * push;
          B.y += dy * push;
          B.z += dz * push;
        }
      }
    }
  }

  // Normalise each axis on its own. Relaxation leaves the cloud noticeably taller than it is
  // wide, and since the on-screen fit is limited by whichever axis is longest, that wasted the
  // horizontal space. Keeping y a little shorter than x/z also reads better in a wide pane.
  let maxX = 0;
  let maxY = 0;
  let maxZ = 0;
  nodes.forEach((nd) => {
    maxX = Math.max(maxX, Math.abs(nd.x));
    maxY = Math.max(maxY, Math.abs(nd.y));
    maxZ = Math.max(maxZ, Math.abs(nd.z));
  });
  const kx = maxX > 0 ? 300 / maxX : 1;
  const ky = maxY > 0 ? 250 / maxY : 1;
  const kz = maxZ > 0 ? 300 / maxZ : 1;
  nodes.forEach((nd) => {
    nd.x *= kx;
    nd.y *= ky;
    nd.z *= kz;
  });

  return nodes;
}

const FALLBACK_RGB: [number, number, number] = [100, 100, 100];
const colorCache = new Map<string, [number, number, number]>();
let colorProbe: CanvasRenderingContext2D | null = null;

/** Let the canvas normalise the colour instead of parsing by hand: it accepts hex of any length,
 *  rgb()/rgba(), hsl() and named colours, and always reports back a form we can read. */
function parseColor(c: string): [number, number, number] {
  const cached = colorCache.get(c);
  if (cached) return cached;

  if (!colorProbe) colorProbe = document.createElement("canvas").getContext("2d");
  let rgb = FALLBACK_RGB;

  if (colorProbe && typeof c === "string") {
    // An invalid assignment is ignored, so seed a sentinel and see whether it actually changed.
    colorProbe.fillStyle = "#646464";
    colorProbe.fillStyle = c;
    const norm = String(colorProbe.fillStyle);
    if (norm.startsWith("#") && norm.length === 7) {
      const v = parseInt(norm.slice(1), 16);
      rgb = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    } else {
      const m = norm.match(/[\d.]+/g);
      if (m && m.length >= 3) rgb = [Number(m[0]), Number(m[1]), Number(m[2])];
    }
  }

  if (!rgb.every((v) => Number.isFinite(v))) rgb = FALLBACK_RGB;
  colorCache.set(c, rgb);
  return rgb;
}

function mixToward(color: string, target: string, amount: number): string {
  const [r1, g1, b1] = parseColor(color);
  const [r2, g2, b2] = parseColor(target);
  const t = Number.isFinite(amount) ? Math.max(0, Math.min(1, amount)) : 0;
  const m = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${m(r1, r2)}, ${m(g1, g2)}, ${m(b1, b2)})`;
}

function shade(color: string, amount: number): string {
  const [r, g, b] = parseColor(color);
  const a = Number.isFinite(amount) ? amount : 1;
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * a)));
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}

interface GraphView3DProps {
  entities: Entity[];
  relationships: Relationship[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  highlightEdgeIds?: Set<string>;
  hiddenEdgeIds?: Set<string>;
  dimmedNodeIds?: Set<string>;
  nodeColorOverride?: Map<string, string>;
}

export default function GraphView3D({
  entities,
  relationships,
  selectedId,
  onSelect,
  highlightEdgeIds,
  hiddenEdgeIds,
  dimmedNodeIds,
  nodeColorOverride,
}: GraphView3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<Node3D[]>([]);
  const frameRef = useRef<number>(0);
  const needsFit = useRef(true);

  // camera: yaw/pitch in radians, zoom multiplier
  const camera = useRef({ yaw: 0.5, pitch: -0.25, zoom: 1 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const spin = useRef(false);
  const [autoSpin, setAutoSpin] = useState(false);

  // props the draw loop reads without re-subscribing every render
  const live = useRef({ selectedId, highlightEdgeIds, hiddenEdgeIds, dimmedNodeIds, nodeColorOverride, relationships });
  live.current = { selectedId, highlightEdgeIds, hiddenEdgeIds, dimmedNodeIds, nodeColorOverride, relationships };

  useEffect(() => {
    nodesRef.current = layout(entities, relationships);
    needsFit.current = true;
  }, [entities, relationships]);

  const project = useCallback((nd: Node3D, cx: number, cy: number) => {
    const { yaw, pitch, zoom } = camera.current;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);

    // yaw about Y, then pitch about X
    const x1 = nd.x * cosY - nd.z * sinY;
    const z1 = nd.x * sinY + nd.z * cosY;
    const y2 = nd.y * cosP - z1 * sinP;
    const z2 = nd.y * sinP + z1 * cosP;

    const depth = z2 + CAMERA_DISTANCE;
    const scale = (FOCAL / Math.max(depth, 1)) * zoom;
    nd.sx = cx + x1 * scale;
    nd.sy = cy + y2 * scale;
    nd.sz = z2;
    nd.scale = scale;
  }, []);

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
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    const nodes = nodesRef.current;
    if (nodes.length === 0) return;

    if (spin.current && !drag.current) camera.current.yaw += 0.0016;

    const cx = w / 2;
    const cy = h / 2;
    nodes.forEach((nd) => project(nd, cx, cy));

    // Frame the whole network on first paint after a layout, whatever the pane size.
    if (needsFit.current && w > 120 && h > 120) {
      // Fit each axis on its own. Collapsing both into one extent and comparing it against the
      // shorter pane side leaves a wide pane mostly empty.
      // Fit the bulk of the network, not its furthest straggler. A couple of loosely connected
      // nodes sit far outside the core, and fitting those shrank everything else to a clump.
      const xs = nodes.map((nd) => Math.abs(nd.sx - cx)).sort((a, b) => a - b);
      const ys = nodes.map((nd) => Math.abs(nd.sy - cy)).sort((a, b) => a - b);
      const pick = (arr: number[]) => arr[Math.min(arr.length - 1, Math.floor(arr.length * 0.9))];
      const extentX = pick(xs);
      const extentY = pick(ys);
      if (extentX > 0 && extentY > 0) {
        const k = Math.min((w * 0.44) / extentX, (h * 0.43) / extentY);
        camera.current.zoom = Math.max(0.45, Math.min(3.2, camera.current.zoom * k));
        needsFit.current = false;
        nodes.forEach((nd) => project(nd, cx, cy));
      }
    }

    const byId = new Map(nodes.map((nd) => [nd.id, nd]));
    const { selectedId: sel, highlightEdgeIds: hl, hiddenEdgeIds: hidden, dimmedNodeIds: dim, nodeColorOverride: override, relationships: rels } = live.current;

    // depth range, for fog
    let minZ = Infinity;
    let maxZ = -Infinity;
    nodes.forEach((nd) => {
      if (nd.sz < minZ) minZ = nd.sz;
      if (nd.sz > maxZ) maxZ = nd.sz;
    });
    const span = maxZ - minZ || 1;
    // Enough fog to read depth, but not so much that the outer shell dissolves into the page.
    const fogOf = (z: number) => Math.min(0.55, Math.max(0, (z - minZ) / span) * 0.62);

    const neighbours = new Set<string>();
    if (sel) {
      rels.forEach((r) => {
        if (r.source === sel) neighbours.add(r.target);
        if (r.target === sel) neighbours.add(r.source);
      });
    }

    // edges first, back to front
    const edges = rels
      .filter((r) => !hidden?.has(r.id))
      .map((r) => ({ r, a: byId.get(r.source), b: byId.get(r.target) }))
      .filter((e): e is { r: Relationship; a: Node3D; b: Node3D } => !!e.a && !!e.b)
      .sort((p, q) => (q.a.sz + q.b.sz) / 2 - (p.a.sz + p.b.sz) / 2);

    for (const { r, a, b } of edges) {
      const isPath = hl?.has(r.id) ?? false;
      const touchesSel = sel != null && (r.source === sel || r.target === sel);
      const fog = fogOf((a.sz + b.sz) / 2);

      let colour: string;
      let width: number;
      if (isPath) {
        colour = mixToward("#ea580c", BG, fog * 0.4);
        width = 2.6;
      } else if (touchesSel) {
        colour = mixToward("#eab308", BG, fog * 0.4);
        width = 2.2;
      } else {
        colour = mixToward("#94a3b8", BG, 0.25 + fog * 0.7);
        width = 1;
      }

      ctx.strokeStyle = colour;
      ctx.lineWidth = width * Math.min(1.4, (a.scale + b.scale) / 2);
      ctx.globalAlpha = sel && !touchesSel && !isPath ? 0.35 : 1;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // nodes back to front, so near ones overlap far ones
    const ordered = [...nodes].sort((p, q) => q.sz - p.sz);

    for (const nd of ordered) {
      const fog = fogOf(nd.sz);
      const base = override?.get(nd.id) ?? typeColor[nd.entity.type];
      const isSel = nd.id === sel;
      const isNeighbour = neighbours.has(nd.id);
      const dimmed = dim?.has(nd.id) ?? false;

      const r = nd.radius * nd.scale;
      if (!Number.isFinite(r) || !Number.isFinite(nd.sx) || !Number.isFinite(nd.sy) || r < 0.5) continue;

      ctx.globalAlpha = dimmed ? 0.16 : sel && !isSel && !isNeighbour ? 0.5 : 1;

      // Dimensional, not glossy. A soft top-lit gradient and a darker rim read as solid without
      // the specular dot and drop shadow that turn nodes into plastic marbles; the depth cues
      // that actually matter here are size and fog.
      const lit = mixToward(base, BG, fog * 0.62);
      const grad = ctx.createLinearGradient(nd.sx, nd.sy - r, nd.sx, nd.sy + r);
      grad.addColorStop(0, mixToward(lit, "#ffffff", 0.16));
      grad.addColorStop(1, shade(lit, 0.87));

      ctx.beginPath();
      ctx.fillStyle = grad;
      ctx.arc(nd.sx, nd.sy, r, 0, Math.PI * 2);
      ctx.fill();

      // Risk rides on the node's own border rather than a ring floating outside it, and only at
      // the top level. Most entities in a live case carry some flag, so ringing anything above
      // "low" turned the graph into a field of targets and told an officer nothing.
      const highRisk = nd.entity.riskLevel === "high" && !dimmed;
      ctx.beginPath();
      ctx.strokeStyle = highRisk
        ? mixToward(riskRing.high, BG, fog * 0.5)
        : mixToward(shade(base, 0.68), BG, fog * 0.55);
      ctx.lineWidth = Math.max(0.6, (highRisk ? 1.8 : 0.9) * nd.scale);
      ctx.arc(nd.sx, nd.sy, r, 0, Math.PI * 2);
      ctx.stroke();

      if (isSel) {
        ctx.beginPath();
        ctx.strokeStyle = "#0f2c4e";
        ctx.lineWidth = 1.5;
        ctx.arc(nd.sx, nd.sy, r + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // labels only for nearer / important nodes, so the ball stays readable
      const worthLabel = isSel || isNeighbour || nd.radius >= 12;
      if (worthLabel && !dimmed && nd.scale > 0.5) {
        ctx.globalAlpha = Math.min(1, Math.max(0.25, 1 - fog));
        ctx.font = `${isSel ? 600 : 400} ${Math.max(9, Math.min(12, 11 * nd.scale))}px ${LABEL_FONT}`;
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

  }, [project]);

  // Scheduling the next frame in a finally means one bad frame cannot kill the whole loop.
  const tick = useCallback(() => {
    try {
      draw();
    } finally {
      frameRef.current = requestAnimationFrame(tick);
    }
  }, [draw]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [tick]);

  // Re-frame whenever the pane resizes. Without this the first frame, which can land while the
  // pane is still collapsing into place, permanently decides the zoom.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      needsFit.current = true;
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // pointer: drag to orbit, click to select
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onDown = (e: PointerEvent) => {
      drag.current = { x: e.clientX, y: e.clientY, moved: false };
      canvas.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      camera.current.yaw += dx * 0.006;
      camera.current.pitch = Math.max(-1.3, Math.min(1.3, camera.current.pitch + dy * 0.006));
      d.x = e.clientX;
      d.y = e.clientY;
    };

    const onUp = (e: PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      if (!d || d.moved) return;

      // click: nearest node under the cursor, front-most wins
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let hit: Node3D | null = null;
      for (const nd of [...nodesRef.current].sort((p, q) => p.sz - q.sz)) {
        const r = nd.radius * nd.scale + 4;
        if (Math.hypot(nd.sx - mx, nd.sy - my) <= r) {
          hit = nd;
          break;
        }
      }
      onSelect(hit ? hit.id : null);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.current.zoom = Math.max(0.35, Math.min(3, camera.current.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
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
  }, [onSelect]);

  function toggleSpin() {
    spin.current = !spin.current;
    setAutoSpin(spin.current);
  }

  return (
    <>
      <div ref={wrapRef} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}>
        <canvas ref={canvasRef} style={{ display: "block", cursor: "grab", touchAction: "none" }} />
      </div>

      <div className="icon-dock icon-dock-bottom-left">
        <button
          className="icon-dock-btn"
          onClick={() => {
            camera.current = { yaw: 0.5, pitch: -0.25, zoom: 1 };
            needsFit.current = true;
          }}
          aria-label="Reset view"
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
            camera.current.zoom = Math.max(0.35, camera.current.zoom / 1.2);
          }}
          aria-label="Zoom out"
        >
          <IconMinus />
        </button>
        <button
          className={`icon-dock-btn ${autoSpin ? "active" : ""}`}
          onClick={toggleSpin}
          aria-label={autoSpin ? "Stop rotation" : "Start rotation"}
          title={autoSpin ? "Stop rotation" : "Start rotation"}
        >
          {autoSpin ? <IconPause3D /> : <IconPlay3D />}
        </button>
      </div>
    </>
  );
}

function IconPause3D() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="7" y="5.5" width="3.6" height="13" rx="0.8" />
      <rect x="13.4" y="5.5" width="3.6" height="13" rx="0.8" />
    </svg>
  );
}

function IconPlay3D() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M8 5.5v13l11-6.5Z" />
    </svg>
  );
}
