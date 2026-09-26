import type { Alert, Case, DataSource, Entity, Relationship, SourceType } from "./types";
import { computeCentrality } from "../lib/centrality";

export const cases: Case[] = [
  { id: "case-1", code: "CASE001-CURATED", title: "Case 001 — Curated Network", status: "active", priority: "high", openedOn: "2026-02-04", leadOfficer: "Inspector Asha Kulkarni", station: "Mumbai Crime Branch", entityIds: ["rajan", "imran", "vikram", "nasreen", "arun", "salim", "rk", "andheri", "dharavi", "malad", "car", "bike"], summary: "A Mumbai extortion and financial-routing inquiry centered on Rajan Kumar, with Imran Sheikh bridging a subsequent Malad narcotics lead.", sections: ["IPC Ss. 384, 420, 506, 120B", "BNS S. 61(2)"] },
  { id: "case-2", code: "CASE002-CURATED", title: "Case 002 — Malad Link", status: "under review", priority: "high", openedOn: "2026-08-04", leadOfficer: "Inspector Firoz Khan", station: "Malad Police Station", entityIds: ["imran", "nasreen", "salim", "malad", "bike"], summary: "A Malad distribution branch linked back to the Case 001 network through Imran Sheikh and an unexplained transfer from Nasreen Shaikh.", sections: ["NDPS Act Ss. 8(c), 21, 29"] },
];

export const entities: Entity[] = [
  { id: "rajan", type: "person", label: "Rajan Kumar", aliases: ["Raju Bhai"], riskLevel: "high", caseIds: ["case-1"], tags: ["collection hub", "named accused"], status: "suspect", sex: "Male", lastKnownLocation: "Andheri West, Mumbai", lat: 19.136, lng: 72.829, notes: "Named in the extortion FIR and repeatedly directs collection activity." },
  { id: "imran", type: "person", label: "Imran Sheikh", aliases: ["Immu Sheikh"], riskLevel: "high", caseIds: ["case-1", "case-2"], tags: ["cross-case bridge", "field coordination"], status: "suspect", sex: "Male", lastKnownLocation: "Andheri West, Mumbai", lat: 19.137, lng: 72.826, notes: "Connects the Andheri extortion inquiry to the Malad distribution lead." },
  { id: "vikram", type: "person", label: "Vikram Naik", riskLevel: "high", caseIds: ["case-1"], tags: ["logistics", "collections"], status: "suspect", sex: "Male", lastKnownLocation: "Dadar, Mumbai", lat: 19.018, lng: 72.843, notes: "Received allocations from RK Enterprises and coordinated field movement." },
  { id: "nasreen", type: "person", label: "Nasreen Shaikh", riskLevel: "medium", caseIds: ["case-1", "case-2"], tags: ["financial link", "cross-case bridge"], status: "associate", sex: "Female", lastKnownLocation: "Bandra, Mumbai", lat: 19.055, lng: 72.84, notes: "Routes funds through RK Enterprises; transferred funds to Salim before CASE_002." },
  { id: "arun", type: "person", label: "Arun Tawde", riskLevel: "medium", caseIds: ["case-1"], tags: ["driver", "storage access"], status: "associate", sex: "Male", lastKnownLocation: "Goregaon West, Mumbai", lat: 19.164, lng: 72.847, notes: "Driver of the sedan linked to the first incident and the Govandi storage visit." },
  { id: "salim", type: "person", label: "Salim Qureshi", aliases: ["Salim Bhai"], riskLevel: "high", caseIds: ["case-2"], tags: ["Malad branch", "arrested"], status: "suspect", sex: "Male", lastKnownLocation: "Malad West, Mumbai", lat: 19.186, lng: 72.839, notes: "Intercepted with suspected contraband in CASE_002." },
  { id: "rk", type: "organization", label: "RK Enterprises", riskLevel: "high", caseIds: ["case-1"], tags: ["payment routing"], orgType: "Trading", notes: "Account used to distribute collected funds." },
  { id: "andheri", type: "location", label: "Shivam Electronics", riskLevel: "high", caseIds: ["case-1"], tags: ["origin incident"], address: "Andheri West, Mumbai", locationType: "Business", lat: 19.136, lng: 72.829 },
  { id: "dharavi", type: "location", label: "Dharavi Naka", riskLevel: "medium", caseIds: ["case-1"], tags: ["meeting point"], address: "Dharavi, Mumbai", locationType: "Public area", lat: 19.038, lng: 72.855 },
  { id: "malad", type: "location", label: "Evershine Nagar", riskLevel: "high", caseIds: ["case-1", "case-2"], tags: ["cross-case location"], address: "Malad West, Mumbai", locationType: "Public area", lat: 19.186, lng: 72.839 },
  { id: "car", type: "vehicle", label: "MH-02-BQ-4471", riskLevel: "high", caseIds: ["case-1"], tags: ["FIR vehicle"], plate: "MH-02-BQ-4471", makeModel: "Dark sedan", registeredTo: "Arun Tawde" },
  { id: "bike", type: "vehicle", label: "MH-07-KL-3305", riskLevel: "high", caseIds: ["case-2"], tags: ["interception vehicle"], plate: "MH-07-KL-3305", makeModel: "Black motorcycle", registeredTo: "Unknown" },
];

