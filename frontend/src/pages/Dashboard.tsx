import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { alerts, cases, entitiesForCase, relationships, relationshipsForCase } from "../data/mockData";
import { courtDatesForCase } from "../data/courtData";
import { officersForCase } from "../data/officersData";
import { eventsForCase } from "../data/timelineData";
import { caseStatusColor, formatDate } from "../components/ui";
import { Bars } from "../components/Charts";
import SeverityHeatmap from "../components/SeverityHeatmap";
import { IconChevronLeft, IconChevronRight, IconSearch } from "../components/icons";
import { useActiveCase } from "../lib/activeCase";
import { useAuth } from "../lib/auth";

export default function Dashboard() {
  const navigate = useNavigate();
  const { openCase } = useActiveCase();
  useAuth();

  const [caseSearch, setCaseSearch] = useState("");
  const [caseRailCollapsed, setCaseRailCollapsed] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState(cases[0]?.id ?? "");

  const selectedCase = cases.find((c) => c.id === selectedCaseId) ?? cases[0];
  const selectedEntities = selectedCase ? entitiesForCase(selectedCase.id) : [];
  const selectedLinks = selectedCase ? relationshipsForCase(selectedCase.id) : [];
  const selectedAlerts = selectedCase
    ? alerts.filter((a) => a.caseId === selectedCase.id && a.status !== "dismissed")
    : [];
  const selectedEvents = selectedCase ? eventsForCase(selectedCase.id) : [];
  const nextHearing = selectedCase
    ? courtDatesForCase(selectedCase.id).find((h) => h.status === "upcoming")
    : undefined;
  const investigator = selectedCase
    ? officersForCase(selectedCase.id).find((officer) => officer.role.includes("Lead")) ?? officersForCase(selectedCase.id)[0]
    : undefined;

  const visibleCases = useMemo(() => {
    const query = caseSearch.trim().toLowerCase();
    if (!query) return cases;
    return cases.filter((c) => `${c.code} ${c.title} ${c.station}`.toLowerCase().includes(query));
  }, [caseSearch]);

  const linksByDay = useMemo(() => {
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const counts = new Array(7).fill(0);
    relationships.forEach((relationship) => {
      const date = new Date(relationship.observedOn);
      if (!Number.isNaN(date.getTime())) counts[date.getDay()] += 1;
    });
    return names.map((label, index) => ({ label, value: counts[index] }));
  }, []);

  function openSelectedCase() {
    if (!selectedCase) return;
    openCase(selectedCase.id);
    navigate("/workspace");
  }

  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="content dashboard-content">
        <div className={`dashboard-workspace ${caseRailCollapsed ? "is-case-rail-collapsed" : ""}`}>
          <aside className="dashboard-case-rail" aria-label="Investigation cases">
            <div className="dashboard-case-rail-header">
              {!caseRailCollapsed && <h2>Cases</h2>}
              <button
                type="button"
                className="dashboard-rail-toggle"
                onClick={() => setCaseRailCollapsed((collapsed) => !collapsed)}
                aria-label={caseRailCollapsed ? "Expand cases" : "Collapse cases"}
                title={caseRailCollapsed ? "Expand cases" : "Collapse cases"}
              >
                {caseRailCollapsed ? <IconChevronRight /> : <IconChevronLeft />}
              </button>
            </div>

            {!caseRailCollapsed && (
              <>
                <label className="dashboard-case-search">
                  <IconSearch />
                  <input
                    type="search"
                    value={caseSearch}
                    onChange={(event) => setCaseSearch(event.target.value)}
                    placeholder="Search cases"
                    aria-label="Search cases"
                  />
                </label>

                <div className="dashboard-case-list">
                  {visibleCases.map((caseItem) => {
                    const caseAlerts = alerts.filter(
                      (alert) => alert.caseId === caseItem.id && alert.status !== "dismissed",
                    );
                    const isSelected = caseItem.id === selectedCase?.id;
                    return (
                      <button
                        key={caseItem.id}
                        type="button"
                        className={`dashboard-case-item ${isSelected ? "is-selected" : ""}`}
                        onClick={() => setSelectedCaseId(caseItem.id)}
                        aria-pressed={isSelected}
                      >
                        <div className="dashboard-case-item-topline">
                          <span className="mono">{caseItem.code}</span>
                          <span className="dashboard-case-status">
                            <span className="status-dot" style={{ background: caseStatusColor(caseItem.status) }} />
                            {caseItem.status}
                          </span>
                        </div>
                        <strong>{caseItem.title}</strong>
                        <span className="dashboard-case-item-meta">
                          {caseItem.station} · {caseAlerts.length} open alert{caseAlerts.length === 1 ? "" : "s"}
                        </span>
                      </button>
                    );
                  })}
                  {visibleCases.length === 0 && <p className="dashboard-case-empty">No cases match that search.</p>}
                </div>
              </>
            )}
          </aside>

          <div className="dashboard-main-grid">
            <section className="panel dashboard-investigator-card">
              <p className="dashboard-card-kicker">Investigator</p>
              <img className="dashboard-investigator-avatar" src="/investigator-placeholder.svg" alt="" />
              <h2>{investigator?.name ?? "Unassigned"}</h2>
              <p>{investigator?.role ?? "No investigator assigned"}</p>
              <button type="button" className="btn btn-primary dashboard-open-case" onClick={openSelectedCase}>
                Open case
                <IconChevronRight />
              </button>
            </section>

            <section className="panel chart-card dashboard-activity-card">
              <div className="dashboard-card-heading">
                <div>
                  <p className="dashboard-card-kicker">Activity</p>
                  <h2 className="chart-card-title">Links observed by day</h2>
                </div>
                <span className="dashboard-chart-total">{relationships.length}</span>
              </div>
              <Bars data={linksByDay} />
            </section>

            <section className="panel chart-card dashboard-location-card">
              <div className="dashboard-card-heading">
                <div>
                  <h2 className="chart-card-title">Case location map</h2>
                </div>
                <select
                  key={selectedCase?.id}
                  className="dashboard-selected-case"
                  defaultValue={selectedCase?.code}
                  aria-label="Selected FIR"
                >
                  {cases.map((caseItem) => (
                    <option key={caseItem.id} value={caseItem.code}>
                      {caseItem.code}
                    </option>
                  ))}
                </select>
              </div>
              <SeverityHeatmap caseId={selectedCase?.id} />
            </section>

            <section className="panel dashboard-telemetry-card">
              <div className="dashboard-card-heading">
                <div>
                  <p className="dashboard-card-kicker">Telemetry</p>
                  <h2>Case details</h2>
                </div>
                {selectedCase && (
                  <span className="dashboard-case-status">
                    <span className="status-dot" style={{ background: caseStatusColor(selectedCase.status) }} />
                    {selectedCase.status}
                  </span>
                )}
              </div>
              <dl className="dashboard-telemetry-grid">
                <div><dt>Entities</dt><dd>{selectedEntities.length}</dd></div>
                <div><dt>Links</dt><dd>{selectedLinks.length}</dd></div>
                <div><dt>Recorded events</dt><dd>{selectedEvents.length}</dd></div>
                <div><dt>Open alerts</dt><dd className={selectedAlerts.length > 0 ? "has-alerts" : ""}>{selectedAlerts.length}</dd></div>
              </dl>
              <div className="dashboard-next-hearing">
                <span>Next hearing</span>
                <strong>{nextHearing ? `${nextHearing.hearingType} · ${formatDate(nextHearing.date)}` : "No upcoming date"}</strong>
              </div>
              <p className="dashboard-telemetry-station">{selectedCase?.station}</p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
