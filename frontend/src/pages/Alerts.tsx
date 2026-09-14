import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { formatDate, SeverityBadge } from "../components/ui";
import { useActiveCase } from "../lib/activeCase";
import { useCaseAlerts, useCaseGraph, useCases } from "../hooks/useCaseData";
import type { AlertSeverity, AlertStatus } from "../data/types";

const statusColor: Record<AlertStatus, string> = {
  new: "var(--risk-high)",
  "under review": "var(--risk-medium)",
  actioned: "var(--status-connected)",
  dismissed: "var(--text-tertiary)",
};

export default function Alerts() {
  const { activeCaseId } = useActiveCase();
  const { alerts, loading, error, markViewed } = useCaseAlerts(activeCaseId);
  const { entities } = useCaseGraph(activeCaseId);
  const { cases } = useCases();

  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AlertStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return [...alerts]
      .filter((a) => (severityFilter === "all" ? true : a.severity === severityFilter))
      .filter((a) => (statusFilter === "all" ? true : a.status === statusFilter))
      .sort((a, b) => (a.detectedOn < b.detectedOn ? 1 : -1));
  }, [alerts, severityFilter, statusFilter]);

  const entityLabels = useMemo(
    () => new Map(entities.map((entity) => [entity.id, entity.label])),
    [entities]
  );
  const caseNames = useMemo(
    () => new Map(cases.map((caseData) => [caseData.id, caseData.title])),
    [cases]
  );

  function displayDescription(description: string) {
    return Array.from(caseNames).reduce(
      (displayText, [caseId, caseName]) => displayText.split(caseId).join(caseName),
      description
    );
  }

  if (!activeCaseId) {
    return (
      <>
        <PageHeader eyebrow="Detection" title="Alerts" />
        <div className="content">
          <div className="empty-state">Open a case to view its alerts.</div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Detection" title="Alerts" />
      {loading && (
        <div className="content">
          <div className="empty-state">Loading alerts&hellip;</div>
        </div>
      )}
      {error && (
        <div className="content">
          <div className="empty-state">Could not load alerts: {error}</div>
        </div>
      )}
      {!loading && !error && (
        <>
          <div className="filter-bar">
            <select className="select" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as AlertSeverity | "all")}>
              <option value="all">All severities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AlertStatus | "all")}>
              <option value="all">All statuses</option>
              <option value="new">New</option>
              <option value="under review">Under review</option>
              <option value="actioned">Actioned</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-tertiary)" }}>
              {filtered.length} of {alerts.length} alerts
            </div>
          </div>
          <div className="content">
            {filtered.length === 0 && (
              <div className="empty-state">No alerts match the current filters.</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filtered.map((a) => (
                <div key={a.id} className="card card-hoverable">
                  <div className="card-body">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <SeverityBadge severity={a.severity} />
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
                          <span className="status-dot" style={{ background: statusColor[a.status] }} />
                          {a.status}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{formatDate(a.detectedOn)}</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{a.title}</div>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, maxWidth: 720 }}>
                      {displayDescription(a.description)}
                    </p>
                    {(a.relatedEntityIds?.length ?? 0) > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Related:</span>
                        {a.relatedEntityIds.map((id) => (
                          <Link
                            key={id}
                            to={`/network?case=${a.caseId}&entity=${id}`}
                            className="tag"
                            style={{ textDecoration: "none" }}
                          >
                            {entityLabels.get(id) ?? id}
                          </Link>
                        ))}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button
                        className="btn"
                        onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                      >
                        {expandedId === a.id ? "Hide" : "Show"} activity log ({a.history.length})
                      </button>
                      {a.status === "new" && (
                        <button
                          className="btn btn-primary"
                          onClick={() => markViewed(a.id)}
                        >
                          Mark viewed
                        </button>
                      )}
                    </div>
                    {expandedId === a.id && (
                      <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                        {a.history.map((h, i) => (
                          <div key={i} style={{ display: "flex", gap: 10, fontSize: 12, marginBottom: 6 }}>
                            <span className="mono" style={{ color: "var(--text-tertiary)", flexShrink: 0, width: 110 }}>
                              {h.at}
                            </span>
                            <span>
                              <strong>{h.actor}:</strong> {h.action}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

