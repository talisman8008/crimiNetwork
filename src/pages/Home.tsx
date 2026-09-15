import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { alerts, cases, getCaseById, getEntityById } from "../data/mockData";
import { upcomingCourtDates } from "../data/courtData";
import { prioritisedCases } from "../lib/priorities";
import { formatDate, SeverityBadge } from "../components/ui";
import { useActiveCase } from "../lib/activeCase";
import { useAuth } from "../lib/auth";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const navigate = useNavigate();
  const { openCase } = useActiveCase();
  const { officerId } = useAuth();

  const priorities = useMemo(() => prioritisedCases(), []);
  const topPriorities = priorities.slice(0, 3);

  // "Since you were last in" — the most recent activity across the caseload, newest first. A real
  // build would diff against the last-login timestamp; here it surfaces the latest records.
  const recent = useMemo(() => {
    return [...alerts]
      .filter((a) => a.status !== "dismissed")
      .sort((a, b) => (a.detectedOn < b.detectedOn ? 1 : -1))
      .slice(0, 5);
  }, []);

  // Anomalies / surges — the behavioural alerts, which are the ones worth leading with.
  const anomalies = useMemo(
    () =>
      alerts
        .filter((a) => a.status !== "dismissed" && /anomaly|spike|surge|circular/i.test(a.patternType + " " + a.title))
        .slice(0, 4),
    [],
  );

  const hearings = useMemo(() => upcomingCourtDates(4), []);

  function enterCase(caseId: string) {
    openCase(caseId);
    navigate("/workspace");
  }

  return (
    <>
      <PageHeader
        eyebrow={`${greeting()}, ${officerId ?? "officer"}`}
        title="Today's briefing"
        right={
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            {topPriorities[0]?.openHighAlerts
              ? `${priorities.reduce((n, p) => n + p.openHighAlerts, 0)} high alerts across ${cases.length} cases`
              : `${cases.length} cases on your desk`}
          </span>
        }
      />

      <div className="content home" style={{ paddingBottom: 64 }}>
        <div className="home-grid">
          {/* Where to start */}
          <section className="panel home-panel home-priorities">
            <div className="home-panel-head">
              <h2>Where to start today</h2>
              <span className="home-panel-note">Ranked by what is pressing now</span>
            </div>
            <ol className="priority-list">
              {topPriorities.map((p, i) => (
                <li key={p.case.id} className="priority-item">
                  <span className="priority-rank mono">{i + 1}</span>
                  <div className="priority-body">
                    <div className="priority-title">
                      <span className="mono priority-code">{p.case.code}</span>
                      {p.case.title}
                    </div>
                    <div className="priority-reasons">
                      {p.reasons.map((r) => (
                        <span key={r} className="priority-reason">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={() => enterCase(p.case.id)}>
                    Open
                  </button>
                </li>
              ))}
            </ol>
          </section>

          {/* Since last login */}
          <section className="panel home-panel">
            <div className="home-panel-head">
              <h2>Since you were last in</h2>
            </div>
            <ul className="brief-list">
              {recent.length === 0 && <li className="home-empty">Nothing new.</li>}
              {recent.map((a) => {
                const c = getCaseById(a.caseId);
                return (
                  <li key={a.id} className="brief-item" onClick={() => navigate("/alerts")}>
                    <SeverityBadge severity={a.severity} />
                    <div className="brief-body">
                      <div className="brief-title">{a.title}</div>
                      <div className="brief-sub">
                        {c ? c.code : a.caseId} &middot; {formatDate(a.detectedOn)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Anomalies / surges */}
          <section className="panel home-panel">
            <div className="home-panel-head">
              <h2>Behavioural alerts</h2>
              <span className="home-panel-note">Surges and unusual patterns</span>
            </div>
            <ul className="brief-list">
              {anomalies.length === 0 && <li className="home-empty">No behavioural anomalies flagged.</li>}
              {anomalies.map((a) => (
                <li key={a.id} className="brief-item" onClick={() => navigate("/alerts")}>
                  <SeverityBadge severity={a.severity} />
                  <div className="brief-body">
                    <div className="brief-title">{a.title}</div>
                    <div className="brief-sub">
                      {a.relatedEntityIds
                        .map((id) => getEntityById(id)?.label)
                        .filter(Boolean)
                        .slice(0, 2)
                        .join(", ") || a.patternType}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Upcoming hearings */}
          <section className="panel home-panel">
            <div className="home-panel-head">
              <h2>Upcoming hearings</h2>
            </div>
            <ul className="brief-list">
              {hearings.length === 0 && <li className="home-empty">No hearings scheduled.</li>}
              {hearings.map((h) => {
                const c = getCaseById(h.caseId);
                return (
                  <li key={h.id} className="brief-item" onClick={() => navigate("/court-dates")}>
                    <span className="hearing-date">
                      <span className="hearing-day mono">{new Date(h.date).getDate()}</span>
                      <span className="hearing-mon">
                        {new Date(h.date).toLocaleString("en-IN", { month: "short" })}
                      </span>
                    </span>
                    <div className="brief-body">
                      <div className="brief-title">{h.hearingType}</div>
                      <div className="brief-sub">
                        {c ? c.code : h.caseId} &middot; {h.court}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <div className="home-foot">
          <button className="btn" onClick={() => navigate("/dashboard")}>
            Open the full dashboard
          </button>
          <button className="btn" onClick={() => navigate("/cases")}>
            View all cases
          </button>
        </div>
      </div>
    </>
  );
}
