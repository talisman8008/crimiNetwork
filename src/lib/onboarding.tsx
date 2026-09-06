import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { useAuth } from "./auth";
import type { UserRole } from "../data/types";

interface OnboardingState {
  /** Roles whose introduction has already been read. An investigator and a supervisor land in
   *  different places and have different first tasks, so each role gets its own first run
   *  rather than one blanket "seen it" flag. */
  introDone: UserRole[];
}

interface OnboardingContextValue {
  introOpen: boolean;
  tourOpen: boolean;
  /** Reopen the introduction on demand, from the help control in the navbar. */
  openIntro: () => void;
  closeIntro: () => void;
  startTour: () => void;
  endTour: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, role } = useAuth();
  const [state, setState] = useLocalStorage<OnboardingState>("netra-onboarding", { introDone: [] });
  const [reopened, setReopened] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  const firstRun = isAuthenticated && !state.introDone.includes(role);

  const markIntroDone = useCallback(() => {
    setState((prev) =>
      prev.introDone.includes(role) ? prev : { ...prev, introDone: [...prev.introDone, role] },
    );
  }, [role, setState]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      // The tour takes over the screen, so the dialog steps aside while it runs.
      introOpen: isAuthenticated && (firstRun || reopened) && !tourOpen,
      tourOpen,
      openIntro: () => setReopened(true),
      closeIntro: () => {
        setReopened(false);
        markIntroDone();
      },
      startTour: () => {
        setReopened(false);
        markIntroDone();
        setTourOpen(true);
      },
      endTour: () => setTourOpen(false),
    }),
    [isAuthenticated, firstRun, reopened, tourOpen, markIntroDone],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used inside OnboardingProvider");
  return ctx;
}
