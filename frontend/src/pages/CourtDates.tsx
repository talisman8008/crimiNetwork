import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { courtDates } from "../data/courtData";
import { entitiesForCase, getCaseById } from "../data/mockData";
import { officersForCase } from "../data/officersData";
import { formatDate } from "../components/ui";
import type { CourtHearingStatus } from "../data/types";

const statusMeta: Record<CourtHearingStatus, { label: string; color: string }> = {
  upcoming: { label: "Upcoming", color: "var(--status-syncing)" },
  completed: { label: "Completed", color: "var(--status-connected)" },
  adjourned: { label: "Adjourned", color: "var(--text-tertiary)" },
};

const monthAbbrev = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function DateBlock({ date }: { date: string }) {
  const d = new Date(date);
  return (
    <div className="court-date-block">
      <span className="court-date-month">{monthAbbrev[d.getMonth()]}</span>
      <span className="court-date-day">{d.getDate()}</span>
      <span className="court-date-year">{d.getFullYear()}</span>
    </div>
  );
}

export default function CourtDates() {
  const [caseId, setCaseId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<CourtHearingStatus | "all">("all");

  const filtered = useMemo(
    () =>
      courtDates
        .filter((c) => (caseId === "all" ? true : c.caseId === caseId))
        .filter((c) => (statusFilter === "all" ? true : c.status === statusFilter))
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
    [caseId, statusFilter],
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader eyebrow="Judiciary" title="Court Dates" />
      <div className="filter-bar">
        <select className="select" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
          <option value="all">All cases</option>
          <option value="case-1">FIR/2026/04471: Interstate Narcotics Distribution Ring</option>
          <option value="case-2">FIR/2026/03988: Shell Company Financial Fraud</option>
        </select>
        <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as CourtHearingStatus | "all")}>
          <option value="all">All statuses</option>
          <option value="upcoming">Upcoming</option>
          <option value="completed">Completed</option>
          <option value="adjourned">Adjourned</option>
        </select>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-tertiary)" }}>
          {filtered.length} of {courtDates.length} hearings
        </div>
      </div>
      <div className="content">
        <div className="court-timeline" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((c) => {
            const relatedCase = getCaseById(c.caseId);
            const hearingTeam = officersForCase(c.caseId);
            const accused = entitiesForCase(c.caseId).filter(
              (e) => e.type === "person" && (e.status === "suspect" || e.status === "associate"),
            );
            const isPast = c.date < today;
            return (
              <div key={c.id} className="card card-hoverable">
                <div className="card-body" style={{ display: "flex", gap: 18 }}>
                  <DateBlock date={c.date} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 12,
                          color: "var(--text-secondary)",
                        }}
                      >
                        <span className="status-dot" style={{ background: statusMeta[c.status].color }} />
                        {statusMeta[c.status].label}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{c.time}</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{c.hearingType}</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
                      {c.court} &middot; Presiding: {c.judge}
                    </div>
                    {hearingTeam.length > 0 && (
                      <div className="hearing-officers">
                        <div className="hearing-officer-row">
                          <span className="hearing-officer-label">Investigating officer</span>
                          <span className="hearing-officer-value">
                            {(hearingTeam.find((o) => o.role.includes("Lead")) ?? hearingTeam[0]).name}
                          </span>
                        </div>
                        <div className="hearing-officer-row">
                          <span className="hearing-officer-label">Supporting officers</span>
                          <span className="hearing-officer-value">
                            {hearingTeam.length > 1
                              ? hearingTeam
                                  .filter((o) => !o.role.includes("Lead"))
                                  .map((o) => o.name)
                                  .join(", ")
                              : "None assigned"}
                          </span>
                        </div>
                      </div>
                    )}

                    {c.notes && (
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8, maxWidth: 640 }}>{c.notes}</p>
                    )}
                    {relatedCase && (
                      <Link
                        to={`/network?case=${c.caseId}`}
                        className="mono"
                        style={{ fontSize: 12, color: "var(--text-tertiary)", textDecoration: "none" }}
                      >
                        {relatedCase.code} &middot; {relatedCase.title}
                      </Link>
                    )}
                  </div>
                  <aside className="hearing-detail">
                    {c.status === "upcoming" && !isPast && (
                      <span className="tag hearing-countdown">
                        {Math.max(0, Math.round((new Date(c.date).getTime() - new Date(today).getTime()) / 86400000))} days away
                      </span>
                    )}
                    <dl className="hearing-facts">
                      <dt>Presiding judge</dt>
                      <dd>{c.judge}</dd>

                      <dt>Court</dt>
                      <dd>{c.court}</dd>

                      <dt>Listed</dt>
                      <dd>
                        {formatDate(c.date)} at {c.time}
                      </dd>

                      {relatedCase && (
                        <>
                          <dt>FIR</dt>
                          <dd className="mono">{relatedCase.code}</dd>

                          <dt>Charged under</dt>
                          <dd>{relatedCase.sections.map((sec) => sec.split(":")[0]).join(", ")}</dd>

                          <dt>Station</dt>
                          <dd>{relatedCase.station}</dd>
                        </>
                      )}

                      {accused.length > 0 && (
                        <>
                          <dt>Accused</dt>
                          <dd>
                            <div className="hearing-accused">
                              {accused.map((a) => (
                                <Link key={a.id} to={`/profile/${a.id}`} className="hearing-accused-chip">
                                  {a.label}
                                </Link>
                              ))}
                            </div>
                          </dd>
                        </>
                      )}
                    </dl>
                  </aside>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="empty-state">No hearings match the current filters.</div>}
        </div>
      </div>
    </>
  );
}
