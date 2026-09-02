import type { Alert, Case, DataSource, Entity, Relationship, SourceType } from "./types";
import { computeCentrality } from "../lib/centrality";

export const cases: Case[] = [
  {
    id: "case-1",
    code: "FIR/2026/04471",
    title: "Interstate Narcotics Distribution Ring",
    status: "active",
    priority: "high",
    openedOn: "2026-06-02",
    leadOfficer: "Insp. R. Chauhan",
    station: "Central Crime Station, Sector 14",
    entityIds: ["p1", "p2", "p3", "p4", "p5", "o1", "o2", "l1", "l2", "l3", "v1", "v2", "ph1", "ph2", "ph3"],
    summary:
      "Multi-city distribution network suspected of moving contraband through a logistics front company. Linked via CDR clustering and financial structuring flags.",
    sections: ["NDPS Act, 1985: Ss. 8(c), 22(c), 27A, 29", "BNS, 2023: S. 61(2) (criminal conspiracy)"],
  },
  {
    id: "case-2",
    code: "FIR/2026/03988",
    title: "Shell Company Financial Fraud",
    status: "under review",
    priority: "medium",
    openedOn: "2026-05-14",
    leadOfficer: "SI P. Nair",
    station: "Economic Offences Wing",
    entityIds: ["p3", "p6", "p7", "o2", "o3", "l3", "l4", "ph4"],
    summary:
      "Suspected layering of funds through shell entities sharing a registered address with a subject from FIR/2026/04471.",
    sections: [
      "BNS, 2023: Ss. 316(2), 318(4), 336(3), 340(2), 61(2)",
      "Prevention of Money Laundering Act, 2002: Ss. 3, 4 (predicate offence referred to ED)",
    ],
  },
];

