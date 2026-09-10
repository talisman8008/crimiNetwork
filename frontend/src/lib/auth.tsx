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

function deriveRole(data: api.LoginResponse): UserRole {
  const r = String(data.role ?? "").toUpperCase();
  if (r === "SUPERVISOR") return "supervisor";
  // Backend may also return role inside a nested object or spelled differently; default safely.
  return "investigator";
}

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
      // Per Phase 1 spec: isAuthenticated = a JWT exists in localStorage.
      isAuthenticated: !!api.getToken(),
      officerId,
      role,
      accessLog,
      login: async (badgeId: string, password: string): Promise<UserRole> => {
        const res = await api.login(badgeId, password);
        api.setToken(res.access_token);
        setOfficerId(res.badge_id);
        const nextRole = deriveRole(res);
        setRole(nextRole);

        // Keep access-log behaviour simple (no mock IP). Phase 1 only.
        setAccessLog((prev) => [
          {
            id: `al-${Date.now()}`,
            officerId: res.badge_id,
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