export const relationships: Relationship[] = [
  { id: "r1", source: "rajan", target: "imran", type: "associate", weight: 5, evidenceSource: "FIR & Police Reports", observedOn: "2026-02-03", description: "Named together in the Shivam Electronics extortion FIR." },
  { id: "r2", source: "rajan", target: "vikram", type: "communication", weight: 4, evidenceSource: "Call Detail Records", observedOn: "2026-03-10", description: "Repeated calls before the Dadar planning meeting." },
  { id: "r3", source: "rajan", target: "nasreen", type: "financial", weight: 3, evidenceSource: "Financial Transactions", observedOn: "2026-02-18", description: "Rajan routed two unexplained payments to Nasreen." },
  { id: "r4", source: "nasreen", target: "rk", type: "ownership", weight: 2, evidenceSource: "Financial Transactions", observedOn: "2026-02-19", description: "Controls the account used by RK Enterprises." },
  { id: "r5", source: "rk", target: "vikram", type: "financial", weight: 4, evidenceSource: "Financial Transactions", observedOn: "2026-03-11", description: "Collections allocated to Vikram for logistics." },
  { id: "r6", source: "vikram", target: "imran", type: "financial", weight: 2, evidenceSource: "Financial Transactions", observedOn: "2026-03-14", description: "Field-coordination payment corroborated by CDR." },
  { id: "r7", source: "arun", target: "car", type: "ownership", weight: 1, evidenceSource: "FIR & Police Reports", observedOn: "2026-02-03", description: "Arun drove the sedan named in the FIR." },
  { id: "r8", source: "car", target: "andheri", type: "frequents", weight: 2, evidenceSource: "Surveillance Reports", observedOn: "2026-02-03", description: "ATM CCTV captured the vehicle outside Shivam Electronics." },
  { id: "r9", source: "rajan", target: "dharavi", type: "frequents", weight: 2, evidenceSource: "Surveillance Reports", observedOn: "2026-03-14", description: "Observed with Vikram near Dharavi Naka." },
  { id: "r10", source: "imran", target: "salim", type: "communication", weight: 5, evidenceSource: "Call Detail Records", observedOn: "2026-08-03", description: "Repeated calls before the Malad interception." },
  { id: "r11", source: "nasreen", target: "salim", type: "financial", weight: 2, evidenceSource: "Financial Transactions", observedOn: "2026-04-22", description: "Unexplained transfer predating the CASE_002 activity." },
  { id: "r12", source: "salim", target: "bike", type: "frequents", weight: 1, evidenceSource: "FIR & Police Reports", observedOn: "2026-08-03", description: "Intercepted near Evershine Nagar on the motorcycle." },
  { id: "r13", source: "bike", target: "malad", type: "frequents", weight: 1, evidenceSource: "Surveillance Reports", observedOn: "2026-08-03", description: "Observed at the Malad interception point." },
];

export const alerts: Alert[] = [
  { id: "a1", title: "Cross-case bridge: Imran Sheikh", description: "Imran Sheikh links the CASE_001 extortion network to the Malad narcotics inquiry through repeated contact with Salim Qureshi.", severity: "high", status: "new", patternType: "Cross-case connection", relatedEntityIds: ["imran", "salim"], caseId: "case-2", detectedOn: "2026-08-04", history: [{ actor: "System", action: "Cross-case entity match detected", at: "2026-08-04 14:30" }] },
  { id: "a2", title: "Financial routing through RK Enterprises", description: "Rajan, Nasreen and Vikram form a repeated payment chain with no matching invoices.", severity: "high", status: "under review", patternType: "Financial anomaly", relatedEntityIds: ["rajan", "nasreen", "rk", "vikram"], caseId: "case-1", detectedOn: "2026-03-11", history: [{ actor: "System", action: "Routing pattern flagged", at: "2026-03-11 10:04" }] },
  { id: "a3", title: "Co-located call and sighting", description: "Rajan and Vikram called one another shortly before CCTV placed them at Dharavi Naka.", severity: "medium", status: "under review", patternType: "Communication corroboration", relatedEntityIds: ["rajan", "vikram", "dharavi"], caseId: "case-1", detectedOn: "2026-03-14", history: [{ actor: "System", action: "CDR and CCTV correlation created", at: "2026-03-14 23:05" }] },
];

