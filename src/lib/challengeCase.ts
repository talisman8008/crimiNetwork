import type { Entity, Relationship, TimelineEvent } from "../data/types";
import { computeCentrality } from "./centrality";

/**
 * Adversarial pass over a case: instead of asserting the network is correct, NETRA argues the
 * other side. It looks for the things a defence lawyer would — links resting on a single source,
 * a subject apparently in two places at once, a transaction with an innocent reading, assertions
 * no other record corroborates, and a suspect the maths ranks above the presumed primary — then
 * scores how well the case would hold up.
 *
 * Everything here is derived from the case's own records, so each challenge points back at the
 * evidence (or the absence of it) that raised it. Nothing is invented.
 */

export type ChallengeCategory =
  | "contradiction"
  | "weak-link"
  | "alternative-explanation"
  | "missing-evidence"
  | "alternative-suspect";

export interface Challenge {
  category: ChallengeCategory;
  finding: string;
  /** Entities the challenge concerns, for highlighting on the graph. */
  entityIds: string[];
  severity: "high" | "medium" | "low";
}

export interface CaseRobustness {
  /** 0–100. High means few unaddressed weaknesses; low means the case needs shoring up. */
  score: number;
  challenges: Challenge[];
  areasNeedingCorroboration: number;
}

const categoryLabel: Record<ChallengeCategory, string> = {
  contradiction: "Contradiction",
  "weak-link": "Weak link",
  "alternative-explanation": "Alternative explanation",
  "missing-evidence": "Missing evidence",
  "alternative-suspect": "Alternative suspect",
};

export function challengeCategoryLabel(c: ChallengeCategory): string {
  return categoryLabel[c];
}

