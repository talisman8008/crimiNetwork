import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import SupervisorTasks from "../components/SupervisorTasks";
import { alerts, cases, entitiesForCase } from "../data/mockData";
import { caseAssignments, officers, officersForCase } from "../data/officersData";
import { upcomingCourtDates } from "../data/courtData";
import { caseStatusColor, formatDate } from "../components/ui";
import { IconChevronRight } from "../components/icons";
import { useAuth } from "../lib/auth";

/** Supervisor-side console: who is on which case, where the workload sits, and what needs
 *  attention across every investigation rather than inside a single one. */
export default function SupervisorConsole() {
  const { officerId } = useAuth();
  const [expandedCase, setExpandedCase] = useState<string | null>(cases[0]?.id ?? null);

  const workload = useMemo(() => {
    const counts = new Map<string, number>();
    caseAssignments.forEach((a) => counts.set(a.officerId, (counts.get(a.officerId) ?? 0) + 1));
    return officers
      .map((o) => ({ officer: o, caseCount: counts.get(o.id) ?? 0 }))
      .sort((a, b) => b.caseCount - a.caseCount);
  }, []);

  const unassigned = workload.filter((w) => w.caseCount === 0);
  const openAlerts = alerts.filter((a) => a.status === "new" || a.status === "under review");
  const nextHearings = upcomingCourtDates(4);

  return (
    <>
      <PageHeader
        eyebrow="Supervisor Console"
        title="Case Oversight"
        right={
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            Signed in as {officerId} &middot; supervisory access
          </span>
        }
      />
      <div className="content">
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Investigations</div>
            <div className="stat-value">{cases.length}</div>
            <div className="stat-sub">{cases.filter((c) => c.status === "active").length} currently active</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Officers deployed</div>
            <div className="stat-value">{workload.filter((w) => w.caseCount > 0).length}</div>
            <div className="stat-sub">of {officers.length} on strength</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Alerts awaiting action</div>
            <div className="stat-value" style={{ color: "var(--risk-high)" }}>
              {openAlerts.length}
            </div>
            <div className="stat-sub">new or under review</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Hearings scheduled</div>
            <div className="stat-value">{nextHearings.length}</div>
            <div className="stat-sub">upcoming across all cases</div>
          </div>
        </div>

        <div className="two-col">
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <h2>Investigating teams</h2>
              </div>
              <ul>
                {cases.map((c) => {
                  const team = officersForCase(c.id);
                  const isOpen = expandedCase === c.id;
                  return (
                    <li key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <button
                        onClick={() => setExpandedCase(isOpen ? null : c.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          width: "100%",
                          padding: "12px 18px",
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          textAlign: "left",
                          fontFamily: "inherit",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 500, marginBottom: 3 }}>{c.title}</div>
                          <div className="mono" style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                            {c.code} &middot; {team.length} officers &middot; {entitiesForCase(c.id).length} entities
                          </div>
                        </div>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                            color: "var(--text-secondary)",
                            textTransform: "capitalize",
                            flexShrink: 0,
                          }}
                        >
                          <span className="status-dot" style={{ background: caseStatusColor(c.status) }} />
                          {c.status}
                        </span>
                      </button>

                      {isOpen && (
                        <div style={{ padding: "0 18px 14px", display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {team.length === 0 && (
                            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No officers assigned yet.</span>
                          )}
                          {team.map((o) => (
                            <div key={o.id} className="officer-chip">
                              <span className="officer-avatar">
                                {o.name
                                  .replace(/^(Insp\.|SI|Const\.|HC|ASI)\s*/, "")
                                  .split(/\s+/)
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
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="card">
              <div className="card-header">
                <h2>Officer workload</h2>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Officer</th>
                    <th>Rank</th>
                    <th>Station</th>
                    <th style={{ textAlign: "right" }}>Cases</th>
                  </tr>
                </thead>
                <tbody>
                  {workload.map(({ officer, caseCount }) => (
                    <tr key={officer.id}>
                      <td style={{ fontWeight: 500 }}>{officer.name}</td>
                      <td style={{ color: "var(--text-secondary)" }}>{officer.rank}</td>
                      <td style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{officer.station}</td>
                      <td style={{ textAlign: "right" }}>
                        <span className={`badge ${caseCount === 0 ? "badge-neutral" : "badge-risk-low"}`}>
                          {caseCount === 0 ? "Available" : `${caseCount} assigned`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <SupervisorTasks />

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <h2>Available for assignment</h2>
              </div>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {unassigned.length === 0 && (
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                    Every officer on strength is currently assigned to a case.
                  </p>
                )}
                {unassigned.map(({ officer }) => (
                  <div key={officer.id} className="officer-chip">
                    <span className="officer-avatar">
                      {officer.name
                        .replace(/^(Insp\.|SI|Const\.|HC|ASI)\s*/, "")
                        .split(/\s+/)
                        .map((p) => p[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    <div>
                      <div className="officer-chip-name">{officer.name}</div>
                      <div className="officer-chip-role">{officer.rank}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <h2>Needs review</h2>
                <Link to="/alerts" className="btn">
                  View all
                  <IconChevronRight />
                </Link>
              </div>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {openAlerts.length === 0 && (
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Nothing awaiting supervisory action.</p>
                )}
                {openAlerts.slice(0, 5).map((a) => (
                  <Link key={a.id} to="/alerts" style={{ textDecoration: "none", color: "inherit" }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {a.patternType} &middot; {formatDate(a.detectedOn)}
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2>Upcoming hearings</h2>
                <Link to="/court-dates" className="btn">
                  View all
                  <IconChevronRight />
                </Link>
              </div>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {nextHearings.map((h) => (
                  <div key={h.id}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{h.hearingType}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {h.court} &middot; {formatDate(h.date)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
