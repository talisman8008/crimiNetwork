import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "./useLocalStorage";

/**
 * The case an officer is currently working inside. Investigations are worked one at a time, so
 * once a case is opened from the dashboard the rest of the app scopes itself to it rather than
 * making the officer re-pick it on every screen. Clearing it returns to the all-cases view.
 */
interface ActiveCaseValue {
  activeCaseId: string | null;
  openCase: (caseId: string) => void;
  closeCase: () => void;
}

const ActiveCaseContext = createContext<ActiveCaseValue | null>(null);

export function ActiveCaseProvider({ children }: { children: ReactNode }) {
  const [activeCaseId, setActiveCaseId] = useLocalStorage<string | null>("netra-active-case", null);

  const value = useMemo<ActiveCaseValue>(
    () => ({
      activeCaseId,
      openCase: (caseId: string) => setActiveCaseId(caseId),
      closeCase: () => setActiveCaseId(null),
    }),
    [activeCaseId, setActiveCaseId],
  );

  return <ActiveCaseContext.Provider value={value}>{children}</ActiveCaseContext.Provider>;
}

export function useActiveCase(): ActiveCaseValue {
  const ctx = useContext(ActiveCaseContext);
  if (!ctx) throw new Error("useActiveCase must be used within ActiveCaseProvider");
  return ctx;
}
