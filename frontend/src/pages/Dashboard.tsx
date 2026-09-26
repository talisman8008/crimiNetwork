import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, Marker, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import PageHeader from "../components/PageHeader";
import { eventsForCase } from "../data/timelineData";
import { courtDatesForCase } from "../data/courtData";
import { caseStatusColor, formatDate } from "../components/ui";
import { Bars } from "../components/Charts";
import { IconChevronLeft, IconChevronRight, IconPlus, IconSearch } from "../components/icons";
import { useActiveCase } from "../lib/activeCase";
import { useAuth } from "../lib/auth";
import { useCaseAlerts, useCaseGraph } from "../hooks/useCaseData";
import { alerts as mockAlerts, entitiesForCase, relationshipsForCase } from "../data/mockData";
import type { Case } from "../data/types";
import { CaptureMap, FitBounds, investigationMapPoints, markerIcon, demoMapLocations, demoMapRelationships } from "./MapView";

const DEMO_CASE_STORAGE_KEY = "netra-demo-uploaded-case";
const DEFAULT_NIGHTFALL_CASE: Case = {
  id: "demo-uploaded-case",
  code: "CASE-2026-0142",
  title: "Operation Nightfall",
  status: "active",
  priority: "high",
  openedOn: "2026-09-25",
  leadOfficer: "Inspector Asha Kulkarni",
  station: "Central Crime Station",
  entityIds: [],
  summary: "Curated intelligence analysis generated from uploaded case files.",
  sections: [],
};
const DAY_TANGO_CASE: Case = {
  id: "case-2",
  code: "CASE-2026-0117",
  title: "Day Tango",
  status: "under review",
  priority: "medium",
  openedOn: "2026-09-12",
  leadOfficer: "Inspector Asha Kulkarni",
  station: "Central Crime Station",
  entityIds: [],
  summary: "Coordinated field and financial activity under review.",
  sections: [],
};