export const entities: Entity[] = [
  {
    id: "p1",
    type: "person",
    label: "Arvind Mehta",
    riskLevel: "high",
    caseIds: ["case-1"],
    tags: ["prior conviction", "flight risk"],
    status: "suspect",
    aliases: ["A.M.", "Bunty"],
    dob: "1985-03-11",
    sex: "Male",
    lastKnownLocation: "Sector 21, Panipat",
    lat: 29.388,
    lng: 76.955,
    notes: "Named in two prior FIRs for possession. Currently out on bail.",
  },
  {
    id: "p2",
    type: "person",
    label: "Suresh Kadam",
    riskLevel: "high",
    caseIds: ["case-1"],
    tags: ["logistics"],
    status: "suspect",
    dob: "1981-07-22",
    sex: "Male",
    lastKnownLocation: "Nashik",
    lat: 19.9975,
    lng: 73.7898,
    notes: "Owns transport permits for two of the flagged vehicles.",
  },
  {
    id: "p3",
    type: "person",
    label: "Ritika Sethi",
    riskLevel: "medium",
    caseIds: ["case-1", "case-2"],
    tags: ["financial intermediary"],
    status: "suspect",
    dob: "1992-02-14",
    sex: "Female",
    lastKnownLocation: "Andheri East, Mumbai",
    lat: 19.1136,
    lng: 72.8697,
    notes: "Director of record for Nova Freight Solutions and Zenith Traders.",
  },
  {
    id: "p4",
    type: "person",
    label: "Devraj Singh",
    riskLevel: "medium",
    caseIds: ["case-1"],
    tags: ["courier"],
    status: "associate",
    dob: "1997-09-05",
    sex: "Male",
    lastKnownLocation: "Karnal",
    lat: 29.6857,
    lng: 76.9905,
  },
  {
    id: "p5",
    type: "person",
    label: "Farhan Qureshi",
    riskLevel: "low",
    caseIds: ["case-1"],
    tags: ["informant lead"],
    status: "witness",
    dob: "2000-01-18",
    sex: "Male",
    lastKnownLocation: "Panipat",
    lat: 29.3909,
    lng: 76.9635,
  },
  {
    id: "p6",
    type: "person",
    label: "Meera Kulkarni",
    riskLevel: "medium",
    caseIds: ["case-2"],
    tags: ["accountant"],
    status: "suspect",
    dob: "1985-11-30",
    sex: "Female",
    lastKnownLocation: "Pune",
    lat: 18.5204,
    lng: 73.8567,
    notes: "Handles books for both shell entities under review.",
  },
  {
    id: "p7",
    type: "person",
    label: "Vikram Oberoi",
    riskLevel: "low",
    caseIds: ["case-2"],
    tags: ["beneficial owner"],
    status: "associate",
    dob: "1974-06-08",
    sex: "Male",
    lastKnownLocation: "Bandra West, Mumbai",
    lat: 19.0596,
    lng: 72.8295,
  },
  {
    id: "o1",
    type: "organization",
    label: "Nova Freight Solutions",
    riskLevel: "high",
    caseIds: ["case-1"],
    tags: ["logistics front"],
    orgType: "Transport & Logistics",
    registrationId: "U60200MH2019PTC318842",
    notes: "Fleet of 6 registered vehicles, 2 flagged in prior surveillance.",
  },
  {
    id: "o2",
    type: "organization",
    label: "Zenith Traders",
    riskLevel: "medium",
    caseIds: ["case-1", "case-2"],
    tags: ["shell suspected"],
    orgType: "General Trading",
    registrationId: "U51909MH2021PTC356210",
  },
  {
    id: "o3",
    type: "organization",
    label: "Kulkarni & Associates",
    riskLevel: "low",
    caseIds: ["case-2"],
    tags: ["accounting firm"],
    orgType: "Professional Services",
  },
  {
    id: "l1",
    type: "location",
    label: "Warehouse 7, GT Road Depot",
    riskLevel: "high",
    caseIds: ["case-1"],
    tags: ["staging point"],
    address: "Plot 7, GT Road Industrial Area, Panipat",
    locationType: "Warehouse",
    lat: 29.3968,
    lng: 76.9558,
  },
  {
    id: "l2",
    type: "location",
    label: "Sethi Residence",
    riskLevel: "low",
    caseIds: ["case-1"],
    tags: ["residence"],
    address: "14B, Andheri East, Mumbai",
    locationType: "Residence",
    lat: 19.1155,
    lng: 72.8697,
  },
  {
    id: "l3",
    type: "location",
    label: "402 Ashoka Chambers",
    riskLevel: "medium",
    caseIds: ["case-1", "case-2"],
    tags: ["shared registered address"],
    address: "402 Ashoka Chambers, Nariman Point, Mumbai",
    locationType: "Registered Office",
    lat: 18.9256,
    lng: 72.8242,
    notes: "Registered office for both Nova Freight Solutions and Zenith Traders.",
  },
  {
    id: "l4",
    type: "location",
    label: "Kulkarni & Associates Office",
    riskLevel: "low",
    caseIds: ["case-2"],
    tags: ["office"],
    address: "12 FC Road, Pune",
    locationType: "Office",
    lat: 18.5246,
    lng: 73.8481,
  },
  {
    id: "v1",
    type: "vehicle",
    label: "MH12 GT 4471",
    riskLevel: "high",
    caseIds: ["case-1"],
    tags: ["flagged in surveillance"],
    plate: "MH12 GT 4471",
    makeModel: "Tata 407 (Container)",
    registeredTo: "Nova Freight Solutions",
  },
  {
    id: "v2",
    type: "vehicle",
    label: "HR26 BQ 9902",
    riskLevel: "medium",
    caseIds: ["case-1"],
    tags: [],
    plate: "HR26 BQ 9902",
    makeModel: "Mahindra Bolero Pickup",
    registeredTo: "Suresh Kadam",
  },
  {
    id: "ph1",
    type: "phone",
    label: "+91 98xxxxx211",
    riskLevel: "high",
    caseIds: ["case-1"],
    tags: ["burner suspected"],
    number: "+91 98xxxxx211",
    carrier: "Airtel",
    registeredTo: "Unregistered / prepaid",
  },
  {
    id: "ph2",
    type: "phone",
    label: "+91 70xxxxx884",
    riskLevel: "medium",
    caseIds: ["case-1"],
    tags: [],
    number: "+91 70xxxxx884",
    carrier: "Jio",
    registeredTo: "Devraj Singh",
  },
  {
    id: "ph3",
    type: "phone",
    label: "+91 99xxxxx002",
    riskLevel: "low",
    caseIds: ["case-1"],
    tags: [],
    number: "+91 99xxxxx002",
    carrier: "Vi",
    registeredTo: "Farhan Qureshi",
  },
  {
    id: "ph4",
    type: "phone",
    label: "+91 88xxxxx430",
    riskLevel: "low",
    caseIds: ["case-2"],
    tags: [],
    number: "+91 88xxxxx430",
    carrier: "Airtel",
    registeredTo: "Meera Kulkarni",
  },
  // Records ingested from separate source systems that may describe people already on file.
  // Name spellings differ between CCTNS, bank KYC, and telecom subscriber data, so these arrive
  // as distinct entities until an investigator confirms or rejects the merge.
  {
    id: "p8",
    type: "person",
    label: "Aravind Mehta",
    riskLevel: "medium",
    caseIds: ["case-1"],
    tags: ["unverified identity"],
    status: "suspect",
    aliases: ["A. Mehta"],
    dob: "1985-03-11",
    sex: "Male",
    lastKnownLocation: "Sector 21, Panipat",
    lat: 29.388,
    lng: 76.955,
    notes: "Account holder name as recorded in bank KYC documents attached to the STR filing.",
  },
  {
    id: "p9",
    type: "person",
    label: "S. Kadam",
    riskLevel: "medium",
    caseIds: ["case-1"],
    tags: ["unverified identity"],
    status: "suspect",
    dob: "1990-07-22",
    sex: "Male",
    lastKnownLocation: "Model Town, Panipat",
    notes: "Subscriber name on telecom records; initials only, no full name captured.",
  },
  {
    id: "p10",
    type: "person",
    label: "Meera Kulkarni-Deshpande",
    riskLevel: "low",
    caseIds: ["case-2"],
    tags: ["unverified identity"],
    status: "witness",
    dob: "1985-11-30",
    sex: "Female",
    lastKnownLocation: "Pune",
    notes: "Name as it appears on company filings; may be the same individual under a married surname.",
  },
];

