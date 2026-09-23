import { Link, useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import {
  getCaseById,
  linkedCasesFor,
} from "../data/mockData";
import { courtDatesForCase } from "../data/courtData";
import { officersForCase } from "../data/officersData";
import { cctvFootage } from "../data/cctvData";
import { eventsForCase } from "../data/timelineData";
import { caseStatusColor, EntityIcon, formatDate, RiskBadge, SeverityBadge } from "../components/ui";
import EventTimeline from "../components/EventTimeline";
import { useActiveCase } from "../lib/activeCase";
import { useCase, useCaseAlerts, useCaseGraph, useCases } from "../hooks/useCaseData";
import { IconChevronRight } from "../components/icons";
import CaseSourceUpload from "../components/CaseSourceUpload";

const severityColor: Record<string, string> = {
  high: "var(--risk-high)",
  medium: "var(--risk-medium)",
  low: "var(--risk-low)",
};

function initials(name: string): string {
  return name
    .replace(/^(Insp\.|SI|Const\.|HC|ASI)\s*/, "")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Everything on one case in a single view: who is in it, what is flagged, what is listed in
 *  court, what was recorded when, and which other investigations it touches. */
export default function CaseWorkspace() {
  const { activeCaseId, openCase } = useActiveCase();
  const navigate = useNavigate();
  const { cases } = useCases();
  const { case: c, loading: caseLoading } = useCase(activeCaseId);
  const { entities: caseEntities, relationships: caseLinks } = useCaseGraph(activeCaseId);
  const { alerts: loadedAlerts } = useCaseAlerts(activeCaseId);

  if (!c) {
    return (
      <>
        <PageHeader eyebrow="Workspace" title={caseLoading ? "Loading case…" : "No case open"} />
        <div className="content">
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 18, maxWidth: "60ch" }}>
            Open a case to bring its people, alerts, hearings and recorded activity together here.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 460 }}>
            {cases.map((k) => (
              <button
                key={k.id}
                className="btn"
                style={{ justifyContent: "space-between", padding: "12px 14px" }}
                onClick={() => openCase(k.id)}
              >
                <span>
                  <span className="mono" style={{ color: "var(--text-tertiary)", marginRight: 8 }}>
                    {k.code}
                  </span>
                  {k.title}
                </span>
                <IconChevronRight />
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  const team = officersForCase(c.id);
  const caseAlerts = loadedAlerts.filter((a) => a.status !== "dismissed");
  const hearings = courtDatesForCase(c.id);
  const upcoming = hearings.filter((h) => h.status === "upcoming");
  const footage = cctvFootage.filter((f) => f.caseId === c.id);
  const events = eventsForCase(c.id);
  const linked = linkedCasesFor(c.id);
  const linkCounts = new Map<string, number>();
  caseLinks.forEach((link) => {
    linkCounts.set(link.source, (linkCounts.get(link.source) ?? 0) + 1);
    linkCounts.set(link.target, (linkCounts.get(link.target) ?? 0) + 1);
  });
  const keyFigures = caseEntities
    .map((entity) => ({ entity, count: linkCounts.get(entity.id) ?? 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const topCount = keyFigures[0]?.count || 1;

  return (
    <>
      <PageHeader
        eyebrow={`Workspace · ${c.code}`}
        title={c.title}
        right={
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "var(--text-secondary)",
              textTransform: "capitalize",
            }}
          >
            <span className="status-dot" style={{ background: caseStatusColor(c.status) }} />
            {c.status}
          </span>
        }
      />
      <div className="content" style={{ paddingBottom: 80 }}>
        <div className="brief-statline">
          <div className="brief-stat">
            <span className="brief-stat-value">{caseEntities.length}</span>
            <span className="brief-stat-label">Entities</span>
          </div>
          <div className="brief-stat">
            <span className="brief-stat-value">{caseLinks.length}</span>
            <span className="brief-stat-label">Links</span>
          </div>
          <div className="brief-stat">
            <span className="brief-stat-value">{events.length}</span>
            <span className="brief-stat-label">Logged events</span>
          </div>
          <div className="brief-stat">
            <span className="brief-stat-value" style={{ color: caseAlerts.length ? "var(--risk-high)" : undefined }}>
              {caseAlerts.length}
            </span>
            <span className="brief-stat-label">Open alerts</span>
          </div>
          <div className="brief-stat">
            <span className="brief-stat-value">{upcoming.length}</span>
            <span className="brief-stat-label">Hearings ahead</span>
          </div>
          <div className="brief-stat">
            <span className="brief-stat-value">{team.length}</span>
            <span className="brief-stat-label">Officers</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 26 }}>
          <button className="btn btn-primary" onClick={() => navigate(`/network?case=${c.id}`)}>
            Open network graph
          </button>
          <button className="btn" onClick={() => navigate("/map")}>
            Location map
          </button>
          <button className="btn" onClick={() => navigate("/court-dates")}>
            Court dates
          </button>
          <Link to={`/dossier/${c.id}`} className="btn" target="_blank" rel="noopener noreferrer">
            Print dossier
          </Link>
        </div>

        <div className="dash-split">
          <section>
            <div className="brief-heading">
              <h2>Investigator starting points</h2>
              <Link to={`/network?case=${c.id}`}>Open graph</Link>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 8px" }}>
              Start with the most connected entities in this case, then review their links and supporting records. This is a triage cue, not a risk score.
            </p>
            <div className="rank-list">
              {keyFigures.map(({ entity: e, count }, i) => (
                <Link key={e.id} to={`/profile/${e.id}`} className="rank-row">
                  <span className="rank-num mono">{i + 1}</span>
                  <span className="rank-name">{e.label}</span>
                  <span className="rank-bar-wrap">
                    <span
                      className="rank-bar"
                      style={{ width: `${(count / topCount) * 100}%`, background: severityColor[e.riskLevel] }}
                    />
                  </span>
                  <span className="rank-value mono">{count}</span>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <div className="brief-heading">
              <h2>Investigating team</h2>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 10 }}>
              {team.map((o) => (
                <div key={o.id} className="officer-chip">
                  <span className="officer-avatar">{initials(o.name)}</span>
                  <div>
                    <div className="officer-chip-name">{o.name}</div>
                    <div className="officer-chip-role">{o.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {caseAlerts.length > 0 && (
          <section className="brief-section">
            <div className="brief-heading">
              <h2>Flagged patterns</h2>
              <Link to="/alerts">View all alerts</Link>
            </div>
            <div className="alert-rows">
              {caseAlerts.map((a) => (
                <Link key={a.id} to="/alerts" className="alert-row">
                  <span className="alert-row-stripe" style={{ background: severityColor[a.severity] }} />
                  <span className="alert-row-body">
                    <span className="alert-row-title">{a.title}</span>
                    <span className="alert-row-meta">
                      {a.patternType} &middot; {formatDate(a.detectedOn)}
                    </span>
                  </span>
                  <SeverityBadge severity={a.severity} />
                </Link>
              ))}
            </div>
          </section>
        )}

        {linked.length > 0 && (
          <section className="brief-section">
            <div className="brief-heading">
              <h2>Linked investigations</h2>
              <Link to="/cases">Open case files</Link>
            </div>
            <div className="linked-cases" style={{ margin: "10px 0 0" }}>
              {linked.map((l) => {
                const other = getCaseById(l.otherCaseId);
                if (!other) return null;
                return (
                  <div key={l.otherCaseId} className="linked-case">
                    <div className="linked-case-top">
                      <span className="mono linked-case-code">{other.code}</span>
                      <span className="linked-case-title">{other.title}</span>
                      <span className="badge badge-risk-medium">{l.sharedEntities.length} shared</span>
                    </div>
                    <div className="linked-case-entities">
                      {l.sharedEntities.map((e) => (
                        <Link key={e.id} to={`/profile/${e.id}`} className="linked-case-chip">
                          <EntityIcon type={e.type} />
                          {e.label}
                        </Link>
                      ))}
                    </div>
                    <div className="linked-case-note">
                      {l.sharedRelationships.length} relationship
                      {l.sharedRelationships.length === 1 ? "" : "s"} cross between the two files
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <CaseSourceUpload caseId={c.id} />

        <div className="dash-split">
          <section>
            <div className="brief-heading">
              <h2>Court schedule</h2>
              <Link to="/court-dates">All hearings</Link>
            </div>
            <div className="case-rows">
              {hearings.map((h) => (
                <Link key={h.id} to="/court-dates" className="case-row">
                  <span className="case-row-main">
                    <span className="case-row-title">{h.hearingType}</span>
                    <span className="case-row-meta">
                      {h.court} &middot; {h.judge}
                    </span>
                  </span>
                  <span className="case-row-count mono">{formatDate(h.date)}</span>
                  <span className="case-row-status" style={{ width: 90 }}>
                    <span
                      className="status-dot"
                      style={{
                        background: h.status === "upcoming" ? "var(--status-syncing)" : "var(--status-connected)",
                      }}
                    />
                    {h.status}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <div className="brief-heading">
              <h2>CCTV footage</h2>
              <Link to="/cctv">Open viewer</Link>
            </div>
            <div className="case-rows">
              {footage.length === 0 && <div className="empty-state">No footage logged.</div>}
              {footage.map((f) => (
                <Link key={f.id} to="/cctv" className="case-row">
                  <span className="case-row-main">
                    <span className="case-row-title">{f.title}</span>
                    <span className="case-row-meta">
                      {f.locationLabel} &middot; {f.recordedOn}
                    </span>
                  </span>
                  <span className="case-row-count mono">{f.duration}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <section className="brief-section">
          <div className="brief-heading">
            <h2>Recorded activity</h2>
            <Link to="/map">See on map</Link>
          </div>
          <EventTimeline events={events} emptyMessage="No timestamped activity logged for this case." />
        </section>

        <section className="brief-section">
          <div className="brief-heading">
            <h2>Entities on file</h2>
            <Link to="/entities">Open database</Link>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Entity</th>
                <th>Type</th>
                <th>Detail</th>
                <th style={{ textAlign: "right" }}>Risk</th>
              </tr>
            </thead>
            <tbody>
              {caseEntities.map((e) => (
                <tr key={e.id} className="clickable">
                  <td style={{ fontWeight: 500 }}>
                    <Link to={`/profile/${e.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                      {e.label}
                    </Link>
                  </td>
                  <td style={{ color: "var(--text-secondary)", textTransform: "capitalize" }}>{e.type}</td>
                  <td style={{ color: "var(--text-tertiary)", fontSize: "var(--fs-sm)" }}>
                    {e.tags.join(", ") || "-"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <RiskBadge level={e.riskLevel} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
