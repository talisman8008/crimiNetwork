import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { formatDate, SeverityBadge } from "../components/ui";
import { useActiveCase } from "../lib/activeCase";
import { useCaseAlerts, useCaseGraph, useCases } from "../hooks/useCaseData";
import { alerts as curatedAlerts, cases as curatedCases, entitiesForCase } from "../data/mockData";
import type { AlertSeverity, AlertStatus } from "../data/types";

export default function Alerts() {
  const { activeCaseId } = useActiveCase();
  const { alerts, loading, error, markViewed } = useCaseAlerts(activeCaseId);
  const { entities: liveEntities } = useCaseGraph(activeCaseId);
  const { cases: liveCases } = useCases();
  const isMockCase = activeCaseId === "demo-uploaded-case" || activeCaseId === "case-1" || activeCaseId === "case-2";
  const mockCaseId = activeCaseId === "case-2" ? "case-2" : "case-1";
  const visibleAlerts = isMockCase ? curatedAlerts.filter((alert) => alert.caseId === mockCaseId) : alerts;
  const entities = isMockCase ? entitiesForCase(mockCaseId) : liveEntities;
  const cases = isMockCase ? curatedCases : liveCases;
  const alertLoading = isMockCase ? false : loading;
  const alertError = isMockCase ? null : error;

  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AlertStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return [...visibleAlerts]
      .filter((a) => (severityFilter === "all" ? true : a.severity === severityFilter))
      .filter((a) => (statusFilter === "all" ? true : a.status === statusFilter))
      .sort((a, b) => (a.detectedOn < b.detectedOn ? 1 : -1));
  }, [visibleAlerts, severityFilter, statusFilter]);

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
      {alertLoading && (
        <div className="content">
          <div className="empty-state">Loading alerts&hellip;</div>
        </div>
      )}
      {alertError && (
        <div className="content">
          <div className="empty-state">Could not load alerts: {alertError}</div>
        </div>
      )}
      {!alertLoading && !alertError && (
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
              <option value="under review">Under review</option>
              <option value="actioned">Actioned</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-tertiary)" }}>
              {filtered.length} of {visibleAlerts.length} alerts
            </div>
          </div>
          <div className="content">
            {filtered.length === 0 && (
              <div className="empty-state">No alerts match the current filters.</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filtered.map((a) => (
                <div key={a.id} className="card card-hoverable alert-tile">
                  <div className="card-body">
                    <div className="alert-tile-title-row">
                      <div className="alert-tile-title-group">
                        <SeverityBadge severity={a.severity} />
                        <div className="alert-tile-title">{a.title}</div>
                      </div>
                      <span className="alert-tile-date">{formatDate(a.detectedOn)}</span>
                    </div>
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

                    <div className="alert-tile-actions" style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button
                        className="btn"
                        onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                      >
                        {expandedId === a.id ? "Hide" : "Show"} activity log ({a.history.length})
                      </button>
                      {a.status === "new" && (
                        <button
                          className="btn btn-primary"
                          onClick={() => { if (!isMockCase) markViewed(a.id); }}
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