export const relationships: Relationship[] = [
  { id: "r1", source: "p1", target: "p2", type: "associate", weight: 3, evidenceSource: "Criminal History Database", observedOn: "2026-06-04", description: "Co-accused in a 2023 possession case." },
  { id: "r2", source: "p1", target: "ph1", type: "communication", weight: 5, evidenceSource: "Call Detail Records", observedOn: "2026-06-10", description: "Primary contact number linked via CDR clustering." },
  { id: "r3", source: "ph1", target: "ph2", type: "communication", weight: 42, evidenceSource: "Call Detail Records", observedOn: "2026-06-18", description: "42 calls over 9 days, concentrated 11pm-2am." },
  { id: "r4", source: "ph2", target: "p4", type: "communication", weight: 1, evidenceSource: "Call Detail Records", observedOn: "2026-06-05", description: "Registered subscriber." },
  { id: "r5", source: "p2", target: "o1", type: "employment", weight: 1, evidenceSource: "FIR & Police Reports", observedOn: "2026-06-03", description: "Listed as fleet supervisor." },
  { id: "r6", source: "o1", target: "v1", type: "ownership", weight: 1, evidenceSource: "FIR & Police Reports", observedOn: "2026-06-03", description: "Registered owner of record." },
  { id: "r7", source: "v1", target: "l1", type: "frequents", weight: 11, evidenceSource: "Surveillance Reports", observedOn: "2026-06-20", description: "Logged entering/exiting depot 11 times in 3 weeks." },
  { id: "r8", source: "p4", target: "l1", type: "frequents", weight: 6, evidenceSource: "Surveillance Reports", observedOn: "2026-06-19", description: "Observed on-site during evening shifts." },
  { id: "r9", source: "p2", target: "v2", type: "ownership", weight: 1, evidenceSource: "FIR & Police Reports", observedOn: "2026-06-03", description: "Registered owner." },
  { id: "r10", source: "p3", target: "o1", type: "ownership", weight: 1, evidenceSource: "Criminal History Database", observedOn: "2026-05-28", description: "Listed as company director." },
  { id: "r11", source: "p3", target: "o2", type: "ownership", weight: 1, evidenceSource: "Criminal History Database", observedOn: "2026-05-28", description: "Listed as company director." },
  { id: "r12", source: "o1", target: "l3", type: "frequents", weight: 1, evidenceSource: "FIR & Police Reports", observedOn: "2026-05-30", description: "Registered office address." },
  { id: "r13", source: "o2", target: "l3", type: "frequents", weight: 1, evidenceSource: "FIR & Police Reports", observedOn: "2026-05-30", description: "Registered office address, shared with Nova Freight Solutions." },
  { id: "r14", source: "p3", target: "l2", type: "frequents", weight: 1, evidenceSource: "Surveillance Reports", observedOn: "2026-06-01", description: "Primary residence." },
  { id: "r15", source: "o1", target: "o2", type: "financial", weight: 7, evidenceSource: "Financial Transactions", observedOn: "2026-06-15", description: "7 inter-company transfers flagged for structuring pattern." },
  { id: "r16", source: "p1", target: "p5", type: "associate", weight: 2, evidenceSource: "Social Media Intelligence", observedOn: "2026-06-08", description: "Tagged together in 2 public posts near Warehouse 7." },
  { id: "r17", source: "p5", target: "ph3", type: "communication", weight: 1, evidenceSource: "Call Detail Records", observedOn: "2026-06-08", description: "Registered subscriber." },
  { id: "r18", source: "p3", target: "p6", type: "financial", weight: 4, evidenceSource: "Financial Transactions", observedOn: "2026-05-20", description: "Recurring transfers between personal accounts, irregular amounts." },
  { id: "r19", source: "p6", target: "o3", type: "employment", weight: 1, evidenceSource: "FIR & Police Reports", observedOn: "2026-05-15", description: "Senior accountant on record." },
  { id: "r20", source: "o3", target: "l4", type: "frequents", weight: 1, evidenceSource: "FIR & Police Reports", observedOn: "2026-05-15", description: "Registered office address." },
  { id: "r21", source: "p6", target: "ph4", type: "communication", weight: 1, evidenceSource: "Call Detail Records", observedOn: "2026-05-16", description: "Registered subscriber." },
  { id: "r22", source: "p7", target: "o2", type: "ownership", weight: 1, evidenceSource: "Criminal History Database", observedOn: "2026-05-18", description: "Beneficial owner, not listed as director." },
  { id: "r23", source: "p7", target: "p6", type: "associate", weight: 2, evidenceSource: "Social Media Intelligence", observedOn: "2026-05-22", description: "Connected on professional network, mutual endorsements." },
  { id: "r24", source: "p3", target: "p1", type: "family", weight: 1, evidenceSource: "Criminal History Database", observedOn: "2026-05-25", description: "Cousin, disclosed in prior case records." },
  { id: "r25", source: "p1", target: "p2", type: "financial", weight: 3, evidenceSource: "Financial Transactions", observedOn: "2026-06-12", description: "Three transfers from Mehta to Kadam totaling ₹4.1L in the week before the depot activity spike." },
  { id: "r26", source: "p7", target: "p6", type: "communication", weight: 6, evidenceSource: "Call Detail Records", observedOn: "2026-05-24", description: "6 calls in 48 hours, corroborating the social-media association." },
];

