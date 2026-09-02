import type { Entity, Relationship } from "../data/types";

/**
 * Graph-theoretic "importance" scoring for entities — the maths behind the "why does this
 * person matter" explanations. Three complementary measures, computed over an unweighted,
 * undirected graph built from the given entities and relationships:
 *
 *  - Degree centrality: how many entities this one is directly linked to.
 *  - Betweenness centrality (Brandes' algorithm): how often this entity sits on the shortest
 *    path between two others. High betweenness means removing the entity would fragment the
 *    network into disconnected clusters — a "bridge" or broker, even if not the most connected.
 *  - PageRank: influence that accounts for who you're connected to, not just how many —
 *    a link from a well-connected entity counts for more than a link from a peripheral one.
 */

function buildAdjacency(entities: Entity[], relationships: Relationship[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  entities.forEach((e) => adjacency.set(e.id, []));
  relationships.forEach((r) => {
    if (!adjacency.has(r.source) || !adjacency.has(r.target)) return;
    adjacency.get(r.source)!.push(r.target);
    adjacency.get(r.target)!.push(r.source);
  });
  return adjacency;
}

function degreeCentrality(entities: Entity[], adjacency: Map<string, string[]>): Map<string, number> {
  const result = new Map<string, number>();
  entities.forEach((e) => result.set(e.id, adjacency.get(e.id)?.length ?? 0));
  return result;
}

/** Brandes' algorithm for betweenness centrality on an unweighted, undirected graph. O(V*E). */
function betweennessCentrality(entities: Entity[], adjacency: Map<string, string[]>): Map<string, number> {
  const ids = entities.map((e) => e.id);
  const C = new Map<string, number>(ids.map((id) => [id, 0]));

  for (const s of ids) {
    const stack: string[] = [];
    const predecessors = new Map<string, string[]>(ids.map((id) => [id, []]));
    const sigma = new Map<string, number>(ids.map((id) => [id, 0]));
    sigma.set(s, 1);
    const dist = new Map<string, number>(ids.map((id) => [id, -1]));
    dist.set(s, 0);
    const queue: string[] = [s];

    while (queue.length > 0) {
      const v = queue.shift()!;
      stack.push(v);
      for (const w of adjacency.get(v) ?? []) {
        if (dist.get(w) === -1) {
          dist.set(w, (dist.get(v) ?? 0) + 1);
          queue.push(w);
        }
        if (dist.get(w) === (dist.get(v) ?? 0) + 1) {
          sigma.set(w, (sigma.get(w) ?? 0) + (sigma.get(v) ?? 0));
          predecessors.get(w)!.push(v);
        }
      }
    }

    const delta = new Map<string, number>(ids.map((id) => [id, 0]));
    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of predecessors.get(w) ?? []) {
        const share = ((sigma.get(v) ?? 0) / (sigma.get(w) || 1)) * (1 + (delta.get(w) ?? 0));
        delta.set(v, (delta.get(v) ?? 0) + share);
      }
      if (w !== s) {
        C.set(w, (C.get(w) ?? 0) + (delta.get(w) ?? 0));
      }
    }
  }

  // each shortest path was counted from both endpoints in an undirected graph
  for (const id of ids) C.set(id, (C.get(id) ?? 0) / 2);
  return C;
}

/** Simple power-iteration PageRank over the same undirected graph (edges treated as reciprocal links). */
function pageRank(entities: Entity[], adjacency: Map<string, string[]>, damping = 0.85, iterations = 60): Map<string, number> {
  const ids = entities.map((e) => e.id);
  const n = ids.length || 1;
  let ranks = new Map<string, number>(ids.map((id) => [id, 1 / n]));

  for (let iter = 0; iter < iterations; iter++) {
    const next = new Map<string, number>(ids.map((id) => [id, (1 - damping) / n]));
    let danglingMass = 0;

    for (const id of ids) {
      const neighbors = adjacency.get(id) ?? [];
      if (neighbors.length === 0) {
        danglingMass += ranks.get(id) ?? 0;
        continue;
      }
      const share = (ranks.get(id) ?? 0) / neighbors.length;
      for (const neighbor of neighbors) {
        next.set(neighbor, (next.get(neighbor) ?? 0) + damping * share);
      }
    }

    if (danglingMass > 0) {
      for (const id of ids) next.set(id, (next.get(id) ?? 0) + (damping * danglingMass) / n);
    }

    ranks = next;
  }

  return ranks;
}

export interface CentralityScores {
  degree: number;
  betweenness: number;
  pageRank: number;
}

export function computeCentrality(entities: Entity[], relationships: Relationship[]): Map<string, CentralityScores> {
  const adjacency = buildAdjacency(entities, relationships);
  const degree = degreeCentrality(entities, adjacency);
  const betweenness = betweennessCentrality(entities, adjacency);
  const rank = pageRank(entities, adjacency);

  const result = new Map<string, CentralityScores>();
  entities.forEach((e) => {
    result.set(e.id, {
      degree: degree.get(e.id) ?? 0,
      betweenness: betweenness.get(e.id) ?? 0,
      pageRank: rank.get(e.id) ?? 0,
    });
  });
  return result;
}
