import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { useAuth } from "./auth";
import type { UserRole } from "../data/types";

interface OnboardingState {
  /** Roles that have already been shown the tour. An investigator and a supervisor land in
   *  different places, so each role gets its own first run rather than one blanket flag. */
  introDone: UserRole[];
}

interface OnboardingContextValue {
  tourOpen: boolean;
  sidebarSpotlight: boolean;
  setSidebarSpotlight: (open: boolean) => void;
  /** Replay the tour on demand, from the help control in the navbar. */
  startTour: () => void;
  endTour: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, role } = useAuth();
  const [state, setState] = useLocalStorage<OnboardingState>("netra-onboarding", { introDone: [] });
  const [tourOpen, setTourOpen] = useState(false);
  const [sidebarSpotlight, setSidebarSpotlight] = useState(false);
  const updateSidebarSpotlight = useCallback((open: boolean) => setSidebarSpotlight(open), []);

  const markDone = useCallback(() => {
    setState((prev) =>
      prev.introDone.includes(role) ? prev : { ...prev, introDone: [...prev.introDone, role] },
    );
  }, [role, setState]);

  // First time in as this role, the tour just starts. A modal standing between an officer and
  // their caseload gets dismissed unread; walking the actual screens does not.
  useEffect(() => {
    if (!isAuthenticated || state.introDone.includes(role)) return;
    markDone();
    setTourOpen(true);
  }, [isAuthenticated, role, state.introDone, markDone]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      tourOpen,
      sidebarSpotlight,
      setSidebarSpotlight: updateSidebarSpotlight,
      startTour: () => setTourOpen(true),
      endTour: () => {
        setTourOpen(false);
        setSidebarSpotlight(false);
      },
    }),
    [tourOpen, sidebarSpotlight, updateSidebarSpotlight],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used inside OnboardingProvider");
  return ctx;
}