export const alerts: Alert[] = [
  {
    id: "a1",
    title: "High-frequency late-night call cluster",
    description: "42 calls between two flagged numbers concentrated between 11 PM and 2 AM over a 9-day window, a pattern inconsistent with declared occupations.",
    severity: "high",
    status: "new",
    patternType: "Communication anomaly",
    relatedEntityIds: ["ph1", "ph2"],
    caseId: "case-1",
    detectedOn: "2026-08-19",
    history: [
      { actor: "System", action: "Pattern detected from CDR ingest batch #4471", at: "2026-08-19 06:02" },
    ],
  },
  {
    id: "a2",
    title: "Shared registered address across two entities",
    description: "Nova Freight Solutions and Zenith Traders, both linked to Ritika Sethi, share a registered office with no visible co-tenancy filing.",
    severity: "high",
    status: "under review",
    patternType: "Structural link",
    relatedEntityIds: ["o1", "o2", "l3"],
    caseId: "case-1",
    detectedOn: "2026-08-17",
    history: [
      { actor: "System", action: "Structural link flagged during registry cross-check", at: "2026-08-17 09:14" },
      { actor: "Insp. R. Chauhan", action: "Marked under review", at: "2026-08-18 11:40" },
    ],
  },
  {
    id: "a3",
    title: "Inter-company transfers below reporting threshold",
    description: "7 transfers from Nova Freight Solutions to Zenith Traders, each individually below the ₹10,00,000 threshold that triggers a Suspicious Transaction Report to FIU-IND, totaling ₹18.4L over 3 weeks.",
    severity: "high",
    status: "new",
    patternType: "Financial structuring",
    relatedEntityIds: ["o1", "o2"],
    caseId: "case-1",
    detectedOn: "2026-08-21",
    history: [
      { actor: "System", action: "Structuring threshold rule triggered on transfer batch", at: "2026-08-21 04:20" },
    ],
  },
  {
    id: "a4",
    title: "Vehicle recurring at flagged staging point",
    description: "MH12 GT 4471 logged at Warehouse 7 eleven times in three weeks, outside its declared delivery route manifest.",
    severity: "medium",
    status: "under review",
    patternType: "Movement pattern",
    relatedEntityIds: ["v1", "l1"],
    caseId: "case-1",
    detectedOn: "2026-08-14",
    history: [
      { actor: "System", action: "Movement pattern flagged from surveillance log sync", at: "2026-08-14 20:05" },
      { actor: "SI P. Nair", action: "Marked under review, requested manifest cross-check", at: "2026-08-15 10:22" },
    ],
  },
  {
    id: "a5",
    title: "New associate surfaced via social graph",
    description: "Farhan Qureshi identified as a repeated contact of Arvind Mehta through geotagged posts near the staging warehouse.",
    severity: "medium",
    status: "actioned",
    patternType: "Emerging connection",
    relatedEntityIds: ["p1", "p5"],
    caseId: "case-1",
    detectedOn: "2026-08-09",
    history: [
      { actor: "System", action: "Emerging connection surfaced from social graph crawl", at: "2026-08-09 02:11" },
      { actor: "Insp. R. Chauhan", action: "Actioned: field team dispatched for witness interview", at: "2026-08-10 15:30" },
    ],
  },
  {
    id: "a6",
    title: "Undisclosed family relationship between subjects",
    description: "Ritika Sethi and Arvind Mehta share a familial link recorded in an earlier case file, not disclosed in either entity's current filings.",
    severity: "medium",
    status: "new",
    patternType: "Undisclosed relationship",
    relatedEntityIds: ["p1", "p3"],
    caseId: "case-1",
    detectedOn: "2026-08-22",
    history: [
      { actor: "System", action: "Undisclosed relationship flagged against criminal history database", at: "2026-08-22 07:48" },
    ],
  },
  {
    id: "a7",
    title: "Irregular personal fund transfers",
    description: "Recurring transfers between Ritika Sethi and Meera Kulkarni with irregular, non-round amounts inconsistent with stated business purpose.",
    severity: "low",
    status: "under review",
    patternType: "Financial anomaly",
    relatedEntityIds: ["p3", "p6"],
    caseId: "case-2",
    detectedOn: "2026-08-11",
    history: [
      { actor: "System", action: "Financial anomaly flagged from transaction feed", at: "2026-08-11 05:33" },
      { actor: "SI P. Nair", action: "Marked under review", at: "2026-08-12 09:00" },
    ],
  },
  {
    id: "a8",
    title: "Beneficial owner absent from filings",
    description: "Vikram Oberoi identified as beneficial owner of Zenith Traders through cross-referenced financial records, but is absent from company directorship filings.",
    severity: "low",
    status: "dismissed",
    patternType: "Ownership discrepancy",
    relatedEntityIds: ["p7", "o2"],
    caseId: "case-2",
    detectedOn: "2026-08-05",
    history: [
      { actor: "System", action: "Ownership discrepancy flagged against directorship filings", at: "2026-08-05 08:15" },
      { actor: "SI P. Nair", action: "Reviewed and dismissed: beneficial owner disclosure found in amended filing", at: "2026-08-06 14:02" },
    ],
  },
];

