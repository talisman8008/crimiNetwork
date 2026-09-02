import { useEffect, useRef } from "react";
import { DataSet } from "vis-data";
import { Network } from "vis-network";
import type { Edge, Node } from "vis-network";
import type { Entity, EntityType, Relationship } from "../data/types";
import { IconMinus, IconPlus, IconTarget } from "./icons";

const typeColor: Record<EntityType, { bg: string; border: string }> = {
  person: { bg: "#2563eb", border: "#1e40af" },
  organization: { bg: "#d97706", border: "#92400e" },
  location: { bg: "#0d9488", border: "#115e59" },
  vehicle: { bg: "#7c3aed", border: "#5b21b6" },
  phone: { bg: "#e11d48", border: "#9f1239" },
};

const riskRing: Record<string, string> = {
  high: "#b91c1c",
  medium: "#b45309",
  low: "#cbd5e1",
};

const edgeDefault = { color: "#cbd5e1", highlight: "#eab308", hover: "#fde68a" };
const edgeHighlight = { color: "#ea580c", highlight: "#ea580c", hover: "#ea580c" };

function edgeWidth(weight: number): number {
  return 1 + Math.min(weight, 20) / 6;
}

interface RadialPoint {
  x: number;
  y: number;
}

const RING_SPACING = 150;

/**
 * Lays entities out as a radial "hub and spoke" tree: the most-connected entity sits at the
 * centre, and everything else fans outward across concentric rings by BFS distance from it.
 * Each node gets an angular slice proportional to how many descendants it has, so dense
 * branches fan out wide and thin branches stay narrow (a standard radial-tree layout).
 */
function computeRadialLayout(entities: Entity[], relationships: Relationship[]): { positions: Map<string, RadialPoint>; hubId: string | null } {
  const positions = new Map<string, RadialPoint>();
  if (entities.length === 0) return { positions, hubId: null };

  const adjacency = new Map<string, Set<string>>();
  entities.forEach((e) => adjacency.set(e.id, new Set()));
  relationships.forEach((r) => {
    adjacency.get(r.source)?.add(r.target);
    adjacency.get(r.target)?.add(r.source);
  });

  let hub = entities[0];
  let hubDegree = -1;
  entities.forEach((e) => {
    const d = adjacency.get(e.id)?.size ?? 0;
    if (d > hubDegree) {
      hubDegree = d;
      hub = e;
    }
  });

  const parent = new Map<string, string | null>();
  const children = new Map<string, string[]>();
  const depth = new Map<string, number>();
  const visited = new Set<string>([hub.id]);
  parent.set(hub.id, null);
  depth.set(hub.id, 0);
  children.set(hub.id, []);

  const queue: string[] = [hub.id];
  while (queue.length) {
    const current = queue.shift()!;
    const neighbors = [...(adjacency.get(current) ?? [])].sort();
    for (const n of neighbors) {
      if (visited.has(n)) continue;
      visited.add(n);
      parent.set(n, current);
      depth.set(n, (depth.get(current) ?? 0) + 1);
      children.set(n, []);
      children.get(current)!.push(n);
      queue.push(n);
    }
  }

  const leafCount = new Map<string, number>();
  function countLeaves(id: string): number {
    const kids = children.get(id) ?? [];
    const total = kids.length === 0 ? 1 : kids.reduce((sum, k) => sum + countLeaves(k), 0);
    leafCount.set(id, total);
    return total;
  }
  countLeaves(hub.id);

  positions.set(hub.id, { x: 0, y: 0 });

  function assignAngles(id: string, start: number, span: number) {
    const kids = children.get(id) ?? [];
    if (kids.length === 0) return;
    let cursor = start;
    for (const kid of kids) {
      const share = ((leafCount.get(kid) ?? 1) / (leafCount.get(id) ?? 1)) * span;
      const mid = cursor + share / 2;
      const r = (depth.get(kid) ?? 1) * RING_SPACING;
      positions.set(kid, { x: r * Math.cos(mid), y: r * Math.sin(mid) });
      assignAngles(kid, cursor, share);
      cursor += share;
    }
  }
  assignAngles(hub.id, 0, Math.PI * 2);

  // entities in a separate connected component from the hub: park them on an outer holding ring
  const unreached = entities.filter((e) => !visited.has(e.id));
  const maxDepth = Math.max(0, ...[...depth.values()]);
  const fallbackRadius = (maxDepth + 2) * RING_SPACING;
  unreached.forEach((e, i) => {
    const a = (i / Math.max(unreached.length, 1)) * Math.PI * 2;
    positions.set(e.id, { x: fallbackRadius * Math.cos(a), y: fallbackRadius * Math.sin(a) });
  });

  return { positions, hubId: hub.id };
}

