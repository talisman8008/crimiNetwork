import { alerts, cases, crossCaseEntities, entitiesForCase } from "../data/mockData";
import { courtDatesForCase } from "../data/courtData";
import type { Case } from "../data/types";

/**
 * Where an investigator should start. Rather than leaving them to scan every case, NETRA ranks
 * the caseload by what is actually pressing right now — unactioned high-severity alerts, a
 * hearing bearing down, subjects that span more than one case — and says, in a line, why each
 * case is near the top. The score is deterministic, so the order is stable between visits.
 */

export interface CasePriority {
  case: Case;
  score: number;
  reasons: string[];
  nextHearingInDays: number | null;
  openHighAlerts: number;
}

const NOW = new Date("2026-09-15"); // demo "today"; a real build would use Date.now()

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  return Math.round((d.getTime() - NOW.getTime()) / (1000 * 60 * 60 * 24));
}

export function prioritisedCases(): CasePriority[] {
  const crossIds = new Set(crossCaseEntities().map((e) => e.id));

  const ranked = cases.map((c) => {
    const caseAlerts = alerts.filter((a) => a.caseId === c.id && a.status !== "dismissed");
    const openHighAlerts = caseAlerts.filter((a) => a.severity === "high").length;
    const openMedAlerts = caseAlerts.filter((a) => a.severity === "medium").length;

    const upcoming = courtDatesForCase(c.id)
      .filter((h) => h.status === "upcoming")
      .map((h) => daysUntil(h.date))
      .filter((d) => d >= 0)
      .sort((a, b) => a - b);
    const nextHearingInDays = upcoming.length ? upcoming[0] : null;

    const crossInCase = entitiesForCase(c.id).filter((e) => crossIds.has(e.id)).length;

    let score = 0;
    const reasons: string[] = [];

    score += openHighAlerts * 3;
    if (openHighAlerts > 0) reasons.push(`${openHighAlerts} high-severity alert${openHighAlerts === 1 ? "" : "s"} unactioned`);

    score += openMedAlerts;

    if (nextHearingInDays != null && nextHearingInDays <= 14) {
      score += 6 - Math.min(6, Math.floor(nextHearingInDays / 3));
      const when =
        nextHearingInDays === 0
          ? "hearing today"
          : nextHearingInDays === 1
            ? "hearing tomorrow"
            : `hearing in ${nextHearingInDays} days`;
      reasons.push(when);
    }

    if (crossInCase > 0) {
      score += crossInCase;
      reasons.push(`${crossInCase} subject${crossInCase === 1 ? "" : "s"} span another case`);
    }

    if (c.priority === "high") score += 2;

    if (reasons.length === 0) reasons.push("steady — no pressing items");

    return { case: c, score, reasons, nextHearingInDays, openHighAlerts };
  });

  return ranked.sort((a, b) => b.score - a.score);
}