function readDemoCase(): Case | null {
  try {
    const value = localStorage.getItem(DEMO_CASE_STORAGE_KEY);
    return value ? JSON.parse(value) as Case : null;
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { openCase } = useActiveCase();
  useAuth();

  const [caseSearch, setCaseSearch] = useState("");
  const [caseRailCollapsed, setCaseRailCollapsed] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [isAddingCase, setIsAddingCase] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, string[]>>({});
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [caseTitle, setCaseTitle] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [station, setStation] = useState("");
  const [createdCase, setCreatedCase] = useState<Case | null>(readDemoCase);
  const [hideOperationNightfall, setHideOperationNightfall] = useState(true);

  useEffect(() => {
    if (!isAnalysing) return;
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const nextPercent = Math.min(100, Math.round(((performance.now() - startedAt) / 3000) * 100));
      setUploadPercent(nextPercent);
      if (nextPercent === 100) window.clearInterval(timer);
    }, 50);
    return () => window.clearInterval(timer);
  }, [isAnalysing]);

  useEffect(() => {
    if (!isAnalysing || uploadPercent !== 100) return;
    const newCase: Case = {
      id: "demo-uploaded-case",
      code: caseNumber.trim() || "CASE-2026-0142",
      title: caseTitle.trim() || "Operation Nightfall",
      status: "active",
      priority: "high",
      openedOn: "2026-09-25",
      leadOfficer: "Inspector Asha Kulkarni",
      station: station.trim() || "Central Crime Station",
      entityIds: [],
      summary: "Curated intelligence analysis generated from uploaded case files.",
      sections: [],
    };
    localStorage.setItem(DEMO_CASE_STORAGE_KEY, JSON.stringify(newCase));
    setCreatedCase(newCase);
    setSelectedCaseId(newCase.id);
    setIsAnalysing(false);
    setIsAddingCase(false);
  }, [caseNumber, caseTitle, isAnalysing, station, uploadPercent]);

  const baseCases = [DAY_TANGO_CASE];
  const operationNightfall = createdCase ?? DEFAULT_NIGHTFALL_CASE;
  const displayCases = hideOperationNightfall ? baseCases : [operationNightfall, ...baseCases];
  const selectedCase = displayCases.find((c) => c.id === selectedCaseId) ?? displayCases[0];
  const isMockDashboardCase = selectedCase?.id === "demo-uploaded-case" || selectedCase?.id === "case-2";
  const seededCaseId = isMockDashboardCase ? "case-1" : selectedCase?.id;
  const { entities: selectedEntities, relationships: selectedLinks, loading: graphLoading } = useCaseGraph(selectedCase?.id);
  const { alerts: selectedCaseAlerts } = useCaseAlerts(selectedCase?.id);
  const dashboardEntities = isMockDashboardCase ? entitiesForCase("case-1") : selectedEntities;
  const dashboardLinks = isMockDashboardCase ? relationshipsForCase("case-1") : selectedLinks;
  const dashboardMapEntities = isMockDashboardCase ? [...dashboardEntities, ...demoMapLocations] : dashboardEntities;
  const dashboardMapLinks = isMockDashboardCase ? demoMapRelationships : dashboardLinks;
  const dashboardMapPoints = useMemo(
    () => investigationMapPoints(dashboardMapEntities, dashboardMapLinks),
    [dashboardMapEntities, dashboardMapLinks],
  );
  const selectedAlerts = isMockDashboardCase ? mockAlerts.filter((alert) => alert.caseId === "case-1" && alert.status !== "dismissed") : selectedCaseAlerts.filter((alert) => alert.status !== "dismissed");
  const selectedEvents = seededCaseId ? eventsForCase(seededCaseId) : [];
  const nextHearing = selectedCase
    ? courtDatesForCase(seededCaseId ?? selectedCase.id).find((h) => h.status === "upcoming")
    : undefined;
  const investigator = selectedCase?.leadOfficer
    ? { name: selectedCase.leadOfficer, role: `Lead investigator · ${selectedCase.station}` }
    : undefined;

  const visibleCases = useMemo(() => {
    const query = caseSearch.trim().toLowerCase();
    if (!query) return displayCases;
    return displayCases.filter((c) => `${c.code} ${c.title} ${c.station}`.toLowerCase().includes(query));
  }, [caseSearch, displayCases]);

  const linksByDay = useMemo(() => {
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const counts = new Array(7).fill(0);
    dashboardLinks.forEach((relationship) => {
      const date = new Date(relationship.observedOn);
      if (!Number.isNaN(date.getTime())) counts[date.getDay()] += 1;
    });
    return names.map((label, index) => ({ label, value: counts[index] }));
  }, [dashboardLinks]);

  function openSelectedCase() {
    if (!selectedCase) return;
    openCase(selectedCase.id);
    navigate("/workspace");
  }

  function selectFiles(kind: string, files: FileList | null) {
    if (!files?.length) return;
    setSelectedFiles((current) => ({ ...current, [kind]: Array.from(files, (file) => file.name) }));
  }

  const uploadSources = [
    ["fir", "FIRs"],
    ["cdr", "CDRs"],
    ["financial", "financial files"],
    ["other", "intelligence files"],
  ].filter(([kind]) => selectedFiles[kind]?.length);

  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="content dashboard-content">
        <div className={`dashboard-workspace ${caseRailCollapsed ? "is-case-rail-collapsed" : ""}`}>
          <aside className="dashboard-case-rail" aria-label="Investigation cases">
            <div className="dashboard-case-rail-header">
              {!caseRailCollapsed && <h2>Cases</h2>}
              <div className="dashboard-case-rail-controls">
                {!caseRailCollapsed && <button
                  type="button"
                  className={`dashboard-nightfall-toggle ${hideOperationNightfall ? "is-on" : ""}`}
                  onClick={() => setHideOperationNightfall((hidden) => {
                    if (!hidden && selectedCaseId === "demo-uploaded-case") setSelectedCaseId(baseCases[0]?.id ?? "");
                    return !hidden;
                  })}
                  aria-label={hideOperationNightfall ? "Show Operation Nightfall" : "Hide Operation Nightfall"}
                  aria-pressed={hideOperationNightfall}
                  title={hideOperationNightfall ? "Operation Nightfall hidden" : "Hide Operation Nightfall"}
                ><span /></button>}
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
                          {caseItem.station}
                        </span>
                      </button>
                    );
                  })}
                  {visibleCases.length === 0 && (
                    <p className="dashboard-case-empty">No cases match that search.</p>
                  )}
                </div>
                <button type="button" className="dashboard-add-case-tile" onClick={() => setIsAddingCase(true)}>
                  <span>Add case</span>
                  <IconPlus />
                </button>
              </>
            )}
          </aside>

          {isAddingCase && isAnalysing ? (
            <section className="dashboard-upload-progress-stage" aria-live="polite" aria-label="Case upload progress">
              <div className="dashboard-upload-progress-card">
                <div className="dashboard-progress-heading"><strong>Upload Progress</strong><span>{uploadPercent}%</span></div>
                <div className="dashboard-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadPercent}><span style={{ transform: `scaleX(${uploadPercent / 100})` }} /></div>
                <div className="dashboard-progress-source-list">
                  {uploadSources.map(([kind, label]) => {
                    const total = selectedFiles[kind].length;
                    const uploaded = uploadPercent === 100 ? total : Math.min(total, Math.floor((total * uploadPercent) / 100));
                    const complete = uploaded === total && total > 0;
                    return <div key={kind} className="dashboard-progress-source-row">
                      <span className={`dashboard-progress-check ${complete ? "is-complete" : ""}`} aria-hidden="true">✓</span>
                      <span>{uploaded}/{total} {label} uploaded</span>
                    </div>;
                  })}
                </div>
                {uploadPercent === 100 && <p className="dashboard-progress-complete">Files uploaded successfully. Preparing your case workspace…</p>}
              </div>
            </section>
          ) : isAddingCase ? (
            <section className="panel dashboard-upload-card" aria-labelledby="add-case-title">
              <div className="dashboard-upload-heading">
                <div>
                  <p className="dashboard-card-kicker">New investigation</p>
                  <h2 id="add-case-title">Add case files</h2>
                </div>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddingCase(false)}>Cancel</button>
              </div>
              <div className="dashboard-upload-fields">
                <label>Case title<input className="dashboard-form-input" type="text" value={caseTitle} onChange={(event) => setCaseTitle(event.target.value)} placeholder="e.g. Operation Nightfall" /></label>
                <label>Police station<input className="dashboard-form-input" type="text" value={station} onChange={(event) => setStation(event.target.value)} placeholder="e.g. Central Crime Station" /></label>
                <label>Case No:<input className="dashboard-form-input" type="text" value={caseNumber} onChange={(event) => setCaseNumber(event.target.value)} placeholder="e.g. CASE-2026-0142" /></label>
                <label>Priority<select className="dashboard-form-input" defaultValue="medium"><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
              </div>
              <div className="dashboard-source-upload-grid">
                {[["fir", "FIR documents", ".pdf,.txt,.doc,.docx"], ["cdr", "Call detail records", ".csv,.xlsx"], ["financial", "Financial records", ".csv,.xlsx"], ["other", "Other intelligence", ".pdf,.txt,.csv,.xlsx"]].map(([kind, label, accept]) => (
                  <label key={kind} className="dashboard-source-upload">
                    <input type="file" accept={accept} multiple={kind === "fir"} onChange={(event) => selectFiles(kind, event.target.files)} />
                    <IconPlus />
                    <strong>{label}</strong>
                    <span>{selectedFiles[kind]?.length ? `${selectedFiles[kind].length} file${selectedFiles[kind].length === 1 ? "" : "s"} selected` : kind === "fir" ? "Choose one or more FIR files" : "Choose a file"}</span>
                  </label>
                ))}
              </div>
              {Object.keys(selectedFiles).length > 0 && <div className="dashboard-file-preview">
                <div className="dashboard-file-preview-heading">
                  <strong>Uploaded files</strong>
                  <span>{Object.values(selectedFiles).flat().length} selected</span>
                </div>
                <div className="dashboard-file-preview-table-wrap">
                  <table className="dashboard-file-preview-table">
                    <thead><tr><th>Type</th><th>File name</th><th>Status</th></tr></thead>
                    <tbody>{Object.entries(selectedFiles).flatMap(([kind, files]) => files.map((fileName) => <tr key={`${kind}-${fileName}`}><td>{kind === "fir" ? "FIR" : kind === "cdr" ? "CDR" : kind === "financial" ? "Financial" : "Other"}</td><td title={fileName}>{fileName}</td><td>Ready</td></tr>))}</tbody>
                  </table>
                </div>
              </div>}
              <div className="dashboard-upload-actions">
                <p>Supported formats: PDF, TXT, CSV, XLSX, DOC and DOCX.</p>
                <button type="button" className="btn btn-primary" disabled={Object.keys(selectedFiles).length === 0} onClick={() => { setUploadPercent(0); setIsAnalysing(true); }}>Create case and analyse</button>
              </div>
            </section>
          ) : <div className="dashboard-main-grid">
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
                <span className="dashboard-chart-total">{isMockDashboardCase ? dashboardLinks.length : graphLoading ? "…" : dashboardLinks.length}</span>
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
                  {displayCases.map((caseItem) => (
                    <option key={caseItem.id} value={caseItem.code}>
                      {caseItem.code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="dashboard-shared-map">
                <MapContainer center={[20.5937, 78.9629]} zoom={5} zoomControl={false} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
                  <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri" />
                  <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}" attribution="&copy; OpenStreetMap contributors" />
                  <FitBounds points={dashboardMapPoints} />
                  <CaptureMap />
                  {dashboardMapPoints.map((point) => <Marker key={point.id} position={[point.lat, point.lng]} icon={markerIcon(point)}><Tooltip direction="top" offset={[0, -8]}><strong>{point.label}</strong><br />{point.precision === "recorded" ? "Recorded coordinates" : point.precision === "linked" ? "Linked location" : "City-level location"}</Tooltip></Marker>)}
                </MapContainer>
              </div>
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
                <div><dt>Entities</dt><dd>{isMockDashboardCase ? dashboardEntities.length : graphLoading ? "…" : dashboardEntities.length}</dd></div>
                <div><dt>Links</dt><dd>{isMockDashboardCase ? dashboardLinks.length : graphLoading ? "…" : dashboardLinks.length}</dd></div>
                <div><dt>Recorded events</dt><dd>{selectedEvents.length}</dd></div>
                <div><dt>Open alerts</dt><dd className={selectedAlerts.length > 0 ? "has-alerts" : ""}>{selectedAlerts.length}</dd></div>
              </dl>
              <div className="dashboard-next-hearing">
                <span>Next hearing</span>
                <strong>{nextHearing ? `${nextHearing.hearingType} · ${formatDate(nextHearing.date)}` : "No upcoming date"}</strong>
              </div>
              <p className="dashboard-telemetry-station">{selectedCase?.station}</p>
            </section>
          </div>}
        </div>
      </div>
    </>
  );
}
