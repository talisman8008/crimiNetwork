// frontend/src/hooks/useCaseData.ts
//
// Async data hooks that replace the old synchronous mockData imports.
// No external data-fetching lib — just useState + useEffect + the apiService layer.

import { useCallback, useEffect, useState } from "react";
import {
    fetchCases,
    fetchCase,
    fetchGraph,
    fetchEntityProfile,
    fetchAlerts,
    markAlertViewed,
    fetchEntityResolutionQueue,
    approveMerge,
    rejectMerge,
    type GraphFilters,
    type ResolutionQueueResponse,
    type EntityProfileResponse,
} from "../lib/apiService";
import type { Case, Entity, Relationship, Alert } from "../data/types";
import {
    alerts as mockAlerts,
    cases as mockCases,
    entitiesForCase,
    getCaseById,
    getEntityById,
    relationshipsForCase,
} from "../data/mockData";

// The prototype is designed to run without the FastAPI service. Keep the
// switch here, at the data boundary, so pages never start a request to
// localhost:8000 while the offline demo is being recorded.
const OFFLINE_DEMO = true;
const DEMO_CASE_ID = "demo-uploaded-case";
const DEMO_CASE: Case = {
    id: DEMO_CASE_ID,
    code: "OP-NF-2026",
    title: "Operation Nightfall",
    status: "active",
    priority: "high",
    openedOn: "2026-03-11",
    leadOfficer: "Inspector Asha Kulkarni",
    station: "Mumbai Crime Branch",
    entityIds: entitiesForCase("case-1").map((entity) => entity.id),
    summary: "A curated investigation into coordinated extortion, financial routing, and movement across Mumbai.",
    sections: ["IPC Ss. 384, 420, 506, 120B", "BNS S. 61(2)"],
};

const offlineCases = (): Case[] => [DEMO_CASE, ...mockCases];
const mockCaseId = (caseId: string) => caseId === DEMO_CASE_ID ? "case-1" : caseId;

function filterOfflineGraph(entities: Entity[], relationships: Relationship[], filters?: GraphFilters) {
    const allowedEntities = filters?.entity_types
        ? entities.filter((entity) => filters.entity_types!.split(",").includes(entity.type))
        : entities;
    const ids = new Set(allowedEntities.map((entity) => entity.id));
    const allowedRelationships = relationships.filter((relationship) => {
        if (!ids.has(relationship.source) || !ids.has(relationship.target)) return false;
        if (filters?.date_from && relationship.observedOn < filters.date_from) return false;
        if (filters?.date_to && relationship.observedOn > filters.date_to) return false;
        return true;
    });
    return { entities: allowedEntities, relationships: allowedRelationships };
}

function offlineEntityProfile(caseId: string, entityId: string): EntityProfileResponse | null {
    const entity = getEntityById(entityId);
    if (!entity) return null;
    const connections = relationshipsForCase(mockCaseId(caseId))
        .filter((relationship) => relationship.source === entityId || relationship.target === entityId)
        .map((relationship) => {
            const otherId = relationship.source === entityId ? relationship.target : relationship.source;
            return {
                entity: getEntityById(otherId)?.label ?? otherId,
                entity_id: otherId,
                relationship: relationship.type,
                confidence: Math.min(0.98, 0.65 + relationship.weight / 15),
                frequency: relationship.weight,
                source: relationship.evidenceSource,
            };
        });
    return {
        identity: {
            id: entity.id,
            name: entity.label,
            aliases: entity.type === "person" ? entity.aliases : [],
            entity_type: entity.type,
            sources: [...new Set(connections.map((connection) => connection.source).filter(Boolean) as string[])],
            appearance_count: connections.length,
            confidence: 0.94,
        },
        connections,
        risk: {
            anomaly_score: entity.riskLevel === "high" ? 0.89 : entity.riskLevel === "medium" ? 0.62 : 0.28,
            factors: entity.tags,
            community_id: 1,
            centrality_rank: 1,
        },
    };
}

// ----- useCases ------------------------------------------------------------

export function useCases() {
    const [cases, setCases] = useState<Case[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (OFFLINE_DEMO) {
            setCases(offlineCases());
            setError(null);
            setLoading(false);
            return;
        }
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
        if (OFFLINE_DEMO) {
            setCaseData(caseId === DEMO_CASE_ID ? DEMO_CASE : getCaseById(caseId) ?? null);
            setError(null);
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
        if (OFFLINE_DEMO) {
            const id = mockCaseId(caseId);
            const graph = filterOfflineGraph(entitiesForCase(id), relationshipsForCase(id), filters);
            setEntities(graph.entities);
            setRelationships(graph.relationships);
            setError(null);
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

export function useCaseEntityProfile(caseId: string | null | undefined, entityId: string | null | undefined) {
    const [profile, setProfile] = useState<EntityProfileResponse | null>(null);
    const [loading, setLoading] = useState(Boolean(caseId && entityId));
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!caseId || !entityId) {
            setProfile(null);
            setLoading(false);
            return;
        }
        if (OFFLINE_DEMO) {
            setProfile(offlineEntityProfile(caseId, entityId));
            setError(null);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        fetchEntityProfile(caseId, entityId)
            .then((result) => {
                if (!cancelled) {
                    setProfile(result);
                    setError(null);
                }
            })
            .catch((err) => {
                if (!cancelled) setError((err as Error)?.message ?? "Failed to load entity profile");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [caseId, entityId]);

    return { profile, loading, error };
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
        if (OFFLINE_DEMO) {
            const id = mockCaseId(caseId);
            setAlerts(mockAlerts.filter((alert) => alert.caseId === id));
            setError(null);
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
            if (OFFLINE_DEMO) {
                setAlerts((current) => current.map((alert) => alert.id === alertId ? { ...alert, status: "actioned" } : alert));
                return;
            }
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
        if (OFFLINE_DEMO) {
            setQueue({ pending_pairs: 0, pairs: [] });
            setError(null);
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
            if (OFFLINE_DEMO) return;
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
            if (OFFLINE_DEMO) return;
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
