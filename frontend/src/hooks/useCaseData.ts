// frontend/src/hooks/useCaseData.ts
//
// Async data hooks that replace the old synchronous mockData imports.
// No external data-fetching lib — just useState + useEffect + the apiService layer.

import { useCallback, useEffect, useState } from "react";
import {
    fetchCases,
    fetchCase,
    fetchGraph,
    fetchAlerts,
    markAlertViewed,
    fetchEntityResolutionQueue,
    approveMerge,
    rejectMerge,
    type GraphFilters,
    type ResolutionQueueResponse,
} from "../lib/apiService";
import type { Case, Entity, Relationship, Alert } from "../data/types";

// ----- useCases ------------------------------------------------------------

export function useCases() {
    const [cases, setCases] = useState<Case[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetchCases()
            .then((c) => {
                if (!cancelled) {
                    setCases(c);
                    setError(null);
                }
            })
            .catch((err) => {
                if (!cancelled) setError((err as Error)?.message ?? "Failed to load cases");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return { cases, loading, error };
}

// ----- useCase --------------------------------------------------------------

export function useCase(caseId: string | null | undefined) {
    const [caseData, setCaseData] = useState<Case | null>(null);
    const [loading, setLoading] = useState<boolean>(Boolean(caseId));
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!caseId) {
            setCaseData(null);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        fetchCase(caseId)
            .then((c) => {
                if (!cancelled) {
                    setCaseData(c);
                    setError(null);
                }
            })
            .catch((err) => {
                if (!cancelled) setError((err as Error)?.message ?? "Failed to load case");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [caseId]);

    return { case: caseData, loading, error };
}

// ----- useCaseGraph ---------------------------------------------------------
//
// This is the hook that feeds computeCentrality / detectCommunities / graphAlgo.
// Returns the same {entities, relationships} shape the computation libs expect.

export function useCaseGraph(
    caseId: string | null | undefined,
    filters?: GraphFilters
) {
    const [entities, setEntities] = useState<Entity[]>([]);
    const [relationships, setRelationships] = useState<Relationship[]>([]);
    const [loading, setLoading] = useState<boolean>(Boolean(caseId));
    const [error, setError] = useState<string | null>(null);

    // Serialize filters so we don't refetch on every render.
    const filterKey = JSON.stringify(filters ?? {});

    useEffect(() => {
        if (!caseId) {
            setEntities([]);
            setRelationships([]);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        fetchGraph(caseId, filters)
            .then(({ entities, relationships }) => {
                if (!cancelled) {
                    setEntities(entities);
                    setRelationships(relationships);
                    setError(null);
                }
            })
            .catch((err) => {
                if (!cancelled) setError((err as Error)?.message ?? "Failed to load graph");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId, filterKey]);

    return { entities, relationships, loading, error };
}

// ----- useCaseAlerts --------------------------------------------------------

export function useCaseAlerts(caseId: string | null | undefined) {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState<boolean>(Boolean(caseId));
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        if (!caseId) {
            setAlerts([]);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        fetchAlerts(caseId)
            .then((a) => {
                if (!cancelled) {
                    setAlerts(a);
                    setError(null);
                }
            })
            .catch((err) => {
                if (!cancelled) setError((err as Error)?.message ?? "Failed to load alerts");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [caseId]);

    useEffect(() => {
        load();
    }, [load]);

    const markViewed = useCallback(
        async (alertId: string) => {
            if (!caseId) return;
            try {
                await markAlertViewed(caseId, alertId);
                load();
            } catch (err) {
                setError((err as Error)?.message ?? "Failed to update alert");
            }
        },
        [caseId, load]
    );

    return { alerts, loading, error, markViewed };
}

// ----- useEntityResolutionQueue ---------------------------------------------

export function useEntityResolutionQueue(caseId: string | null | undefined) {
    const [queue, setQueue] = useState<ResolutionQueueResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(Boolean(caseId));
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        if (!caseId) {
            setQueue(null);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        fetchEntityResolutionQueue(caseId)
            .then((q) => {
                if (!cancelled) {
                    setQueue(q);
                    setError(null);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError((err as Error)?.message ?? "Failed to load entity resolution queue");
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [caseId]);

    useEffect(() => {
        load();
    }, [load]);

    const approve = useCallback(
        async (pairId: string) => {
            if (!caseId) return;
            try {
                await approveMerge(caseId, pairId);
                load();
            } catch (err) {
                setError((err as Error)?.message ?? "Failed to approve merge");
            }
        },
        [caseId, load]
    );

    const reject = useCallback(
        async (pairId: string) => {
            if (!caseId) return;
            try {
                await rejectMerge(caseId, pairId);
                load();
            } catch (err) {
                setError((err as Error)?.message ?? "Failed to reject merge");
            }
        },
        [caseId, load]
    );

    return { queue, loading, error, approve, reject };
}
