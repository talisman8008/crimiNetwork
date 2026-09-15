import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "./useLocalStorage";

/** An officer's ruling on a machine-asserted link or ranking. The system proposes; a person
 *  confirms, disputes, or flags it for a second look — and can override where an entity sits in
 *  the priority order. Kept in local storage, since the backend has no field for a human verdict. */
export type Verdict = "confirmed" | "disputed" | "review";

interface LinkRuling {
  verdict?: Verdict;
  note?: string;
}

interface ValidationState {
  links: Record<string, LinkRuling>;
  /** entityId -> priority nudge (+1 raise, -1 lower), applied on top of the computed rank. */
  priority: Record<string, number>;
}

interface ValidationsContextValue {
  linkRuling: (relId: string) => LinkRuling;
  setVerdict: (relId: string, verdict: Verdict | undefined) => void;
  setNote: (relId: string, note: string) => void;
  priorityNudge: (entityId: string) => number;
  nudgePriority: (entityId: string, delta: number) => void;
  counts: { confirmed: number; disputed: number; review: number };
}

const ValidationsContext = createContext<ValidationsContextValue | null>(null);

export function ValidationsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useLocalStorage<ValidationState>("netra-validations", { links: {}, priority: {} });

  const setVerdict = useCallback(
    (relId: string, verdict: Verdict | undefined) =>
      setState((prev) => ({ ...prev, links: { ...prev.links, [relId]: { ...prev.links[relId], verdict } } })),
    [setState],
  );

  const setNote = useCallback(
    (relId: string, note: string) =>
      setState((prev) => ({ ...prev, links: { ...prev.links, [relId]: { ...prev.links[relId], note } } })),
    [setState],
  );

  const nudgePriority = useCallback(
    (entityId: string, delta: number) =>
      setState((prev) => {
        const next = (prev.priority[entityId] ?? 0) + delta;
        return { ...prev, priority: { ...prev.priority, [entityId]: Math.max(-2, Math.min(2, next)) } };
      }),
    [setState],
  );

  const value = useMemo<ValidationsContextValue>(() => {
    const verdicts = Object.values(state.links).map((l) => l.verdict);
    return {
      linkRuling: (relId) => state.links[relId] ?? {},
      setVerdict,
      setNote,
      priorityNudge: (entityId) => state.priority[entityId] ?? 0,
      nudgePriority,
      counts: {
        confirmed: verdicts.filter((v) => v === "confirmed").length,
        disputed: verdicts.filter((v) => v === "disputed").length,
        review: verdicts.filter((v) => v === "review").length,
      },
    };
  }, [state, setVerdict, setNote, nudgePriority]);

  return <ValidationsContext.Provider value={value}>{children}</ValidationsContext.Provider>;
}

export function useValidations(): ValidationsContextValue {
  const ctx = useContext(ValidationsContext);
  if (!ctx) throw new Error("useValidations must be used within ValidationsProvider");
  return ctx;
}
