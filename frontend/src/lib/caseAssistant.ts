// frontend/src/lib/caseAssistant.ts
//
// Thin wrapper around the copilot backend. Used to be a synchronous keyword
// matcher over mockData; now it forwards to /api/copilot/cases/{case_id}/chat.

import { askCopilot } from "./apiService";

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

export async function askQuestion(
  caseId: string,
  query: string
): Promise<CopilotAnswer> {
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
}
