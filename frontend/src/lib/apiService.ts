// frontend/src/lib/apiService.ts
//
// Typed service layer that sits between the React UI and the FastAPI backend.
// All backend→frontend transforms (snake_case→camelCase, node→Entity, edge→Relationship,
// centrality→riskLevel, etc.) happen here. Pages never see raw API shapes.

import { apiGet, apiPost } from "./api";
import type {
    Case,
    Entity,
    Relationship,
    Alert,
    RelationType,
    RiskLevel,
    SourceType,
} from "../data/types";

// ----- Raw backend shapes ---------------------------------------------------

interface RawCase {
    id?: string;
    case_id?: string;
    code?: string;
    title?: string;
    status?: "active" | "under review" | "closed";
    priority?: "high" | "medium" | "low";
    opened_on?: string;
    openedOn?: string;
    lead_officer?: string;
    leadOfficer?: string;
    station?: string;
    entity_ids?: string[];
    entityIds?: string[];
    summary?: string;
    sections?: string[];
}

interface RawGraphNode {
    id: string;
    label: string;
    // backend already lowercases: "person"|"location"|"phone"|"vehicle" (no "organization" yet)
    type: string;
    centrality?: number;
    community_id?: number;
    anomaly_score?: number;
    confidence?: number;
    connection_count?: number;
}

interface RawGraphEdge {
    id: string;
    source: string;
    target: string;
    type: string;
    confidence?: number;
    frequency?: number;
    records?: Array<{
        source_file: string;
        row: number;
        date: string;
        detail: string;
    }>;
}

interface RawGraphResponse {
    nodes: RawGraphNode[];
    edges: RawGraphEdge[];
}

interface RawAlert {
    id: string;
    title?: string;
    description?: string;
    severity?: "high" | "medium" | "low";
    status?: "new" | "under review" | "dismissed" | "actioned";
    pattern_type?: string;
    patternType?: string;
    related_entity_ids?: string[];
    relatedEntityIds?: string[];
    case_id?: string;
    caseId?: string;
    detected_on?: string;
    detectedOn?: string;
    history?: Array<{ actor: string; action: string; at: string }>;
}

// ----- Exported types -------------------------------------------------------

export interface GraphFilters {
    min_confidence?: number;
    entity_types?: string;
    community_id?: number;
    date_from?: string;
    date_to?: string;
}

export interface ResolutionPair {
    pair_id: string;
    entity_a: string;
    entity_b: string;
    similarity: number;
    suggested_action: string;
}

export interface ResolutionQueueResponse {
    pending_pairs: number;
    pairs: ResolutionPair[];
}

export interface CopilotResponse {
    answer: string;
    sources: string[];
    confidence: number;
    referenced_entities: string[];
}

// ----- Helpers --------------------------------------------------------------

const API_BASE: string =
    ((import.meta as any).env?.VITE_API_URL as string) || "http://localhost:8000";

const authHeaders = (): Record<string, string> => {
    const token = localStorage.getItem("netra-token");
    return token ? { Authorization: `Bearer ${token}` } : {};
};

function riskFromCentrality(c: number | undefined | null): RiskLevel {
    if (c === undefined || c === null) return "low";
    if (c > 0.5) return "high";
    if (c > 0.2) return "medium";
    return "low";
}

const RELATION_MAP: Record<string, RelationType> = {
    CALLED: "communication",
    TRANSACTED_WITH: "financial",
    ASSOCIATED_WITH: "associate",
    ALIAS_OF: "associate",
    FAMILY: "family",
    FINANCIAL: "financial",
    COMMUNICATION: "communication",
    OWNERSHIP: "ownership",
    FREQUENTS: "frequents",
    EMPLOYMENT: "employment",
};

function mapRelationType(raw: string): RelationType {
    const upper = (raw || "").toUpperCase();
    return RELATION_MAP[upper] ?? "associate";
}

function buildEntity(n: RawGraphNode, caseId: string): Entity {
    const tags: string[] = [];
    if (n.anomaly_score !== undefined && n.anomaly_score > 0.7) {
        tags.push("anomalous");
    }
    if (n.community_id !== undefined && n.community_id !== null) {
        tags.push(`cluster-${n.community_id}`);
    }
    if (n.confidence !== undefined && n.confidence !== null) {
        tags.push(`conf-${n.confidence.toFixed(2)}`);
    }

    const type = (n.type || "person") as Entity["type"];
    const base = {
        id: n.id,
        type,
        label: n.label || n.id,
        riskLevel: riskFromCentrality(n.centrality),
        caseIds: [caseId],
        tags,
    };

    // Neo4j doesn't carry person/vehicle/phone details yet — default to undefined/null.
    switch (type) {
        case "person":
            return { ...base, type: "person", status: "unknown" } as Entity;
        case "location":
            return {
                ...base,
                type: "location",
                address: "",
                locationType: "unknown",
                lat: 0,
                lng: 0,
            } as Entity;
        case "vehicle":
            return { ...base, type: "vehicle", plate: "", makeModel: "" } as Entity;
        case "phone":
            return { ...base, type: "phone", number: n.label || "" } as Entity;
        case "organization":
            return { ...base, type: "organization", orgType: "unknown" } as Entity;
        default:
            return { ...base, type: "person", status: "unknown" } as Entity;
    }
}

