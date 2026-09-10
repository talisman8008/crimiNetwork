import {
  entitiesForCase,
  getCaseById,
  relationshipsForCase,
} from "../data/mockData";
import { officersForCase } from "../data/officersData";
import { courtDatesForCase } from "../data/courtData";
import { alerts } from "../data/mockData";
import { formatDate } from "../components/ui";
import type { PersonEntity } from "../data/types";

export const suggestedPrompts = [
  "Who are the suspects?",
  "Which entities are high risk?",
  "What's the next court date?",
  "Any open alerts?",
  "Who holds the network together?",
  "What sections is this case charged under?",
];

function list(items: string[], empty: string): string {
  return items.length ? items.map((i) => `• ${i}`).join("\n") : empty;
}

export function answerQuestion(caseId: string, questionRaw: string): string {
  const q = questionRaw.toLowerCase();
  const c = getCaseById(caseId);
  if (!c) return "Select a case first so I know which record set to search.";

  const caseEntities = entitiesForCase(caseId);
  const caseRelationships = relationshipsForCase(caseId);
  const caseAlerts = alerts.filter((a) => a.caseId === caseId);
  const team = officersForCase(caseId);
  const hearings = courtDatesForCase(caseId);

  if (/suspect/.test(q)) {
    const suspects = caseEntities.filter((e): e is PersonEntity => e.type === "person" && e.status === "suspect");
    return `Suspects on ${c.code}:\n${list(
      suspects.map((s) => `${s.label} — ${s.riskLevel} risk`),
      "No entities are currently tagged as suspects on this case.",
    )}`;
  }

  if (/high.?risk|risk level/.test(q)) {
    const high = caseEntities.filter((e) => e.riskLevel === "high");
    return `High-risk entities on ${c.code}:\n${list(
      high.map((e) => e.label),
      "No entities are currently flagged high risk on this case.",
    )}`;
  }

  if (/court|hearing|date/.test(q)) {
    const today = new Date().toISOString().slice(0, 10);
    const next = hearings.find((h) => h.status === "upcoming" && h.date >= today);
    if (!next) return `There are no upcoming hearings scheduled for ${c.code}.`;
    return `Next hearing on ${c.code}: ${next.hearingType} on ${formatDate(next.date)} at ${next.time}, ${next.court}, presided by ${next.judge}.`;
  }

  if (/alert/.test(q)) {
    const open = caseAlerts.filter((a) => a.status === "new" || a.status === "under review");
    return `${open.length ? "Open" : "No open"} alerts on ${c.code}${open.length ? ":" : "."}\n${list(
      open.map((a) => `${a.title} (${a.severity})`),
      "",
    )}`;
  }

  if (/connection|key player|central|network together|most connected/.test(q)) {
    const degree = new Map<string, number>();
    caseRelationships.forEach((r) => {
      degree.set(r.source, (degree.get(r.source) ?? 0) + 1);
      degree.set(r.target, (degree.get(r.target) ?? 0) + 1);
    });
    const ranked = [...degree.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, count]) => {
        const e = caseEntities.find((x) => x.id === id);
        return e ? `${e.label} — ${count} connections` : null;
      })
      .filter((x): x is string => !!x);
    return `Most connected entities on ${c.code}:\n${list(ranked, "Not enough linked records yet to rank connections.")}`;
  }

  if (/section|charge|act|ndps|bns|pmla/.test(q)) {
    return `${c.code} is registered under:\n${list(c.sections, "No sections recorded yet.")}`;
  }

  if (/officer|team|investigat|lead/.test(q)) {
    return `Investigating team on ${c.code}:\n${list(
      team.map((o) => `${o.name} — ${o.role}`),
      "No officers assigned yet.",
    )}`;
  }

  if (/location|where|address|warehouse|office/.test(q)) {
    const locs = caseEntities.filter((e) => e.type === "location");
    return `Locations of interest on ${c.code}:\n${list(
      locs.map((l) => l.label),
      "No locations recorded on this case.",
    )}`;
  }

  if (/vehicle|car|truck|plate/.test(q)) {
    const vehicles = caseEntities.filter((e) => e.type === "vehicle");
    return `Vehicles on ${c.code}:\n${list(
      vehicles.map((v) => v.label),
      "No vehicles recorded on this case.",
    )}`;
  }

  if (/organi[sz]ation|company|shell|firm/.test(q)) {
    const orgs = caseEntities.filter((e) => e.type === "organization");
    return `Organisations on ${c.code}:\n${list(
      orgs.map((o) => o.label),
      "No organisations recorded on this case.",
    )}`;
  }

  if (/summary|about|what is this case|brief/.test(q)) {
    return `${c.title} (${c.code}) — ${c.status}, ${c.priority} priority. ${c.summary}`;
  }

  return `I can answer questions about suspects, risk levels, connections, alerts, court dates, charge sections, locations, vehicles, organisations, and the investigating team for ${c.code}. Try one of the suggested prompts, or ask me directly.`;
}
