import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { EntityType, RelationType, SourceType } from "../data/types";

/**
 * Per-case working context. An investigator rarely finishes a case in one sitting: they set
 * filters, focus a subject, scrub the timeline, then get pulled onto something else. This
 * remembers where they were in each case so reopening it puts the board back as they left it,
 * rather than resetting to a blank graph every time.
 */
export interface CaseWorkspace {
  selectedEntityId: string | null;
  relationType: RelationType | "all";
  sourceFilter: SourceType | "all";
  dateFrom: string;
  dateTo: string;
  activeTypes: EntityType[];
  tab: "graph" | "board";
  timelineOn: boolean;
  timelineStep: number;
  search: string;
  lastOpened: string;
}

const ALL_TYPES: EntityType[] = ["person", "organization", "location", "vehicle", "phone"];

export function blankWorkspace(): CaseWorkspace {
  return {
    selectedEntityId: null,
    relationType: "all",
    sourceFilter: "all",
    dateFrom: "",
    dateTo: "",
    activeTypes: ALL_TYPES,
    tab: "graph",
    timelineOn: false,
    timelineStep: 0,
    search: "",
    lastOpened: new Date().toISOString(),
  };
}

type WorkspaceStore = Record<string, CaseWorkspace>;

export function useCaseWorkspaces() {
  const [store, setStore] = useLocalStorage<WorkspaceStore>("netra-case-workspaces", {});

  const save = useCallback(
    (caseId: string, patch: Partial<CaseWorkspace>) => {
      if (caseId === "all") return; // only real cases carry a saved context
      setStore((prev) => ({
        ...prev,
        [caseId]: { ...blankWorkspace(), ...prev[caseId], ...patch, lastOpened: new Date().toISOString() },
      }));
    },
    [setStore],
  );

  const clear = useCallback(
    (caseId: string) => {
      setStore((prev) => {
        const next = { ...prev };
        delete next[caseId];
        return next;
      });
    },
    [setStore],
  );

  return { workspaces: store, save, clear };
}

/** Short human description of what was left open, for the "resume" line on the case list. */
export function describeWorkspace(w: CaseWorkspace, entityLabel?: string): string {
  const parts: string[] = [];
  if (entityLabel) parts.push(`viewing ${entityLabel}`);
  if (w.tab === "board") parts.push("on the evidence board");
  if (w.relationType !== "all") parts.push(`${w.relationType} links only`);
  if (w.sourceFilter !== "all") parts.push(w.sourceFilter);
  if (w.activeTypes.length < ALL_TYPES.length) parts.push(`${w.activeTypes.length} of 5 entity types`);
  if (w.timelineOn) parts.push("timeline open");
  if (w.search) parts.push(`search "${w.search}"`);
  return parts.length ? parts.join(" · ") : "no filters applied";
}