function buildRelationship(e: RawGraphEdge): Relationship {
    const records = e.records ?? [];
    const first = records[0];
    const observedOn = first?.date ?? new Date().toISOString();
    const description = first?.detail ?? e.type;

    // Map source_file → SourceType. If unknown, fall back to the most generic option.
    const evidenceSource: SourceType =
        (first?.source_file as SourceType) ?? "Intelligence Agency Reports";

    return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: mapRelationType(e.type),
        weight: e.frequency ?? e.confidence ?? 1,
        evidenceSource,
        observedOn,
        description,
    };
}

function buildCase(c: RawCase): Case {
    return {
        id: c.id ?? c.case_id ?? "",
        code: c.code ?? "",
        title: c.title ?? "",
        status: c.status ?? "active",
        priority: c.priority ?? "medium",
        openedOn: c.openedOn ?? c.opened_on ?? new Date().toISOString(),
        leadOfficer: c.leadOfficer ?? c.lead_officer ?? "",
        station: c.station ?? "",
        entityIds: c.entityIds ?? c.entity_ids ?? [],
        summary: c.summary ?? "",
        sections: c.sections ?? [],
    };
}

function buildAlert(a: RawAlert): Alert {
    return {
        id: a.id,
        title: a.title ?? "",
        description: a.description ?? "",
        severity: a.severity ?? "medium",
        status: a.status ?? "new",
        patternType: a.patternType ?? a.pattern_type ?? "",
        relatedEntityIds: a.relatedEntityIds ?? a.related_entity_ids ?? [],
        caseId: a.caseId ?? a.case_id ?? "",
        detectedOn: a.detectedOn ?? a.detected_on ?? new Date().toISOString(),
        history: a.history ?? [],
    };
}

// ----- Public service -------------------------------------------------------

export async function fetchCases(): Promise<Case[]> {
    const raw = await apiGet<RawCase[]>("/api/cases/");
    return (raw ?? []).map(buildCase);
}

export async function fetchCase(caseId: string): Promise<Case | null> {
    try {
        const raw = await apiGet<RawCase>(`/api/cases/${caseId}`);
        return buildCase(raw);
    } catch (err) {
        console.error("fetchCase failed:", err);
        return null;
    }
}

export async function fetchGraph(
    caseId: string,
    filters?: GraphFilters
): Promise<{ entities: Entity[]; relationships: Relationship[] }> {
    const params = new URLSearchParams();
    if (filters?.min_confidence !== undefined) {
        params.set("min_confidence", String(filters.min_confidence));
    }
    if (filters?.entity_types) params.set("entity_types", filters.entity_types);
    if (filters?.community_id !== undefined) {
        params.set("community_id", String(filters.community_id));
    }
    if (filters?.date_from) params.set("date_from", filters.date_from);
    if (filters?.date_to) params.set("date_to", filters.date_to);

    const qs = params.toString() ? `?${params.toString()}` : "";
    const raw = await apiGet<RawGraphResponse>(`/api/cases/${caseId}/graph${qs}`);

    const entities = (raw.nodes ?? []).map((n) => buildEntity(n, caseId));
    const relationships = (raw.edges ?? []).map(buildRelationship);
    return { entities, relationships };
}

export async function fetchAlerts(caseId: string): Promise<Alert[]> {
    const raw = await apiGet<RawAlert[]>(`/api/alerts/cases/${caseId}/alerts`);
    return (raw ?? []).map(buildAlert);
}

// PATCH endpoint — api.ts has no apiPatch, so we hit fetch directly with the
// same token convention. (apiPost only does JSON; this is a PATCH anyway.)
export async function markAlertViewed(
    caseId: string,
    alertId: string
): Promise<void> {
    const res = await fetch(
        `${API_BASE}/api/alerts/cases/${caseId}/alerts/${alertId}/viewed`,
        {
            method: "PATCH",
            headers: {
                ...authHeaders(),
                "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
        }
    );
    if (!res.ok) {
        throw new Error(`markAlertViewed failed (${res.status})`);
    }
}

export async function fetchEntityResolutionQueue(
    caseId: string
): Promise<ResolutionQueueResponse> {
    return await apiGet<ResolutionQueueResponse>(
        `/api/nlp/cases/${caseId}/entity-resolution`
    );
}

export async function approveMerge(
    caseId: string,
    pairId: string
): Promise<void> {
    await apiPost(`/api/nlp/cases/${caseId}/entity-resolution/merge`, {
        pair_id: pairId,
    });
}

export async function rejectMerge(
    caseId: string,
    pairId: string
): Promise<void> {
    await apiPost(`/api/nlp/cases/${caseId}/entity-resolution/reject`, {
        pair_id: pairId,
    });
}

export async function askCopilot(
    caseId: string,
    query: string
): Promise<CopilotResponse> {
    return await apiPost<CopilotResponse>(`/api/copilot/cases/${caseId}/chat`, {
        query,
    });
}

// Multipart upload — can't go through apiPost (JSON-only). Use fetch with FormData.
export async function uploadFile(
    caseId: string,
    file: File,
    sourceType: string
): Promise<void> {
    const form = new FormData();
    form.append("file", file);
    form.append("source_type", sourceType);

    const res = await fetch(`${API_BASE}/api/ingestion/cases/${caseId}/upload`, {
        method: "POST",
        headers: authHeaders(), // NOTE: no Content-Type — browser sets multipart boundary
        body: form,
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Upload failed (${res.status}): ${text}`);
    }
}