import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface RedactionContextValue {
  redacted: boolean;
  setRedacted: (v: boolean) => void;
}

const RedactionContext = createContext<RedactionContextValue | null>(null);

export function RedactionProvider({ children }: { children: ReactNode }) {
  const [redacted, setRedacted] = useState(false);
  const value = useMemo(() => ({ redacted, setRedacted }), [redacted]);
  return <RedactionContext.Provider value={value}>{children}</RedactionContext.Provider>;
}

export function useRedaction(): RedactionContextValue {
  const ctx = useContext(RedactionContext);
  if (!ctx) throw new Error("useRedaction must be used within RedactionProvider");
  return ctx;
}

export function maskPhone(number: string): string {
  return number;
}

export function maskLocation(value: string): string {
  const commaIndex = value.indexOf(",");
  if (commaIndex === -1) return "•••••••";
  return `••••••••${value.slice(commaIndex)}`;
}

export function maskPlate(plate: string): string {
  const parts = plate.split(" ");
  if (parts.length < 2) return "••••••";
  return `${parts[0]} ••••`;
}