interface GraphViewProps {
  entities: Entity[];
  relationships: Relationship[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  highlightEdgeIds?: Set<string>;
  /** Edges to withhold from view — used by the timeline so the layout stays put while time advances. */
  hiddenEdgeIds?: Set<string>;
  /** Nodes to fade back because nothing connects to them yet at the current point in time. */
  dimmedNodeIds?: Set<string>;
  /** Recolours nodes by detected community instead of by entity type. */
  nodeColorOverride?: Map<string, string>;
}

export default function GraphView({
  entities,
  relationships,
  selectedId,
  onSelect,
  highlightEdgeIds,
  hiddenEdgeIds,
  dimmedNodeIds,
  nodeColorOverride,
}: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const edgesRef = useRef<DataSet<Edge> | null>(null);
  const nodesRef = useRef<DataSet<Node> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const degree = new Map<string, number>();
    relationships.forEach((r) => {
      degree.set(r.source, (degree.get(r.source) ?? 0) + 1);
      degree.set(r.target, (degree.get(r.target) ?? 0) + 1);
    });

    const { positions, hubId } = computeRadialLayout(entities, relationships);

    const nodes = new DataSet<Node>(
      entities.map((e) => {
        const d = degree.get(e.id) ?? 0;
        const base = typeColor[e.type];
        const override = nodeColorOverride?.get(e.id);
        const colors = override ? { bg: override, border: override } : base;
        const isHub = e.id === hubId;
        const pos = positions.get(e.id);
        return {
          id: e.id,
          label: e.label,
          shape: "dot",
          size: (isHub ? 19 : 13) + Math.min(d, 8) * 2.2,
          x: pos?.x,
          y: pos?.y,
          color: {
            background: colors.bg,
            border: riskRing[e.riskLevel],
            highlight: { background: colors.bg, border: isHub ? "#cbd5e1" : "#ca8a04" },
          },
          borderWidth: e.riskLevel === "high" ? 3 : 2,
          shadow: {
            enabled: true,
            color: isHub ? "rgba(255, 255, 255, 0.9)" : "rgba(234, 179, 8, 0.2)",
            size: isHub ? 16 : 7,
            x: 0,
            y: 0,
          },
          opacity: dimmedNodeIds?.has(e.id) ? 0.18 : 1,
          font: { color: "#1e293b", face: "Segoe UI, Arial, sans-serif", size: 12, vadjust: -2 },
        };
      }),
    );
    nodesRef.current = nodes;

    const edges = new DataSet<Edge>(
      relationships.map((r) => {
        const isPath = highlightEdgeIds?.has(r.id) ?? false;
        return {
          id: r.id,
          from: r.source,
          to: r.target,
          width: isPath ? 3.5 : edgeWidth(r.weight),
          color: isPath ? edgeHighlight : edgeDefault,
          smooth: { enabled: true, type: "continuous", roundness: 0.25 },
          shadow: isPath ? { enabled: true, color: "rgba(234, 88, 12, 0.35)", size: 8, x: 0, y: 0 } : false,
          hidden: hiddenEdgeIds?.has(r.id) ?? false,
          title: `${r.type}: ${r.description}`,
        };
      }),
    );
    edgesRef.current = edges;

    const network = new Network(
      containerRef.current,
      { nodes, edges },
      {
        autoResize: true,
        height: "100%",
        physics: false,
        interaction: { hover: true, tooltipDelay: 150, dragView: true, zoomView: true, dragNodes: true },
        nodes: {
          chosen: {
            node: (values, id, selected, hovering) => {
              if (selected || hovering) {
                const isHubNode = id === hubId;
                values.shadowSize = isHubNode ? 20 : 14;
                values.shadowColor = isHubNode ? "rgba(255, 255, 255, 0.95)" : "rgba(234, 179, 8, 0.45)";
                values.borderWidth = (values.borderWidth ?? 2) + 1;
              }
            },
            label: false,
          },
        },
        edges: { arrows: { to: false } },
      },
    );

    network.on("click", (params) => {
      if (params.nodes.length > 0) {
        onSelect(params.nodes[0] as string);
      } else {
        onSelect(null);
      }
    });

    network.fit();

    networkRef.current = network;

    return () => {
      network.destroy();
      networkRef.current = null;
      edgesRef.current = null;
      nodesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities, relationships]);

