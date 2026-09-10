import type { AlertSeverity, CaseStatus, Entity, EntityType, RiskLevel } from "../data/types";

export function RiskBadge({ level }: { level: RiskLevel }) {
  const labels: Record<RiskLevel, string> = { high: "High risk", medium: "Medium risk", low: "Low risk" };
  return <span className={`badge badge-risk-${level}`}>{labels[level]}</span>;
}

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const labels: Record<AlertSeverity, string> = { high: "High", medium: "Medium", low: "Low" };
  return <span className={`badge badge-risk-${severity}`}>{labels[severity]}</span>;
}

const entityTypeAbbrev: Record<EntityType, string> = {
  person: "PER",
  organization: "ORG",
  location: "LOC",
  vehicle: "VEH",
  phone: "TEL",
};

export const entityTypeLabel: Record<EntityType, string> = {
  person: "Person",
  organization: "Organisation",
  location: "Location",
  vehicle: "Vehicle",
  phone: "Phone",
};

export function EntityIcon({ type }: { type: EntityType }) {
  return <span className={`entity-icon entity-icon-${type}`}>{entityTypeAbbrev[type]}</span>;
}

export function entitySubLabel(e: Entity): string {
  switch (e.type) {
    case "person":
      return e.status.charAt(0).toUpperCase() + e.status.slice(1);
    case "organization":
      return e.orgType;
    case "location":
      return e.locationType;
    case "vehicle":
      return e.makeModel;
    case "phone":
      return e.carrier ?? "";
  }
}

export function caseStatusColor(status: CaseStatus): string {
  if (status === "active") return "var(--status-connected)";
  if (status === "under review") return "var(--status-syncing)";
  return "var(--text-tertiary)";
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

export function formatDateTime(iso: string): string {
  return iso;
}
