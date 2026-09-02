import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { cases, crossCaseEntities, entitiesForCase, getCaseById, linkedCasesFor, relationshipsForCase } from "../data/mockData";
import { caseStatusColor, EntityIcon, formatDate, RiskBadge } from "../components/ui";
import { IconChevronRight } from "../components/icons";
import { courtDatesForCase } from "../data/courtData";
import { officersForCase } from "../data/officersData";
import { describeWorkspace, useCaseWorkspaces } from "../lib/caseWorkspace";
import { getEntityById as lookupEntity } from "../data/mockData";

const priorityColor: Record<string, string> = {
  high: "var(--risk-high)",
  medium: "var(--risk-medium)",
  low: "var(--text-tertiary)",
};

export default function Cases() {
  const bridgeEntities = crossCaseEntities();
  const { workspaces } = useCaseWorkspaces();

  return (
    <>
      <PageHeader eyebrow="Investigations" title="Cases" />
      <div className="content">
        {bridgeEntities.length > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <h2>Entities linked across cases</h2>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
                These entities appear in more than one active investigation, often the first sign that two
                cases are part of the same network.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {bridgeEntities.map((e) => (
                  <div
                    key={e.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 10px",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--surface-sunken)",
                    }}
                  >
                    <EntityIcon type={e.type} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{e.label}</div>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                        Bridges{" "}
                        {e.caseIds
                          .map((cid) => getCaseById(cid)?.code)
                          .filter(Boolean)
                          .join(" & ")}
                      </div>
                    </div>
                    <RiskBadge level={e.riskLevel} />
                    <Link to={`/network?case=all&entity=${e.id}`} className="btn">
                      View
                      <IconChevronRight />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {cases.map((c) => {
            const entityCount = entitiesForCase(c.id).length;
            const linkCount = relationshipsForCase(c.id).length;
            const today = new Date().toISOString().slice(0, 10);
            const nextHearing = courtDatesForCase(c.id).find((h) => h.status === "upcoming" && h.date >= today);
            const team = officersForCase(c.id);
            const linked = linkedCasesFor(c.id);
            return (
              <div key={c.id} className="card card-hoverable">
                <div className="card-body" style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span className="mono" style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                        {c.code}
                      </span>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 12,
                          textTransform: "capitalize",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <span className="status-dot" style={{ background: caseStatusColor(c.status) }} />
                        {c.status}
                      </span>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 12,
                          textTransform: "capitalize",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <span className="priority-dot" style={{ background: priorityColor[c.priority] }} />
                        {c.priority} priority
                      </span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{c.title}</div>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10, maxWidth: 620 }}>
                      {c.summary}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 12 }}>
                      {c.sections.map((s) => (
                        <span key={s} className="mono" style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                          {s}
                        </span>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 18, fontSize: 12, color: "var(--text-tertiary)", marginBottom: nextHearing ? 8 : 0 }}>
                      <span>Opened {formatDate(c.openedOn)}</span>
                      <span>{c.leadOfficer}</span>
                      <span>{c.station}</span>
                    </div>
                    {nextHearing && (
                      <Link
                        to="/court-dates"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          color: "var(--accent-strong)",
                          textDecoration: "none",
                          marginBottom: 12,
                        }}
                      >
                        Next hearing: {nextHearing.hearingType} &middot; {formatDate(nextHearing.date)}
                      </Link>
                    )}
                    {team.length > 0 && (
                      <div>
                        <div className="section-title">
                          Investigating team
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {team.map((o) => (
                            <div key={o.id} className="officer-chip" title={`${o.name} · ${o.role}`}>
                              <span className="officer-avatar">
                                {o.name
                                  .replace(/^(Insp\.|SI|Const\.|HC|ASI)\s*/, "")
                                  .split(" ")
                                  .map((p) => p[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </span>
                              <div>
                                <div className="officer-chip-name">{o.name}</div>
                                <div className="officer-chip-role">{o.role}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, flexShrink: 0 }}>
                    <div style={{ display: "flex", gap: 18, textAlign: "right" }}>
                      <div>
                        <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>
                          {entityCount}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>entities</div>
                      </div>
                      <div>
                        <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>
                          {linkCount}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>links</div>
                      </div>
                    </div>
                    {linked.length > 0 && (
                      <div className="linked-cases">
                        <div className="linked-cases-head">Linked investigations</div>
                        {linked.map((l) => {
                          const other = getCaseById(l.otherCaseId);
                          if (!other) return null;
                          return (
                            <div key={l.otherCaseId} className="linked-case">
                              <div className="linked-case-top">
                                <span className="mono linked-case-code">{other.code}</span>
                                <span className="linked-case-title">{other.title}</span>
                                <span className="badge badge-risk-medium">
                                  {l.sharedEntities.length} shared
                                </span>
                              </div>
                              <div className="linked-case-entities">
                                {l.sharedEntities.map((e) => (
                                  <Link key={e.id} to={`/profile/${e.id}`} className="linked-case-chip">
                                    <EntityIcon type={e.type} />
                                    {e.label}
                                  </Link>
                                ))}
                              </div>
                              {l.sharedRelationships.length > 0 && (
                                <div className="linked-case-note">
                                  {l.sharedRelationships.length} relationship
                                  {l.sharedRelationships.length === 1 ? "" : "s"} cross between the two files
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {workspaces[c.id] && (
                        <span className="resume-note">
                          <span className="resume-dot" />
                          Left off: {describeWorkspace(
                            workspaces[c.id],
                            workspaces[c.id].selectedEntityId
                              ? lookupEntity(workspaces[c.id].selectedEntityId!)?.label
                              : undefined,
                          )}
                        </span>
                      )}
                      <Link to={`/dossier/${c.id}`} className="btn" target="_blank" rel="noopener noreferrer">
                        Print dossier
                      </Link>
                      <Link to={`/network?case=${c.id}`} className="btn btn-primary">
                        {workspaces[c.id] ? "Resume case" : "Open in graph"}
                        <IconChevronRight />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