export const dataSources: DataSource[] = [
  { id: "ds1", name: "FIR & Police Reports", description: "First information reports and station-level case filings, synced via CCTNS.", recordCount: 4812, lastSync: "2026-08-28 06:00", status: "connected" },
  { id: "ds2", name: "Call Detail Records", description: "Subscriber call and SMS metadata obtained from telecom providers under BNSS S. 94.", recordCount: 218430, lastSync: "2026-08-28 05:30", status: "connected" },
  { id: "ds3", name: "Financial Transactions", description: "Bank transfer feeds and Suspicious Transaction Reports (STRs) shared by FIU-IND.", recordCount: 96204, lastSync: "2026-08-28 04:15", status: "connected" },
  { id: "ds4", name: "Surveillance Reports", description: "Field surveillance logs and stakeout observations.", recordCount: 1327, lastSync: "2026-08-27 22:40", status: "connected" },
  { id: "ds5", name: "Social Media Intelligence", description: "Open-source social graph and geotagged post monitoring.", recordCount: 58211, lastSync: "2026-08-28 03:05", status: "syncing" },
  { id: "ds6", name: "Criminal History Database", description: "Prior conviction, chargesheet, and case-linkage records from CCTNS.", recordCount: 12093, lastSync: "2026-08-26 19:00", status: "error" },
  { id: "ds7", name: "Intelligence Agency Reports", description: "Classified MAC (Multi-Agency Centre) inputs and IB dossier correlations.", recordCount: 341, lastSync: "2026-08-28 02:00", status: "connected" },
];

