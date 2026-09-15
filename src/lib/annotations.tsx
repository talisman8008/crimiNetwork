import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "./useLocalStorage";

/** An officer's own additions to an entity that the case data does not carry: a working note and
 *  a mugshot. Kept in local storage so they survive a reload without needing the backend, which
 *  has no field for either. Keyed by entity id. */
interface Annotation {
  notes?: string;
  photo?: string; // data URL
}

interface AnnotationsContextValue {
  get: (entityId: string) => Annotation;
  setNotes: (entityId: string, notes: string) => void;
  setPhoto: (entityId: string, photo: string | undefined) => void;
}

const AnnotationsContext = createContext<AnnotationsContextValue | null>(null);

export function AnnotationsProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useLocalStorage<Record<string, Annotation>>("netra-annotations", {});

  const setNotes = useCallback(
    (entityId: string, notes: string) =>
      setMap((prev) => ({ ...prev, [entityId]: { ...prev[entityId], notes } })),
    [setMap],
  );

  const setPhoto = useCallback(
    (entityId: string, photo: string | undefined) =>
      setMap((prev) => ({ ...prev, [entityId]: { ...prev[entityId], photo } })),
    [setMap],
  );

  const value = useMemo<AnnotationsContextValue>(
    () => ({ get: (id) => map[id] ?? {}, setNotes, setPhoto }),
    [map, setNotes, setPhoto],
  );

  return <AnnotationsContext.Provider value={value}>{children}</AnnotationsContext.Provider>;
}

export function useAnnotations(): AnnotationsContextValue {
  const ctx = useContext(AnnotationsContext);
  if (!ctx) throw new Error("useAnnotations must be used within AnnotationsProvider");
  return ctx;
}
