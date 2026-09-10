import type { Relationship } from "../data/types";

export interface PathResult {
  entityIds: string[];
  relationshipIds: string[];
}

export function findShortestPath(
  relationships: Relationship[],
  fromId: string,
  toId: string,
): PathResult | null {
  if (fromId === toId) return { entityIds: [fromId], relationshipIds: [] };

  const adjacency = new Map<string, { neighbor: string; relId: string }[]>();
  for (const r of relationships) {
    if (!adjacency.has(r.source)) adjacency.set(r.source, []);
    if (!adjacency.has(r.target)) adjacency.set(r.target, []);
    adjacency.get(r.source)!.push({ neighbor: r.target, relId: r.id });
    adjacency.get(r.target)!.push({ neighbor: r.source, relId: r.id });
  }

  const visited = new Set<string>([fromId]);
  const cameFrom = new Map<string, { from: string; relId: string }>();
  const queue: string[] = [fromId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === toId) break;
    for (const edge of adjacency.get(current) ?? []) {
      if (visited.has(edge.neighbor)) continue;
      visited.add(edge.neighbor);
      cameFrom.set(edge.neighbor, { from: current, relId: edge.relId });
      queue.push(edge.neighbor);
    }
  }

  if (!visited.has(toId)) return null;

  const entityIds: string[] = [toId];
  const relationshipIds: string[] = [];
  let cursor = toId;
  while (cursor !== fromId) {
    const step = cameFrom.get(cursor);
    if (!step) return null;
    relationshipIds.unshift(step.relId);
    entityIds.unshift(step.from);
    cursor = step.from;
  }

  return { entityIds, relationshipIds };
}