export function getEntityById(id: string): Entity | undefined {
  return entities.find((e) => e.id === id);
}

export function getCaseById(id: string): Case | undefined {
  return cases.find((c) => c.id === id);
}

export function relationshipsFor(entityId: string): Relationship[] {
  return relationships.filter((r) => r.source === entityId || r.target === entityId);
}

export interface CorroboratedLink {
  otherId: string;
  sources: SourceType[];
  relationshipIds: string[];
}

/** Finds entity pairs connected by more than one independent evidence source — e.g. a link confirmed by both
 *  Call Detail Records and Financial Transactions is stronger than one resting on a single source. */
export function corroborationFor(entityId: string): CorroboratedLink[] {
  const byOther = new Map<string, Relationship[]>();
  for (const r of relationshipsFor(entityId)) {
    const otherId = r.source === entityId ? r.target : r.source;
    if (!byOther.has(otherId)) byOther.set(otherId, []);
    byOther.get(otherId)!.push(r);
  }
  const result: CorroboratedLink[] = [];
  for (const [otherId, rels] of byOther) {
    const sources = [...new Set(rels.map((r) => r.evidenceSource))];
    if (sources.length > 1) {
      result.push({ otherId, sources, relationshipIds: rels.map((r) => r.id) });
    }
  }
  return result;
}

export function entitiesForCase(caseId: string): Entity[] {
  return entities.filter((e) => e.caseIds.includes(caseId));
}

export function crossCaseEntities(): Entity[] {
  return entities.filter((e) => e.caseIds.length > 1);
}

/** Ranks every entity across all cases by number of connections — the people and organisations most worth an
 *  investigator's attention regardless of which case brought them in. */
