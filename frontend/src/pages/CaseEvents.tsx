import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { formatDate, SeverityBadge } from "../components/ui";
import { useActiveCase } from "../lib/activeCase";
import { useCaseAlerts, useCaseGraph, useCases } from "../hooks/useCaseData";
import { courtDates } from "../data/courtData";
import { entitiesForCase, getCaseById } from "../data/mockData";
import { officersForCase } from "../data/officersData";
import type { Alert, CourtDate, CourtHearingStatus } from "../data/types";

type View = "alerts" | "court";

const hearingStatus: Record<CourtHearingStatus, { label: string; color: string }> = {
  upcoming: { label: "Upcoming", color: "var(--status-syncing)" },
  completed: { label: "Completed", color: "var(--status-connected)" },
  adjourned: { label: "Adjourned", color: "var(--text-tertiary)" },
};

const monthAbbrev = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function DateBlock({ date }: { date: string }) {
  const value = new Date(date);
  return <div className="court-date-block"><span className="court-date-month">{monthAbbrev[value.getMonth()]}</span><span className="court-date-day">{value.getDate()}</span><span className="court-date-year">{value.getFullYear()}</span></div>;
}

function AlertCard({ alert, entityLabels, displayDescription, onViewed }: { alert: Alert; entityLabels: Map<string, string>; displayDescription: (description: string) => string; onViewed: () => void }) {
  return <div className="card event-card"><div className="card-body">
    <div className="event-card-top alert-card-title-row"><div className="alert-card-heading"><div className="alert-card-title-group"><SeverityBadge severity={alert.severity} /><h3>{alert.title}</h3></div><p className="alert-card-summary">{displayDescription(alert.description)}</p></div><span className="event-date">{formatDate(alert.detectedOn)}</span></div>
    {alert.relatedEntityIds?.length > 0 && <div className="event-related"><span>Related:</span>{alert.relatedEntityIds.map((id) => <Link key={id} to={`/network?case=${alert.caseId}&entity=${id}`} className="tag">{entityLabels.get(id) ?? id}</Link>)}</div>}
    {alert.status === "new" && <div className="event-actions alert-card-actions"><button className="btn event-mark-viewed" onClick={onViewed}>Mark viewed</button></div>}
  </div></div>;
}

function HearingCard({ hearing }: { hearing: CourtDate }) {
  const relatedCase = getCaseById(hearing.caseId);
  const team = officersForCase(hearing.caseId);
  const accused = entitiesForCase(hearing.caseId).filter((entity) => entity.type === "person" && (entity.status === "suspect" || entity.status === "associate"));
  const meta = hearingStatus[hearing.status];
  return <div className="card event-card"><div className="card-body event-hearing"><DateBlock date={hearing.date} /><div className="event-hearing-main">
    <div className="event-card-top"><div><span className="event-status"><span className="status-dot" style={{ background: meta.color }} />{meta.label}</span><span className="event-time">{hearing.time}</span></div><span className="event-date">{formatDate(hearing.date)}</span></div>
    <h3>{hearing.hearingType}</h3><p>{hearing.court} &middot; Presiding: {hearing.judge}</p>{hearing.notes && <p>{hearing.notes}</p>}
    <div className="event-related"><span>FIR:</span><Link to={`/network?case=${hearing.caseId}`} className="tag">{relatedCase?.code ?? hearing.caseId}</Link>{team.length > 0 && <span className="tag">{(team.find((officer) => officer.role.includes("Lead")) ?? team[0]).name}</span>}{accused.length > 0 && <span className="tag">{accused.length} accused</span>}</div>
  </div></div></div>;
}

export default function CaseEvents() {
  const { activeCaseId } = useActiveCase();
  const { alerts, loading, error, markViewed } = useCaseAlerts(activeCaseId);
  const { entities } = useCaseGraph(activeCaseId);
  const { cases } = useCases();
  const [view, setView] = useState<View>("alerts");
  const [hearingStatusFilter, setHearingStatusFilter] = useState<CourtHearingStatus | "all">("all");
  const entityLabels = useMemo(() => new Map(entities.map((entity) => [entity.id, entity.label])), [entities]);
  const caseNames = useMemo(() => new Map(cases.map((item) => [item.id, item.title])), [cases]);
  const visibleAlerts = useMemo(() => [...alerts].sort((a, b) => (a.detectedOn < b.detectedOn ? 1 : -1)), [alerts]);
  const visibleHearings = useMemo(() => courtDates.filter((item) => item.caseId === activeCaseId).filter((item) => hearingStatusFilter === "all" || item.status === hearingStatusFilter).sort((a, b) => (a.date < b.date ? -1 : 1)), [activeCaseId, hearingStatusFilter]);
  const displayDescription = (description: string) => Array.from(caseNames).reduce((text, [caseId, caseName]) => text.split(caseId).join(caseName), description);

  if (!activeCaseId) return <><PageHeader eyebrow="Case work" title="Events" /><div className="content"><div className="empty-state">Open a case to view its alerts and court dates.</div></div></>;

  return <><PageHeader eyebrow="Case work" title="Events" /><div className="content">
    <div className="events-tabs" role="tablist" aria-label="Case events">{([["alerts", "Alerts"], ["court", "Court dates"]] as const).map(([value, label]) => <button key={value} className={`events-tab${view === value ? " is-active" : ""}`} onClick={() => setView(value)} role="tab" aria-selected={view === value}>{label}</button>)}</div>
    {view === "alerts" && <section className="events-section">{loading && <div className="empty-state">Loading alerts&hellip;</div>}{error && <div className="empty-state">Could not load alerts: {error}</div>}{!loading && !error && visibleAlerts.map((alert) => <AlertCard key={alert.id} alert={alert} entityLabels={entityLabels} displayDescription={displayDescription} onViewed={() => markViewed(alert.id)} />)}{!loading && !error && visibleAlerts.length === 0 && <div className="empty-state">No alerts for this case.</div>}</section>}
    {view === "court" && <section className="events-section"><div className="events-section-heading"><div><span className="eyebrow">Judiciary</span><h2>Court dates</h2></div><span className="tag">{visibleHearings.length}</span></div><div className="filter-bar"><select className="select" value={hearingStatusFilter} onChange={(event) => setHearingStatusFilter(event.target.value as CourtHearingStatus | "all")}><option value="all">All statuses</option><option value="upcoming">Upcoming</option><option value="completed">Completed</option><option value="adjourned">Adjourned</option></select></div>{visibleHearings.map((hearing) => <HearingCard key={hearing.id} hearing={hearing} />)}{visibleHearings.length === 0 && <div className="empty-state">No court dates match the current filters.</div>}</section>}
  </div></>;
}
