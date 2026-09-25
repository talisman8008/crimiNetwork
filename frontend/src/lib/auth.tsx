// frontend/src/lib/auth.tsx
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "./useLocalStorage";
import * as api from "./api";
import type { AccessLogEntry, UserRole } from "../data/types";

interface AuthContextValue {
  isAuthenticated: boolean;
  officerId: string | null;
  role: UserRole;
  accessLog: AccessLogEntry[];
  /** Changed signature: was (officerId, role) => void.
   *  Now authenticates against the backend and returns the role derived from the JWT response. */
  login: (badgeId: string, password: string) => Promise<UserRole>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function now(): string {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

const DEMO_BADGE_ID = "BADGE001";
const DEMO_PASSWORD = "SIH2026";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [officerId, setOfficerId] = useLocalStorage<string | null>(
    "netra-auth-officer",
    null,
  );
  const [role, setRole] = useLocalStorage<UserRole>("netra-auth-role", "investigator");
  const [accessLog, setAccessLog] = useLocalStorage<AccessLogEntry[]>(
    "netra-access-log",
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      // The prototype runs without a backend, so a local demo token represents this session.
      isAuthenticated: !!api.getToken(),
      officerId,
      role,
      accessLog,
      login: async (badgeId: string, password: string): Promise<UserRole> => {
        if (badgeId.toUpperCase() !== DEMO_BADGE_ID || password !== DEMO_PASSWORD) {
          throw new api.ApiError("Invalid offline demo credentials", 401, null);
        }

        const nextRole: UserRole = "investigator";
        api.setToken("netra-offline-demo-session");
        setOfficerId(DEMO_BADGE_ID);
        setRole(nextRole);

        // Keep access-log behaviour simple (no mock IP). Phase 1 only.
        setAccessLog((prev) => [
          {
            id: `al-${Date.now()}`,
            officerId: DEMO_BADGE_ID,
            action: "login",
            status: "success",
            ipAddress: "session",
            location: "Central Crime Station, Sector 14 (Internal)",
            device: "This browser session",
            at: now(),
          },
          ...prev,
        ]);

        return nextRole;
      },
      logout: () => {
        const id = officerId;
        api.clearToken();
        setOfficerId(null);
        if (id) {
          setAccessLog((prev) => [
            {
              id: `al-${Date.now()}`,
              officerId: id,
              action: "logout",
              status: "success",
              ipAddress: "session",
              location: "Central Crime Station, Sector 14 (Internal)",
              device: "This browser session",
              at: now(),
            },
            ...prev,
          ]);
        }
      },
    }),
    [officerId, setOfficerId, role, setRole, accessLog, setAccessLog],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
