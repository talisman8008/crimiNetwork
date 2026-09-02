import type { Entity, Relationship } from "../data/types";

/**
 * Community detection over the case network, using the local-moving phase of the Louvain method
 * (greedy modularity optimisation).
 *
 * A criminal network is rarely one flat web: it separates into sub-groups that talk mostly among
 * themselves — a transport crew, a set of shell companies, a family circle. Finding those
 * clusters tells an investigator where the natural operational units sit, and which people
 * bridge between them.
 *
 * Modularity measures how much more densely connected each group is than chance would predict.
 * Roughly: below 0.3 the split is weak, above 0.4 it is a genuinely modular network.
 */

interface Graph {
  ids: string[];
  index: Map<string, number>;
  /** adjacency[i] = list of [neighbourIndex, weight] */
  adjacency: [number, number][][];
  degree: number[];
  totalWeight: number;
}

function buildGraph(entities: Entity[], relationships: Relationship[]): Graph {
  const ids = entities.map((e) => e.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const adjacency: [number, number][][] = ids.map(() => []);
  const degree = new Array<number>(ids.length).fill(0);
  let totalWeight = 0;

  // collapse parallel edges (a pair corroborated by two sources) into one weighted edge
  const pairWeight = new Map<string, number>();
  for (const r of relationships) {
    const a = index.get(r.source);
    const b = index.get(r.target);
    if (a === undefined || b === undefined || a === b) continue;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    pairWeight.set(key, (pairWeight.get(key) ?? 0) + 1);
  }

  for (const [key, w] of pairWeight) {
    const [a, b] = key.split("-").map(Number);
    adjacency[a].push([b, w]);
    adjacency[b].push([a, w]);
    degree[a] += w;
    degree[b] += w;
    totalWeight += w;
  }

  return { ids, index, adjacency, degree, totalWeight };
}

/** Modularity of a given partition, standard Newman-Girvan formulation. */
function modularity(graph: Graph, community: number[]): number {
  const m = graph.totalWeight;
  if (m === 0) return 0;

  const internal = new Map<number, number>();
  const totalDegree = new Map<number, number>();

  for (let i = 0; i < graph.ids.length; i++) {
    const ci = community[i];
    totalDegree.set(ci, (totalDegree.get(ci) ?? 0) + graph.degree[i]);
    for (const [j, w] of graph.adjacency[i]) {
      if (community[j] === ci) internal.set(ci, (internal.get(ci) ?? 0) + w);
    }
  }

  let q = 0;
  for (const [c, deg] of totalDegree) {
    const inW = (internal.get(c) ?? 0) / 2; // each internal edge counted twice
    q += inW / m - (deg / (2 * m)) ** 2;
  }
  return q;
}

/** Greedy local moving: repeatedly move each node into the neighbouring community that gives
 *  the largest modularity gain, until nothing improves. */
function louvainLocalMoving(graph: Graph): number[] {
  const n = graph.ids.length;
  const community = Array.from({ length: n }, (_, i) => i);
  const m = graph.totalWeight;
  if (m === 0) return community;

  const communityDegree = [...graph.degree];

  let improved = true;
  let guard = 0;
  while (improved && guard < 50) {
    improved = false;
    guard++;

    for (let i = 0; i < n; i++) {
      const current = community[i];
      communityDegree[current] -= graph.degree[i];

      // weight from i into each neighbouring community
      const weightTo = new Map<number, number>();
      for (const [j, w] of graph.adjacency[i]) {
        if (j === i) continue;
        weightTo.set(community[j], (weightTo.get(community[j]) ?? 0) + w);
      }

      let best = current;
      let bestGain = (weightTo.get(current) ?? 0) - (communityDegree[current] * graph.degree[i]) / (2 * m);

      for (const [c, w] of weightTo) {
        const gain = w - (communityDegree[c] * graph.degree[i]) / (2 * m);
        // deterministic tie-break on the lower community id keeps runs reproducible
        if (gain > bestGain || (gain === bestGain && c < best)) {
          bestGain = gain;
          best = c;
        }
      }

      communityDegree[best] += graph.degree[i];
      if (best !== current) {
        community[i] = best;
        improved = true;
      }
    }
  }

  return community;
}

export interface Community {
  id: number;
  entityIds: string[];
  /** Members ordered by how connected they are inside this cluster. */
  coreEntityIds: string[];
  /** Links that stay inside the cluster vs. those reaching out of it. */
  internalLinks: number;
  externalLinks: number;
  label: string;
}

export interface CommunityResult {
  communities: Community[];
  /** entity id -> community id */
  assignment: Map<string, number>;
  modularity: number;
}

/** Builds a human-readable name from what the cluster is mostly made of. */
function labelFor(members: Entity[], core: Entity[]): string {
  const lead = core[0];
  if (!lead) return "Unnamed cluster";

  const orgs = members.filter((m) => m.type === "organization");
  // a place other than the lead itself, so the name never repeats the same entity twice
  const place = members.find((m) => m.type === "location" && m.id !== lead.id);

  if (orgs.length >= 2) return `${orgs[0].label} corporate cluster`;
  if (lead.type === "organization") return `${lead.label} operation`;
  if (lead.type === "location") return `${lead.label} group`;
  if (place) return `${lead.label} / ${place.label} group`;
  if (members.length === 1) return `${lead.label} (unlinked)`;
  return `${lead.label} circle`;
}

export function detectCommunities(entities: Entity[], relationships: Relationship[]): CommunityResult {
  const graph = buildGraph(entities, relationships);
  const raw = louvainLocalMoving(graph);
  const q = modularity(graph, raw);

  // renumber communities to a dense 0..k range, largest first
  const groups = new Map<number, number[]>();
  raw.forEach((c, i) => {
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c)!.push(i);
  });

  const ordered = [...groups.values()].sort((a, b) => b.length - a.length);
  const byId = new Map(entities.map((e) => [e.id, e]));
  const assignment = new Map<string, number>();
  const communities: Community[] = [];

  ordered.forEach((memberIdx, communityId) => {
    const memberSet = new Set(memberIdx);
    const entityIds = memberIdx.map((i) => graph.ids[i]);
    entityIds.forEach((id) => assignment.set(id, communityId));

    let internal = 0;
    let external = 0;
    const insideDegree = new Map<string, number>();

    for (const i of memberIdx) {
      let inside = 0;
      for (const [j, w] of graph.adjacency[i]) {
        if (memberSet.has(j)) {
          internal += w;
          inside += w;
        } else {
          external += w;
        }
      }
      insideDegree.set(graph.ids[i], inside);
    }

    const core = [...entityIds]
      .sort((a, b) => (insideDegree.get(b) ?? 0) - (insideDegree.get(a) ?? 0))
      .map((id) => byId.get(id))
      .filter((e): e is Entity => !!e);

    const members = entityIds.map((id) => byId.get(id)).filter((e): e is Entity => !!e);

    communities.push({
      id: communityId,
      entityIds,
      coreEntityIds: core.slice(0, 3).map((e) => e.id),
      internalLinks: internal / 2,
      externalLinks: external,
      label: labelFor(members, core),
    });
  });

  return { communities, assignment, modularity: q };
}

/** Distinct, colour-blind-safe hues for cluster shading. */
export const communityColors = [
  "#2563eb",
  "#d97706",
  "#0d9488",
  "#7c3aed",
  "#e11d48",
  "#16a34a",
  "#0891b2",
  "#c026d3",
];

export function communityColor(id: number): string {
  return communityColors[id % communityColors.length];
}
