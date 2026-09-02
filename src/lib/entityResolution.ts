import type { Entity, PersonEntity } from "../data/types";

/**
 * Candidate duplicate detection for human-in-the-loop entity resolution.
 *
 * Records arrive from separate source systems (CCTNS, telecom subscriber data, bank KYC) that
 * spell the same person's name differently, so the same individual can exist several times over.
 * This scores pairs of person records on the evidence an investigator would actually weigh:
 * name similarity, matching date of birth, shared last-known location, and alias overlap.
 *
 * Nothing here merges anything. It only proposes; an investigator decides.
 */

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein edit distance, used for catching transliteration variants (Arvind / Aravind). */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) dist[i][0] = i;
  for (let j = 0; j < cols; j++) dist[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(dist[i - 1][j] + 1, dist[i][j - 1] + 1, dist[i - 1][j - 1] + cost);
    }
  }
  return dist[rows - 1][cols - 1];
}

function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - editDistance(a, b) / longest;
}

/** Compares names token by token so "S. Kadam" can still match "Suresh Kadam" on the surname
 *  plus a leading initial, which is how abbreviated telecom records usually arrive. */
function nameSimilarity(a: string, b: string): number {
  const tokensA = normalise(a).split(" ");
  const tokensB = normalise(b).split(" ");

  const surnameScore = similarity(tokensA[tokensA.length - 1], tokensB[tokensB.length - 1]);

  const firstA = tokensA[0];
  const firstB = tokensB[0];
  let firstScore: number;
  if (firstA.length === 1 || firstB.length === 1) {
    // one side is an initial: credit a match only if the initials agree
    firstScore = firstA[0] === firstB[0] ? 0.8 : 0;
  } else {
    firstScore = similarity(firstA, firstB);
  }

  // a hyphenated or added surname (Kulkarni -> Kulkarni-Deshpande) should still score well
  const containment =
    normalise(a).includes(normalise(b)) || normalise(b).includes(normalise(a)) ? 0.85 : 0;

  return Math.max(containment, surnameScore * 0.6 + firstScore * 0.4);
}

export interface MatchSignal {
  label: string;
  detail: string;
  supports: boolean;
}

export interface MergeCandidate {
  id: string;
  primary: PersonEntity;
  duplicate: PersonEntity;
  confidence: number;
  signals: MatchSignal[];
}

function isPerson(e: Entity): e is PersonEntity {
  return e.type === "person";
}

export function findMergeCandidates(entities: Entity[]): MergeCandidate[] {
  const people = entities.filter(isPerson);
  const candidates: MergeCandidate[] = [];

  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const a = people[i];
      const b = people[j];

      const nameScore = nameSimilarity(a.label, b.label);
      if (nameScore < 0.55) continue;

      const signals: MatchSignal[] = [];
      let score = nameScore * 0.5;

      signals.push({
        label: "Name similarity",
        detail: `"${a.label}" vs "${b.label}" — ${Math.round(nameScore * 100)}% match`,
        supports: nameScore >= 0.7,
      });

      if (a.dob && b.dob) {
        const sameDob = a.dob === b.dob;
        if (sameDob) score += 0.3;
        signals.push({
          label: "Date of birth",
          detail: sameDob ? `Both recorded as ${a.dob}` : `${a.dob} vs ${b.dob} — no match`,
          supports: sameDob,
        });
      }

      if (a.lastKnownLocation && b.lastKnownLocation) {
        const sameArea = normalise(a.lastKnownLocation) === normalise(b.lastKnownLocation);
        if (sameArea) score += 0.15;
        signals.push({
          label: "Last known location",
          detail: sameArea
            ? `Both at ${a.lastKnownLocation}`
            : `${a.lastKnownLocation} vs ${b.lastKnownLocation}`,
          supports: sameArea,
        });
      }

      if (a.sex && b.sex) {
        const sameSex = a.sex === b.sex;
        if (!sameSex) score -= 0.4;
        signals.push({
          label: "Sex",
          detail: sameSex ? `Both recorded ${a.sex}` : `${a.sex} vs ${b.sex} — conflicting`,
          supports: sameSex,
        });
      }

      const aliasHit = (a.aliases ?? []).some((alias) =>
        (b.aliases ?? []).concat(b.label).some((other) => nameSimilarity(alias, other) > 0.8),
      );
      if (aliasHit) {
        score += 0.1;
        signals.push({ label: "Alias overlap", detail: "A recorded alias matches the other record", supports: true });
      }

      const sharedCase = a.caseIds.some((c) => b.caseIds.includes(c));
      if (sharedCase) {
        score += 0.05;
        signals.push({ label: "Case overlap", detail: "Both records appear in the same investigation", supports: true });
      }

      const confidence = Math.max(0, Math.min(1, score));
      if (confidence < 0.5) continue;

      // the record carrying more corroborated detail is proposed as the one to keep
      const aDetail = (a.aliases?.length ?? 0) + (a.dob ? 1 : 0) + (a.notes ? 1 : 0) + a.tags.length;
      const bDetail = (b.aliases?.length ?? 0) + (b.dob ? 1 : 0) + (b.notes ? 1 : 0) + b.tags.length;
      const [primary, duplicate] = aDetail >= bDetail ? [a, b] : [b, a];

      candidates.push({
        id: `${primary.id}--${duplicate.id}`,
        primary,
        duplicate,
        confidence,
        signals,
      });
    }
  }

  return candidates.sort((x, y) => y.confidence - x.confidence);
}

export type MergeDecision = "approved" | "rejected";
