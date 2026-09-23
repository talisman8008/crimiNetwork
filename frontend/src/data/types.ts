export type EntityType = "person" | "organization" | "location" | "vehicle" | "phone";

export type RiskLevel = "low" | "medium" | "high";

export type PersonStatus = "suspect" | "associate" | "witness" | "victim" | "unknown";

export interface BaseEntity {
  id: string;
  type: EntityType;
  label: string;
  riskLevel: RiskLevel;
  caseIds: string[];
  tags: string[];
  notes?: string;
}

export type Sex = "Male" | "Female";

export interface PersonEntity extends BaseEntity {
  type: "person";
  aliases?: string[];
  dob?: string;
  sex?: Sex;
  status: PersonStatus;
  lastKnownLocation?: string;
  lat?: number;
  lng?: number;
}

export interface OrganizationEntity extends BaseEntity {
  type: "organization";
  orgType: string;
  registrationId?: string;
}

export interface LocationEntity extends BaseEntity {
  type: "location";
  address: string;
  locationType: string;
  lat: number;
  lng: number;
}

export interface VehicleEntity extends BaseEntity {
  type: "vehicle";
  plate: string;
  makeModel: string;
  registeredTo?: string;
}

export interface PhoneEntity extends BaseEntity {
  type: "phone";
  number: string;
  carrier?: string;
  registeredTo?: string;
}

export type Entity = PersonEntity | OrganizationEntity | LocationEntity | VehicleEntity | PhoneEntity;

export type RelationType =
  | "associate"
  | "family"
  | "financial"
  | "communication"
  | "ownership"
  | "frequents"
  | "employment";

export type SourceType =
  | "FIR & Police Reports"
  | "Call Detail Records"
  | "Financial Transactions"
  | "Surveillance Reports"
  | "Social Media Intelligence"
  | "Criminal History Database"
  | "Intelligence Agency Reports";

export interface Relationship {
  id: string;
  source: string;
  target: string;
  type: RelationType;
  weight: number;
  evidenceSource: SourceType;
  observedOn: string;
  description: string;
}

export type CaseStatus = "active" | "under review" | "closed";
export type CasePriority = "high" | "medium" | "low";

export interface Case {
  id: string;
  code: string;
  title: string;
  status: CaseStatus;
  priority: CasePriority;
  openedOn: string;
  leadOfficer: string;
  station: string;
  entityIds: string[];
  summary: string;
  sections: string[];
}

export interface Officer {
  id: string;
  name: string;
  rank: string;
  station: string;
  phone?: string;
}

export interface CaseAssignment {
  caseId: string;
  officerId: string;
  role: string;
}

/** Which console an officer signs in to. Supervisors assign and oversee; investigators work cases. */
export type UserRole = "supervisor" | "investigator";

export type AlertSeverity = "high" | "medium" | "low";
export type AlertStatus = "new" | "under review" | "dismissed" | "actioned";

export interface LogEntry {
  actor: string;
  action: string;
  at: string;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  patternType: string;
  relatedEntityIds: string[];
  caseId: string;
  detectedOn: string;
  history: LogEntry[];
  viewed?: boolean;
}

export interface DataSource {
  id: string;
  name: SourceType;
  description: string;
  recordCount: number;
  lastSync: string;
  status: "connected" | "syncing" | "error";
}

export type FootageStatus = "unreviewed" | "reviewed" | "flagged";

export interface CctvFootage {
  id: string;
  title: string;
  cameraId: string;
  cameraType: string;
  source: string;
  monitoredBy: string;
  caseId: string;
  recordedOn: string;
  duration: string;
  locationLabel: string;
  lat: number;
  lng: number;
  status: FootageStatus;
  tags: string[];
  linkedEntityIds: string[];
  notes: string;
  history: LogEntry[];
}

export type CourtHearingStatus = "upcoming" | "completed" | "adjourned";

export interface CourtDate {
  id: string;
  caseId: string;
  hearingType: string;
  court: string;
  judge: string;
  date: string;
  time: string;
  status: CourtHearingStatus;
  notes?: string;
}

export type AccessStatus = "success" | "failed";
export type AccessAction = "login" | "logout";

export interface AccessLogEntry {
  id: string;
  officerId: string;
  action: AccessAction;
  status: AccessStatus;
  ipAddress: string;
  location: string;
  device: string;
  at: string;
}

export type SocialPlatform = "X" | "Facebook" | "Instagram" | "Telegram";

export interface SocialPost {
  id: string;
  platform: SocialPlatform;
  handle: string;
  postedOn: string;
  content: string;
  flagReason: string;
  location?: string;
}

export interface SocialProfile {
  entityId: string;
  platform: SocialPlatform;
  handle: string;
  displayName: string;
  followers: number;
  lastScanned: string;
  posts: SocialPost[];
}

/** What kind of thing happened at a point in time. */
export type TimelineEventType =
  | "call"
  | "sighting"
  | "transaction"
  | "cell-site"
  | "vehicle-movement"
  | "meeting";

/**
 * A single timestamped occurrence: a call placed, a subject seen on camera, a vehicle logged at a
 * checkpoint, a handset registering on a tower. These are the raw observations the network graph
 * is built from, kept at their original clock time so movements and contacts can be replayed
 * hour by hour rather than only day by day.
 */
export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  caseId: string;
  /** ISO date, e.g. 2026-06-18 */
  date: string;
  /** 24h clock, e.g. "23:41" */
  time: string;
  /** Entities involved — for a call this is [caller, receiver]. */
  entityIds: string[];
  /** Where it happened, when the source records a position. */
  lat?: number;
  lng?: number;
  locationLabel?: string;
  /** Tower / camera / checkpoint identifier the record came off. */
  sourceRef?: string;
  evidenceSource: SourceType;
  summary: string;
  /** Call duration in seconds, where applicable. */
  durationSec?: number;
  /** Transaction value in rupees, where applicable. */
  amount?: number;
}
