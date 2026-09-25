import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  /** Replay the tour on demand, from the help control in the navbar. */
  startTour: () => void;
  endTour: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, role } = useAuth();
  const [, setState] = useLocalStorage<OnboardingState>("netra-onboarding", { introDone: [] });
  const [tourOpen, setTourOpen] = useState(false);
  const autoStartedForSession = useRef(false);

  const markDone = useCallback(() => {
    setState((prev) =>
      prev.introDone.includes(role) ? prev : { ...prev, introDone: [...prev.introDone, role] },
    );
  }, [role, setState]);

  // The prototype should reliably introduce the dashboard after every new login. Local storage
  // still records that this role has seen it, but it never suppresses the demo's session tour.
  useEffect(() => {
    if (!isAuthenticated) {
      autoStartedForSession.current = false;
      return;
    }
    if (autoStartedForSession.current) return;
    autoStartedForSession.current = true;
    markDone();
    const timer = window.setTimeout(() => setTourOpen(true), 180);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated, markDone]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      tourOpen,
      startTour: () => setTourOpen(true),
      endTour: () => setTourOpen(false),
    }),
    [tourOpen],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used inside OnboardingProvider");
  return ctx;
}
