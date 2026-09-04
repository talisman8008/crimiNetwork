import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import {
  alerts,
  entitiesForCase,
  relationshipsForCase,
  topConnectedEntities,
  crossCaseEntities,
} from "../data/mockData";
import { courtDatesForCase } from "../data/courtData";
import { officersForCase } from "../data/officersData";
import { eventsForCase } from "../data/timelineData";
import { caseStatusColor, formatDate, SeverityBadge } from "../components/ui";
import { describeWorkspace, useCaseWorkspaces } from "../lib/caseWorkspace";
import { getEntityById } from "../data/mockData";
import { useActiveCase } from "../lib/activeCase";
import { useAuth } from "../lib/auth";
import { fetchApi } from "../lib/api";
import type { Case } from "../data/types";

const severityColor: Record<string, string> = {
  high: "var(--risk-high)",
  medium: "var(--risk-medium)",
  low: "var(--risk-low)",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { openCase } = useActiveCase();
  const { workspaces } = useCaseWorkspaces();
  const { officerId } = useAuth();
  
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCases() {
      try {
        const data = await fetchApi<Case[]>('/cases');
        setCases(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load cases");
        console.error("Failed to load cases", err);
      } finally {
        setLoading(false);
      }
    }
    loadCases();
  }, []);

  const crossCaseCount = crossCaseEntities().length;

  function enterCase(caseId: string) {
    openCase(caseId);
    navigate("/workspace");
  }

  if (loading) {
    return (
      <>
        <PageHeader eyebrow={`Signed in as ${officerId ?? "officer"}`} title="Your Caseload" />
        <div className="content">Loading cases...</div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader eyebrow={`Signed in as ${officerId ?? "officer"}`} title="Your Caseload" />
        <div className="content" style={{ color: "var(--risk-high)" }}>Error loading cases: {error}</div>
      </>
    );
  }

  if (cases.length === 0) {
    return (
      <>
        <PageHeader eyebrow={`Signed in as ${officerId ?? "officer"}`} title="Your Caseload" />
        <div className="content">No cases assigned yet.</div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={`Signed in as ${officerId ?? "officer"}`}
        title="Your Caseload"
        right={
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }} title="Metrics derived from synthetic baseline">
            {cases.length} investigations &middot; {crossCaseCount} entities span more than one (Synthetic)
          </span>
        }
      />
      <div className="content" style={{ paddingBottom: 80 }}>
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
                    <div className="case-workspace-law">{c.sections?.join(" · ")}</div>
                  </div>
                  <span className="case-workspace-status">
                    <span className="status-dot" style={{ background: caseStatusColor(c.status) }} />
                    {c.status}
                  </span>
                </header>

                <div className="case-workspace-figures" title="Data currently uses synthetic baseline">
                  <div>
                    <span className="cw-figure mono">{caseEntities.length}</span>
                    <span className="cw-figure-label">Entities (Mock)</span>
                  </div>
                  <div>
                    <span className="cw-figure mono">{caseLinks.length}</span>
                    <span className="cw-figure-label">Links (Mock)</span>
                  </div>
                  <div>
                    <span className="cw-figure mono">{events.length}</span>
                    <span className="cw-figure-label">Logged (Mock)</span>
                  </div>
                  <div>
                    <span
                      className="cw-figure mono"
                      style={{ color: highCount > 0 ? "var(--risk-high)" : undefined }}
                    >
                      {caseAlerts.length}
                    </span>
                    <span className="cw-figure-label">Open alerts (Mock)</span>
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
                  <dd>{team.length} assigned (Mock)</dd>
                  {topThree.length > 0 && (
                    <>
                      <dt>Central figures (Mock)</dt>
                      <dd>{topThree.map((t) => t.entity.label).join(", ")}</dd>
                    </>
                  )}
                  {nextHearing && (
                    <>
                      <dt>Next hearing (Mock)</dt>
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