export const dataSources: DataSource[] = [
  { id: "ds1", name: "FIR & Police Reports", description: "Curated FIRs from Andheri, Dadar, Dharavi, Govandi and Malad.", recordCount: 6, lastSync: "2026-09-22 15:50", status: "connected" },
  { id: "ds2", name: "Call Detail Records", description: "CASE_001 and CASE_002 phone-call evidence.", recordCount: 25, lastSync: "2026-09-22 15:53", status: "connected" },
  { id: "ds3", name: "Financial Transactions", description: "RK Enterprises routing and the Salim transfer.", recordCount: 12, lastSync: "2026-09-22 15:50", status: "connected" },
  { id: "ds4", name: "Surveillance Reports", description: "CCTV observations at Andheri, Dadar, Govandi and Malad.", recordCount: 5, lastSync: "2026-09-22 15:50", status: "connected" },
  { id: "ds5", name: "Social Media Intelligence", description: "Public posts correlated with known meetings.", recordCount: 8, lastSync: "2026-09-22 15:50", status: "connected" },
  { id: "ds6", name: "Criminal History Database", description: "Prior-record and cross-case linkage checks.", recordCount: 2, lastSync: "2026-09-22 15:45", status: "connected" },
  { id: "ds7", name: "Intelligence Agency Reports", description: "No curated report pending.", recordCount: 0, lastSync: "2026-09-22 15:45", status: "syncing" },
];

export const getEntityById = (id: string) => entities.find((e) => e.id === id);
export const getCaseById = (id: string) => cases.find((c) => c.id === id);
export const relationshipsFor = (id: string) => relationships.filter((r) => r.source === id || r.target === id);
export interface CorroboratedLink { otherId: string; sources: SourceType[]; relationshipIds: string[]; }
export function corroborationFor(id: string): CorroboratedLink[] { const grouped = new Map<string, Relationship[]>(); for (const r of relationshipsFor(id)) { const other = r.source === id ? r.target : r.source; grouped.set(other, [...(grouped.get(other) ?? []), r]); } return [...grouped].filter(([, rs]) => new Set(rs.map((r) => r.evidenceSource)).size > 1).map(([otherId, rs]) => ({ otherId, sources: [...new Set(rs.map((r) => r.evidenceSource))], relationshipIds: rs.map((r) => r.id) })); }
export const entitiesForCase = (id: string) => entities.filter((e) => e.caseIds.includes(id));
export const crossCaseEntities = () => entities.filter((e) => e.caseIds.length > 1);
export const topConnectedEntities = (limit = 5) => entities.map((entity) => ({ entity, count: relationshipsFor(entity.id).length })).sort((a, b) => b.count - a.count).slice(0, limit);
export const relationshipsForCase = (id: string) => { const ids = new Set(entitiesForCase(id).map((e) => e.id)); return relationships.filter((r) => ids.has(r.source) && ids.has(r.target)); };
const scores = computeCentrality(entities, relationships);
export interface NetworkRole { score: number; degree: number; degreeRank: number; betweennessRank: number; pageRankRank: number; totalEntities: number; reasons: string[]; }
export function networkRoleFor(id: string): NetworkRole | undefined { const score = scores.get(id); if (!score) return; const ranked = (key: "degree" | "betweenness" | "pageRank") => [...scores.entries()].sort((a,b) => b[1][key]-a[1][key]).findIndex(([key]) => key === id) + 1; const total = scores.size; return { score: Math.round((score.degree / Math.max(1, ...[...scores.values()].map((x) => x.degree))) * 100), degree: score.degree, degreeRank: ranked("degree"), betweennessRank: ranked("betweenness"), pageRankRank: ranked("pageRank"), totalEntities: total, reasons: ["Ranked from curated FIR, CDR, financial and surveillance evidence."] }; }
export interface CaseLink { otherCaseId: string; sharedEntities: Entity[]; sharedRelationships: Relationship[]; }
export function linkedCasesFor(id: string): CaseLink[] { const own = new Set(entitiesForCase(id).map((e) => e.id)); return cases.filter((c) => c.id !== id).map((c) => { const sharedEntities = entitiesForCase(c.id).filter((e) => own.has(e.id)); return { otherCaseId: c.id, sharedEntities, sharedRelationships: relationshipsForCase(c.id).filter((r) => sharedEntities.some((e) => e.id === r.source || e.id === r.target)) }; }).filter((link) => link.sharedEntities.length); }