export function topConnectedEntities(limit = 5): { entity: Entity; count: number }[] {
  const degree = new Map<string, number>();
  for (const r of relationships) {
    degree.set(r.source, (degree.get(r.source) ?? 0) + 1);
    degree.set(r.target, (degree.get(r.target) ?? 0) + 1);
  }
  return [...degree.entries()]
    .map(([id, count]) => ({ entity: getEntityById(id), count }))
    .filter((x): x is { entity: Entity; count: number } => !!x.entity)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function relationshipsForCase(caseId: string): Relationship[] {
  const ids = new Set(entitiesForCase(caseId).map((e) => e.id));
  return relationships.filter((r) => ids.has(r.source) && ids.has(r.target));
}

// computed once at load, over the full cross-case graph, since the mock dataset is static
const centralityScores = computeCentrality(entities, relationships);

function rankOf(entityId: string, metric: "degree" | "betweenness" | "pageRank"): number {
  const sorted = [...centralityScores.entries()].sort((a, b) => b[1][metric] - a[1][metric]);
  return sorted.findIndex(([id]) => id === entityId) + 1;
}

export interface NetworkRole {
  score: number;
  degree: number;
  degreeRank: number;
  betweennessRank: number;
  pageRankRank: number;
  totalEntities: number;
  reasons: string[];
}

/** Turns raw centrality maths into an investigator-facing "why does this entity matter" summary,
 *  scored and ranked against every other entity across all cases. */
export function networkRoleFor(entityId: string): NetworkRole | undefined {
  const scores = centralityScores.get(entityId);
  if (!scores) return undefined;

  const allScores = [...centralityScores.values()];
  const maxDegree = Math.max(1, ...allScores.map((s) => s.degree));
  const maxBetweenness = Math.max(1, ...allScores.map((s) => s.betweenness));
  const maxPageRank = Math.max(1, ...allScores.map((s) => s.pageRank));

  const normalized =
    (scores.degree / maxDegree + scores.betweenness / maxBetweenness + scores.pageRank / maxPageRank) / 3;
  const score = Math.round(normalized * 100);

  const degreeRank = rankOf(entityId, "degree");
  const betweennessRank = rankOf(entityId, "betweenness");
  const pageRankRank = rankOf(entityId, "pageRank");
  const totalEntities = centralityScores.size;

  const reasons: string[] = [];
  if (scores.degree === 0) {
    reasons.push("Not yet linked to any other entity in the network.");
  } else {
    if (degreeRank <= 3) {
      reasons.push(
        `Directly linked to ${scores.degree} other ${scores.degree === 1 ? "entity" : "entities"}, ranking #${degreeRank} by direct connections across all cases.`,
      );
    }
    if (betweennessRank <= 3 && scores.betweenness > 0) {
      reasons.push(
        "Sits on the shortest path between otherwise separate parts of the network. Removing this entity would fragment those clusters apart.",
      );
    }
    if (pageRankRank <= 3) {
      reasons.push(
        "Carries outsized influence: closely tied to other well-connected entities, not just numerous ones.",
      );
    }
    if (reasons.length === 0) {
      reasons.push("Peripheral to the network, connected mainly through a single intermediary with limited independent reach.");
    }
  }

  return { score, degree: scores.degree, degreeRank, betweennessRank, pageRankRank, totalEntities, reasons };
}

export interface CaseLink {
  otherCaseId: string;
  sharedEntities: Entity[];
  sharedRelationships: Relationship[];
}

/** Other investigations that touch this one, and exactly what they share. Two case files that
 *  name the same person, company, or address are often the same network seen from two ends. */
export function linkedCasesFor(caseId: string): CaseLink[] {
  const mine = new Set(entitiesForCase(caseId).map((e) => e.id));
  const result: CaseLink[] = [];

  for (const other of cases) {
    if (other.id === caseId) continue;
    const sharedEntities = entitiesForCase(other.id).filter((e) => mine.has(e.id));
    if (sharedEntities.length === 0) continue;

    const sharedIds = new Set(sharedEntities.map((e) => e.id));
    // relationships where a shared entity reaches into the other case's own entities
    const otherIds = new Set(entitiesForCase(other.id).map((e) => e.id));
    const sharedRelationships = relationships.filter(
      (r) =>
        (sharedIds.has(r.source) && otherIds.has(r.target)) ||
        (sharedIds.has(r.target) && otherIds.has(r.source)),
    );

    result.push({ otherCaseId: other.id, sharedEntities, sharedRelationships });
  }

  return result.sort((a, b) => b.sharedEntities.length - a.sharedEntities.length);
}
