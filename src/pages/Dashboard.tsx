import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import {
  alerts,
  cases,
  entitiesForCase,
  relationshipsForCase,
  topConnectedEntities,
  crossCaseEntities,
  entities,
  relationships,
  dataSources,
} from "../data/mockData";
import { courtDatesForCase } from "../data/courtData";
import { officersForCase } from "../data/officersData";
import { eventsForCase } from "../data/timelineData";
import { caseStatusColor, entityTypeLabel, formatDate, SeverityBadge } from "../components/ui";
import { Bars, Donut, DonutLegend } from "../components/Charts";
import SeverityHeatmap from "../components/SeverityHeatmap";
import type { EntityType } from "../data/types";
import { describeWorkspace, useCaseWorkspaces } from "../lib/caseWorkspace";
import { getEntityById } from "../data/mockData";
import { useActiveCase } from "../lib/activeCase";
import { useAuth } from "../lib/auth";

const severityColor: Record<string, string> = {
  high: "var(--risk-high)",
  medium: "var(--risk-medium)",
  low: "var(--risk-low)",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { openCase } = useActiveCase();
  const { workspaces } = useCaseWorkspaces();
  useAuth();

  const crossCaseCount = crossCaseEntities().length;

  const [district, setDistrict] = useState("All districts");
  const [period, setPeriod] = useState("All time");

  const districts = useMemo(
    () => ["All districts", ...new Set(entities.filter((e) => e.type === "location").map((e) => e.label))],
    [],
  );

  const openAlerts = alerts.filter((a) => a.status !== "dismissed");

  const stats = [
    { label: "Entities on record", value: entities.length },
    { label: "Links established", value: relationships.length },
    { label: "Active investigations", value: cases.filter((c) => c.status !== "closed").length },
    { label: "Cross-case entities", value: crossCaseCount },
    { label: "Open alerts", value: openAlerts.length },
    { label: "Evidence sources", value: dataSources.length },
  ];

  // Alerts by status, in the order an officer clears them.
  const alertStatusSlices = useMemo(() => {
    const by = (s: string) => alerts.filter((a) => a.status === s).length;
    return [
      { label: "New", value: by("new"), color: "#2563eb" },
      { label: "Acknowledged", value: by("acknowledged"), color: "#93b4f5" },
      { label: "Dismissed", value: by("dismissed"), color: "#111827" },
    ].filter((s) => s.value > 0);
  }, []);

  const alertTotal = alertStatusSlices.reduce((a, s) => a + s.value, 0);

  const categorySlices = useMemo(() => {
    const colors: Record<string, string> = {
      person: "#2563eb",
      organization: "#f59e0b",
      location: "#14b8a6",
      vehicle: "#a78bfa",
      phone: "#111827",
    };
    return Object.entries(
      entities.reduce<Record<string, number>>((acc, e) => {
        acc[e.type] = (acc[e.type] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .map(([type, value]) => ({ label: entityTypeLabel[type as EntityType], value, color: colors[type] }));
  }, []);

  const entityTotal = entities.length;

  // Which weekday each link was actually observed on, straight from the evidence dates.
  const linksByDay = useMemo(() => {
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const counts = new Array(7).fill(0);
    relationships.forEach((r) => {
      const d = new Date(r.observedOn);
      if (!Number.isNaN(d.getTime())) counts[d.getDay()] += 1;
    });
    return names.map((label, i) => ({ label, value: counts[i] }));
  }, []);

  function enterCase(caseId: string) {
    openCase(caseId);
    navigate("/workspace");
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        right={
          <div className="dash-filters">
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              aria-label="Filter by district"
            >
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Filter by period">
              <option>All time</option>
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>This year</option>
            </select>
          </div>
        }
      />
      <div className="content" style={{ paddingBottom: 80 }}>
        <div className="stat-grid">
          {stats.map((s) => (
            <div key={s.label} className="stat-tile">
              <div className="stat-tile-label">{s.label}</div>
              <div className="stat-tile-row">
                <span className="stat-tile-value">{s.value.toLocaleString("en-IN")}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="chart-grid">
          <section className="panel chart-card">
            <h2 className="chart-card-title">Alerts by status</h2>
            <div className="chart-card-body">
              <Donut slices={alertStatusSlices} total={alertTotal} />
              <DonutLegend slices={alertStatusSlices} showPercent />
            </div>
          </section>

          <section className="panel chart-card chart-card-wide">
            <h2 className="chart-card-title">Severity heatmap</h2>
            <SeverityHeatmap />
          </section>

          <section className="panel chart-card">
            <h2 className="chart-card-title">Links observed by day</h2>
            <Bars data={linksByDay} />
          </section>

          <section className="panel chart-card chart-card-wide">
            <h2 className="chart-card-title">Entities by category</h2>
            <div className="chart-card-body">
              <Donut slices={categorySlices} total={entityTotal} />
              <DonutLegend slices={categorySlices} />
            </div>
          </section>
        </div>

        <h2 className="section-heading">Your caseload</h2>
        <p className="workspace-intro">
          Open a case to work inside it. Everything else in the console narrows to that
          investigation until you close it.
        </p>

        <div className="case-workspace-grid">
          {cases.map((c) => {
            const caseEntities = entitiesForCase(c.id);
            const caseLinks = relationshipsForCase(c.id);
            const caseAlerts = alerts.filter((a) => a.caseId === c.id && a.status !== "dismissed");
            const highCount = caseAlerts.filter((a) => a.severity === "high").length;
            const team = officersForCase(c.id);
            const lead = team.find((o) => o.role.includes("Lead")) ?? team[0];
            const hearings = courtDatesForCase(c.id).filter((h) => h.status === "upcoming");
            const nextHearing = hearings[0];
            const events = eventsForCase(c.id);
            const w = workspaces[c.id];
            const topThree = topConnectedEntities(50)
              .filter((t) => t.entity.caseIds.includes(c.id))
              .slice(0, 3);

            return (
              <article key={c.id} className="case-workspace">
                <header className="case-workspace-head">
                  <div style={{ minWidth: 0 }}>
                    <div className="case-workspace-code mono">{c.code}</div>
                    <h2 className="case-workspace-title">{c.title}</h2>
                    <div className="case-workspace-law">{c.sections.join(" · ")}</div>
                  </div>
                  <span className="case-workspace-status">
                    <span className="status-dot" style={{ background: caseStatusColor(c.status) }} />
                    {c.status}
                  </span>
                </header>

                <div className="case-workspace-figures">
                  <div>
                    <span className="cw-figure mono">{caseEntities.length}</span>
                    <span className="cw-figure-label">Entities</span>
                  </div>
                  <div>
                    <span className="cw-figure mono">{caseLinks.length}</span>
                    <span className="cw-figure-label">Links</span>
                  </div>
                  <div>
                    <span className="cw-figure mono">{events.length}</span>
                    <span className="cw-figure-label">Logged events</span>
                  </div>
                  <div>
                    <span
                      className="cw-figure mono"
                      style={{ color: highCount > 0 ? "var(--risk-high)" : undefined }}
                    >
                      {caseAlerts.length}
                    </span>
                    <span className="cw-figure-label">Open alerts</span>
                  </div>
                </div>

                {caseAlerts.length > 0 && (
                  <div className="case-workspace-alerts">
                    {caseAlerts.slice(0, 2).map((a) => (
                      <div key={a.id} className="cw-alert">
                        <span className="cw-alert-stripe" style={{ background: severityColor[a.severity] }} />
                        <span className="cw-alert-title">{a.title}</span>
                        <SeverityBadge severity={a.severity} />
                      </div>
                    ))}
                  </div>
                )}

                <dl className="case-workspace-facts">
                  {lead && (
                    <>
                      <dt>Lead officer</dt>
                      <dd>{lead.name}</dd>
                    </>
                  )}
                  <dt>Team</dt>
                  <dd>{team.length} assigned</dd>
                  {topThree.length > 0 && (
                    <>
                      <dt>Central figures</dt>
                      <dd>{topThree.map((t) => t.entity.label).join(", ")}</dd>
                    </>
                  )}
                  {nextHearing && (
                    <>
                      <dt>Next hearing</dt>
                      <dd>
                        {nextHearing.hearingType} &middot; {formatDate(nextHearing.date)}
                      </dd>
                    </>
                  )}
                </dl>

                {w && (
                  <div className="case-workspace-resume">
                    <span className="resume-dot" />
                    Left off: {describeWorkspace(w, w.selectedEntityId ? getEntityById(w.selectedEntityId)?.label : undefined)}
                  </div>
                )}

                <div className="case-workspace-actions">
                  <button className="btn btn-primary" onClick={() => enterCase(c.id)}>
                    {w ? "Resume case" : "Open case"}
                  </button>
                  <Link to={`/dossier/${c.id}`} className="btn" target="_blank" rel="noopener noreferrer">
                    Print dossier
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
}
