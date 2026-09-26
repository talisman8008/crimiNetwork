// frontend/src/lib/caseAssistant.ts
//
// Thin wrapper around the copilot backend. Used to be a synchronous keyword
// matcher over mockData; now it forwards to /api/copilot/cases/{case_id}/chat.

import { askCopilot } from "./apiService";

const mockCaseIds = new Set(["demo-uploaded-case", "case-1", "case-2"]);

export interface CopilotAnswer {
  answer: string;
  sources: string[];
  confidence: number;
  referenced_entities: string[];
}

// UI-only — kept as-is, no backend involved.
export const suggestedPrompts: string[] = [
  "Who are the central figures in this case?",
  "What are the strongest connections in the network?",
  "Are there any anomalous patterns I should investigate?",
  "Summarize the timeline of key events.",
  "Which entities share the same community cluster?",
];

function mockAnswer(query: string): CopilotAnswer {
  const text = query.toLowerCase();
  if (/(second|next|important|priority|rank)/.test(text)) {
    return {
      answer: "After Rajan Kumar, Imran Sheikh is the most operationally important figure. He bridges the core extortion network to the Malad branch, has direct communications with Rajan, and is linked to Evershine Nagar through surveillance and call-detail activity.",
      sources: ["Cross-case bridge alert", "Call Detail Records", "Evershine Nagar surveillance report"],
      confidence: 0.9,
      referenced_entities: ["imran", "rajan", "malad"],
    };
  }
  if (/(central|key figure|lead|main suspect)/.test(text)) {
    return {
      answer: "Rajan Kumar is the primary suspect and collection hub. Imran Sheikh is the operational bridge to the Malad lead, while Vikram Naik and Nasreen Shaikh connect the financial and field activity. RK Enterprises is the front company used for payment routing.",
      sources: ["FIR 0112/2026", "Call Detail Records · 10–17 Mar 2026", "RK Enterprises transaction trail"],
      confidence: 0.94,
      referenced_entities: ["rajan", "imran", "vikram", "nasreen", "rk"],
    };
  }
  if (/(strong|connection|network|link)/.test(text)) {
    return {
      answer: "The strongest corroborated chain is Rajan Kumar → Nasreen Shaikh → RK Enterprises → Vikram Naik. It combines FIR references, repeated financial transfers, and call-detail evidence. Rajan’s encrypted handset also connects him directly to Imran Sheikh.",
      sources: ["FIR & Police Reports", "Financial Transactions", "Call Detail Records"],
      confidence: 0.91,
      referenced_entities: ["rajan", "nasreen", "rk", "vikram", "imran"],
    };
  }
  if (/(anomal|risk|alert|pattern)/.test(text)) {
    return {
      answer: "Two priority patterns need follow-up: unexplained routing through RK Enterprises and a co-located call/sighting at Dharavi Naka. The latter places Rajan Kumar and Vikram Naik in contact shortly before surveillance recorded activity at the meeting point.",
      sources: ["Financial anomaly alert", "Dharavi surveillance report", "CDR correlation"],
      confidence: 0.89,
      referenced_entities: ["rajan", "vikram", "rk", "dharavi"],
    };
  }
  if (/(timeline|when|date|event)/.test(text)) {
    return {
      answer: "Key sequence: the Shivam Electronics FIR established the Rajan–Imran association on 3 Feb; payment routing surfaced through February and March; Rajan and Vikram communicated on 10 Mar; the Dharavi co-location was recorded on 14 Mar; the encrypted handset linked Rajan to Imran on 16–17 Mar.",
      sources: ["FIR 0112/2026", "Financial Transactions", "CDR and surveillance timeline"],
      confidence: 0.92,
      referenced_entities: ["rajan", "imran", "vikram", "andheri", "dharavi"],
    };
  }
  if (/(map|location|place|where)/.test(text)) {
    return {
      answer: "The map highlights Shivam Electronics, Dharavi Naka, Evershine Nagar, Kurla warehouse lane, Bandra transit hub, Colaba financial district, and Govandi storage site. Kurla and Govandi are high-priority physical-evidence locations.",
      sources: ["FIR location references", "CCTV sighting records", "CDR cell-site activity"],
      confidence: 0.88,
      referenced_entities: ["andheri", "dharavi", "malad", "rajan", "imran"],
    };
  }
  return {
    answer: "This investigation centers on an extortion and financial-routing network led by Rajan Kumar. The current evidence connects people, a front company, vehicles, an encrypted handset, and multiple Mumbai locations. Ask about central figures, evidence links, alerts, timeline, or mapped locations.",
    sources: ["Curated case brief", "FIR, CDR, financial and surveillance records"],
    confidence: 0.9,
    referenced_entities: ["rajan", "imran", "rk"],
  };
}

export async function askQuestion(
  caseId: string,
  query: string
): Promise<CopilotAnswer> {
  // The recorded prototype stays fully offline. Answer known demo cases from
  // the curated brief instead of making a request that will fail without API.
  if (mockCaseIds.has(caseId)) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 450));
    return mockAnswer(query);
  }
  try {
    // A real authenticated case uses the backend RAG copilot. The prototype case has no
    // server-side counterpart, so it deliberately falls through to its offline brief.
    const res = await askCopilot(caseId, query);
    const sourceLabel = (source: string | Record<string, unknown>) => {
      if (typeof source === "string") return source;
      for (const key of ["title", "name", "source", "source_ref", "id"]) {
        const value = source[key];
        if (typeof value === "string" && value) return value;
      }
      return "Case record";
    };
    return {
      answer: res.answer,
      sources: res.sources.map(sourceLabel),
      confidence: res.confidence,
      referenced_entities: res.referenced_entities,
    };
  } catch (error) {
    throw error;
  }
}