const KM_PER_DEG = 111; // rough, good enough for "these are far apart"

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  // Flat approximation is fine at city scale and keeps this dependency-free.
  const dLat = (aLat - bLat) * KM_PER_DEG;
  const dLng = (aLng - bLng) * KM_PER_DEG * Math.cos((aLat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

function minutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function challengeCase(
  entities: Entity[],
  relationships: Relationship[],
  events: TimelineEvent[],
): CaseRobustness {
  const label = new Map(entities.map((e) => [e.id, e.label]));
  const nameOf = (id: string) => label.get(id) ?? id;
  const inCase = new Set(entities.map((e) => e.id));
  const rels = relationships.filter((r) => inCase.has(r.source) && inCase.has(r.target));

  const challenges: Challenge[] = [];

  // --- Weak links: a pair joined by a single relationship from a single source. A defence only
  //     has to discredit that one record to break the connection. ---
  const byPair = new Map<string, Relationship[]>();
  rels.forEach((r) => {
    const k = pairKey(r.source, r.target);
    (byPair.get(k) ?? byPair.set(k, []).get(k)!).push(r);
  });
  for (const [, group] of byPair) {
    if (group.length === 1) {
      const r = group[0];
      challenges.push({
        category: "weak-link",
        finding: `The link between ${nameOf(r.source)} and ${nameOf(r.target)} rests on a single ${r.evidenceSource} record.`,
        entityIds: [r.source, r.target],
        severity: r.weight <= 1 ? "high" : "medium",
      });
    }
  }

  // --- Contradictions: the same subject placed at two locations too far apart for the time
  //     between the sightings. ---
  const eventsByEntity = new Map<string, TimelineEvent[]>();
  events.forEach((ev) => {
    if (ev.lat == null || ev.lng == null) return;
    ev.entityIds.forEach((id) => {
      if (!inCase.has(id)) return;
      (eventsByEntity.get(id) ?? eventsByEntity.set(id, []).get(id)!).push(ev);
    });
  });
  for (const [id, evs] of eventsByEntity) {
    const sorted = [...evs].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1];
      const b = sorted[i];
      if (a.date !== b.date) continue;
      const dtMin = Math.abs(minutes(b.time) - minutes(a.time));
      const km = haversineKm(a.lat!, a.lng!, b.lat!, b.lng!);
      // Faster than ~90 km/h between two sightings is not plausible in a city.
      if (dtMin <= 60 && km > 1.5 * (dtMin / 60) * 90) {
        challenges.push({
          category: "contradiction",
          finding: `${nameOf(id)} is placed at ${a.locationLabel ?? "one location"} and ${b.locationLabel ?? "another"} within ${dtMin} min — too far apart to be both.`,
          entityIds: [id],
          severity: "high",
        });
        break; // one per subject is enough to raise the issue
      }
    }
  }

  // --- Alternative explanations: a financial link can have an innocent reading unless something
  //     ties it to the criminal activity. ---
  rels
    .filter((r) => r.type === "financial" || r.evidenceSource === "Financial Transactions")
    .forEach((r) => {
      challenges.push({
        category: "alternative-explanation",
        finding: `The transaction between ${nameOf(r.source)} and ${nameOf(r.target)} could have a legitimate business explanation.`,
        entityIds: [r.source, r.target],
        severity: "low",
      });
    });

  // --- Missing evidence: a relationship with no timeline event that puts the two together. ---
  const corroborated = new Set<string>();
  events.forEach((ev) => {
    for (let i = 0; i < ev.entityIds.length; i++) {
      for (let j = i + 1; j < ev.entityIds.length; j++) {
        corroborated.add(pairKey(ev.entityIds[i], ev.entityIds[j]));
      }
    }
  });
  for (const [k, group] of byPair) {
    if (group.length >= 2) continue; // multi-source links are already stronger
    if (!corroborated.has(k)) {
      const r = group[0];
      challenges.push({
        category: "missing-evidence",
        finding: `No location or call record corroborates the ${nameOf(r.source)}–${nameOf(r.target)} link independently.`,
        entityIds: [r.source, r.target],
        severity: "medium",
      });
    }
  }

  // --- Alternative suspect: the node the maths ranks highest by betweenness, offered as the
  //     figure the investigation might be under-weighting. ---
  const centrality = computeCentrality(entities, rels);
  const persons = entities.filter((e) => e.type === "person");
  const ranked = persons
    .map((p) => ({ p, b: centrality.get(p.id)?.betweenness ?? 0 }))
    .sort((x, y) => y.b - x.b);
  if (ranked.length >= 2 && ranked[0].b > 0) {
    const top = ranked[0];
    const runner = ranked[1];
    if (top.b > runner.b * 1.15) {
      challenges.push({
        category: "alternative-suspect",
        finding: `${top.p.label} holds a stronger network position than most named subjects — worth testing as a more central figure.`,
        entityIds: [top.p.id],
        severity: "medium",
      });
    }
  }

  // Curate rather than exhaust: a defence brief that lists forty near-identical weak links
  // persuades no one. Keep the most damaging couple per front, strongest first, so the panel
  // reads as a sharp critique.
  const sevRank: Record<Challenge["severity"], number> = { high: 0, medium: 1, low: 2 };
  const perCategoryCap: Record<ChallengeCategory, number> = {
    contradiction: 2,
    "weak-link": 2,
    "missing-evidence": 2,
    "alternative-explanation": 1,
    "alternative-suspect": 1,
  };
  const order: ChallengeCategory[] = [
    "contradiction",
    "weak-link",
    "missing-evidence",
    "alternative-explanation",
    "alternative-suspect",
  ];

  const curated: Challenge[] = [];
  for (const cat of order) {
    const inCat = challenges
      .filter((c) => c.category === cat)
      .sort((a, b) => sevRank[a.severity] - sevRank[b.severity])
      .slice(0, perCategoryCap[cat]);
    curated.push(...inCat);
  }

  // Score off the curated set with a saturating penalty, so a case with real weaknesses lands in
  // a credible 60s–80s rather than bottoming out. Deterministic for a given case.
  const penalty: Record<Challenge["severity"], number> = { high: 7, medium: 4, low: 2 };
  const raw = curated.reduce((acc, c) => acc + penalty[c.severity], 0);
  const score = Math.max(48, Math.min(96, 100 - Math.min(raw, 42)));

  const areas = new Set(curated.map((c) => c.category)).size;

  return { score, challenges: curated, areasNeedingCorroboration: areas };
}
