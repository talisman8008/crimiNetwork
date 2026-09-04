import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { generateMockIp, seedAccessLog } from "../data/accessLogData";
import type { AccessLogEntry, UserRole } from "../data/types";

interface AuthContextValue {
  isAuthenticated: boolean;
  officerId: string | null;
  role: UserRole;
  accessLog: AccessLogEntry[];
  login: (officerId: string, password?: string) => Promise<void>;
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
      login: async (id: string, password?: string) => {
        // Use standard URLSearchParams for OAuth2PasswordRequestForm
        const formData = new URLSearchParams();
        formData.append("username", id);
        formData.append("password", password || "password123");
        
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            body: formData,
          });
          
          if (!response.ok) {
            throw new Error('Invalid credentials');
          }
          
          const data = await response.json();
          // Store token
          localStorage.setItem('netra-auth-token', data.access_token);
          
          // Decode JWT payload (simple base64 decode for frontend)
          const base64Url = data.access_token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(window.atob(base64));
          
          const nextRole = payload.role?.toLowerCase() || 'investigator';
          
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
        } catch (err) {
          throw err;
        }
      },
      logout: () => {
        localStorage.removeItem('netra-auth-token');
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