  // Timeline scrubbing toggles edge visibility and node dimming in place, so the radial layout
  // stays fixed and you watch links appear rather than the whole graph rearranging itself.
  useEffect(() => {
    const edgesDS = edgesRef.current;
    if (!edgesDS) return;
    edgesDS.update(relationships.map((r) => ({ id: r.id, hidden: hiddenEdgeIds?.has(r.id) ?? false })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenEdgeIds]);

  useEffect(() => {
    const nodesDS = nodesRef.current;
    if (!nodesDS) return;
    nodesDS.update(entities.map((e) => ({ id: e.id, opacity: dimmedNodeIds?.has(e.id) ? 0.18 : 1 })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimmedNodeIds]);

  // Recolouring by community happens in place so the layout does not rebuild.
  useEffect(() => {
    const nodesDS = nodesRef.current;
    if (!nodesDS) return;
    nodesDS.update(
      entities.map((e) => {
        const override = nodeColorOverride?.get(e.id);
        const base = typeColor[e.type];
        const bg = override ?? base.bg;
        return {
          id: e.id,
          color: {
            background: bg,
            border: override ?? riskRing[e.riskLevel],
            highlight: { background: bg, border: override ?? "#1d4ed8" },
          },
        };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeColorOverride]);

  useEffect(() => {
    const network = networkRef.current;
    if (!network) return;
    if (selectedId) {
      network.selectNodes([selectedId]);
    } else {
      network.unselectAll();
    }
  }, [selectedId]);

  useEffect(() => {
    const edgesDS = edgesRef.current;
    if (!edgesDS) return;
    edgesDS.update(
      relationships.map((r) => {
        const isPath = highlightEdgeIds?.has(r.id) ?? false;
        return {
          id: r.id,
          width: isPath ? 3.5 : edgeWidth(r.weight),
          color: isPath ? edgeHighlight : edgeDefault,
          shadow: isPath ? { enabled: true, color: "rgba(234, 88, 12, 0.35)", size: 8, x: 0, y: 0 } : false,
        };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightEdgeIds]);

  function recenter() {
    networkRef.current?.fit({ animation: { duration: 300, easingFunction: "easeInOutQuad" } });
  }

  function zoomBy(factor: number) {
    const network = networkRef.current;
    if (!network) return;
    network.moveTo({ scale: network.getScale() * factor, animation: { duration: 200, easingFunction: "easeInOutQuad" } });
  }

  return (
    <>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <div className="icon-dock icon-dock-bottom-left">
        <button className="icon-dock-btn" onClick={recenter} aria-label="Recenter graph">
          <IconTarget />
        </button>
        <button className="icon-dock-btn" onClick={() => zoomBy(1.3)} aria-label="Zoom in">
          <IconPlus />
        </button>
        <button className="icon-dock-btn" onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out">
          <IconMinus />
        </button>
      </div>
    </>
  );
}
