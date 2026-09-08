import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { generateMockIp, seedAccessLog } from "../data/accessLogData";
import type { AccessLogEntry, UserRole } from "../data/types";

interface AuthContextValue {
  isAuthenticated: boolean;
  officerId: string | null;
  role: UserRole;
  accessLog: AccessLogEntry[];
  login: (officerId: string, role: UserRole) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function now(): string {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [officerId, setOfficerId] = useLocalStorage<string | null>("netra-auth-officer", null);
  const [role, setRole] = useLocalStorage<UserRole>("netra-auth-role", "investigator");
  const [accessLog, setAccessLog] = useLocalStorage<AccessLogEntry[]>("netra-access-log", seedAccessLog);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: !!officerId,
      officerId,
      role,
      accessLog,
      login: (id: string, nextRole: UserRole) => {
        setOfficerId(id);
        setRole(nextRole);
        setAccessLog((prev) => [
          {
            id: `al-${Date.now()}`,
            officerId: id,
            action: "login",
            status: "success",
            ipAddress: generateMockIp(id),
            location: "Central Crime Station, Sector 14 (Internal)",
            device: "This browser session",
            at: now(),
          },
          ...prev,
        ]);
      },
      logout: () => {
        if (officerId) {
          setAccessLog((prev) => [
            {
              id: `al-${Date.now()}`,
              officerId,
              action: "logout",
              status: "success",
              ipAddress: generateMockIp(officerId),
              location: "Central Crime Station, Sector 14 (Internal)",
              device: "This browser session",
              at: now(),
            },
            ...prev,
          ]);
        }
        setOfficerId(null);
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
