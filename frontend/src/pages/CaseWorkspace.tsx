import { Link, useNavigate } from "react-router-dom";
import { MapContainer, Marker, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import PageHeader from "../components/PageHeader";
import {
  alerts,
  entitiesForCase,
  getCaseById,
  linkedCasesFor,
  relationshipsForCase,
} from "../data/mockData";
import { courtDatesForCase } from "../data/courtData";
import { cctvFootage } from "../data/cctvData";
import { eventsForCase } from "../data/timelineData";
import { caseStatusColor, EntityIcon, formatDate, SeverityBadge } from "../components/ui";
import { useActiveCase } from "../lib/activeCase";
import { useCase, useCaseGraph, useCases } from "../hooks/useCaseData";
import { IconChevronRight } from "../components/icons";
import { CaptureMap, FitBounds, locationCoordinate, markerIcon, type MapPoint } from "./MapView";
import type { Case } from "../data/types";

const DEMO_CASE_ID = "demo-uploaded-case";
const DEMO_CASE_STORAGE_KEY = "netra-demo-uploaded-case";

function readDemoCase(): Case | null {
  try {
    const value = localStorage.getItem(DEMO_CASE_STORAGE_KEY);
    return value ? JSON.parse(value) as Case : null;
  } catch {
    return null;
  }
}

const severityColor: Record<string, string> = {
  high: "var(--risk-high)",
  medium: "var(--risk-medium)",
  low: "var(--risk-low)",
};

const recentUpdates = [
  { title: "Forensic report added", detail: "Mobile device extraction completed", when: "Today · 10:42" },
  { title: "Network link verified", detail: "Financial association corroborated", when: "Yesterday · 16:18" },
];

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
  const { case: backendCase, loading: caseLoading } = useCase(activeCaseId);
  const { entities: caseEntities, relationships: caseLinks } = useCaseGraph(activeCaseId);
  const isDemoCase = activeCaseId === DEMO_CASE_ID;
  const c = isDemoCase ? readDemoCase() : backendCase;

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

  const team = c.leadOfficer
    ? [{ id: `${c.id}-lead`, name: c.leadOfficer, role: `Lead investigator · ${c.station}` }]
    : [];
  const workspaceEntities = isDemoCase ? entitiesForCase("case-1") : caseEntities;
  const workspaceLinks = isDemoCase ? relationshipsForCase("case-1") : caseLinks;
  const caseAlerts = alerts.filter((a) => a.caseId === (isDemoCase ? "case-1" : c.id) && a.status !== "dismissed");
  const seededId = isDemoCase ? "case-1" : c.code.startsWith("CASE001") ? "case-1" : c.code.startsWith("CASE002") ? "case-2" : null;
  // Court dates remain a deliberate local demo data source until that backend endpoint is available.
  const hearings = courtDatesForCase(seededId ?? c.id);
  const upcoming = hearings.filter((h) => h.status === "upcoming");
  const footage = seededId ? cctvFootage.filter((f) => f.caseId === seededId) : [];
  const scheduledHearings = [...hearings].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const recentFootage = [...footage].sort((a, b) => b.recordedOn.localeCompare(a.recordedOn)).slice(0, 3);
  const events = eventsForCase(seededId ?? c.id);
  const linked = linkedCasesFor(seededId ?? c.id);
  const keyFigures = workspaceEntities
    .map((entity) => ({
      entity,
      count: workspaceLinks.filter((link) => link.source === entity.id || link.target === entity.id).length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const topCount = keyFigures[0]?.count || 1;
  const mapPoints: MapPoint[] = workspaceEntities.flatMap((entity) => {
    if (entity.type !== "location") return [];
    const coordinate = locationCoordinate(entity);
    return coordinate ? [{ id: entity.id, type: entity.type, label: entity.label, riskLevel: entity.riskLevel, ...coordinate }] : [];
  });
  const activityPoints: MapPoint[] = events.flatMap((event) => {
    if (!Number.isFinite(event.lat) || !Number.isFinite(event.lng)) return [];
    return [{
      id: `activity-${event.id}`,
      type: "location",
      label: event.locationLabel ?? event.summary,
      lat: event.lat!,
      lng: event.lng!,
      riskLevel: "high",
      precision: "recorded",
    }];
  });
  const previewPoints = [...mapPoints, ...activityPoints];
  const showLinkedFirst = linked.length > 0 && caseAlerts.length === 0;

  const flaggedPatterns = (secondary = false) => (
    <>
      <div className={`workspace-subhead ${secondary ? "workspace-subhead-spaced" : ""}`}><span>Flagged patterns</span><Link to="/alerts">View alerts</Link></div>
      <div className="alert-rows">
        {caseAlerts.length
          ? caseAlerts.map((a) => <Link key={a.id} to="/alerts" className="alert-row"><span className="alert-row-stripe" style={{ background: severityColor[a.severity] }} /><span className="alert-row-body"><span className="alert-row-title">{a.title}</span><span className="alert-row-meta">{a.patternType} &middot; {formatDate(a.detectedOn)}</span></span><SeverityBadge severity={a.severity} /></Link>)
          : <div className="empty-state">No open alerts in this case.</div>}
      </div>
    </>
  );

  const linkedInvestigations = (secondary = false) => (
    <>
      <div className={`workspace-subhead ${secondary ? "workspace-subhead-spaced" : ""}`}><span>Linked investigations</span><Link to="/cases">Case files</Link></div>
      <div className="linked-cases workspace-linked-cases">
        {linked.length
          ? linked.map((l) => {
              const other = getCaseById(l.otherCaseId);
              if (!other) return null;
              return <div key={l.otherCaseId} className="linked-case"><div className="linked-case-top"><span className="mono linked-case-code">{other.code}</span><span className="linked-case-title">{other.title}</span><span className="badge badge-risk-medium">{l.sharedEntities.length} shared</span></div><div className="linked-case-entities">{l.sharedEntities.map((e) => <Link key={e.id} to={`/profile/${e.id}`} className="linked-case-chip"><EntityIcon type={e.type} />{e.label}</Link>)}</div></div>;
            })
          : <div className="empty-state">No linked investigations for this case.</div>}
      </div>
    </>
  );

  return (
    <>
      <PageHeader
        title={
          <>
            <span className="workspace-page-title">Workspace</span>
            <span className="workspace-page-code mono">· {c.code}</span>
          </>
        }
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
      <div className="content workspace-content">
        <div className="workspace-dashboard">
          <aside className="workspace-column workspace-context-column">
            <section className="card workspace-panel">
              <div className="card-header"><h2>Case overview</h2><span className="mono workspace-case-code">{c.code}</span></div>
              <div className="workspace-stat-grid">
                <div><strong>{workspaceEntities.length}</strong><span>Entities</span></div>
                <div><strong>{workspaceLinks.length}</strong><span>Links</span></div>
                <div><strong>{events.length}</strong><span>Events</span></div>
                <div><strong style={{ color: caseAlerts.length ? "var(--risk-high)" : undefined }}>{caseAlerts.length}</strong><span>Alerts</span></div>
                <div><strong>{upcoming.length}</strong><span>Hearings</span></div>
                <div><strong>{team.length}</strong><span>Investigators</span></div>
              </div>
            </section>

            <section className="card workspace-panel">
              <div className="card-header"><h2>Investigators</h2></div>
              <div className="workspace-panel-body workspace-team-list">
                {team.map((o) => <div key={o.id} className="officer-chip"><span className="officer-avatar">{initials(o.name)}</span><div><div className="officer-chip-name">{o.name}</div><div className="officer-chip-role">{o.role}</div></div></div>)}
              </div>
            </section>

            <section className="card workspace-panel workspace-key-players">
              <div className="card-header"><h2>Key players</h2><Link to={`/network?case=${c.id}`}>Open graph</Link></div>
              <div className="rank-list workspace-panel-body">
                {keyFigures.map(({ entity: e, count }, i) => <Link key={e.id} to={`/profile/${e.id}`} className="rank-row"><span className="rank-num mono">{i + 1}</span><span className="rank-name">{e.label}</span><span className="rank-bar-wrap"><span className="rank-bar" style={{ width: `${(count / topCount) * 100}%`, background: severityColor[e.riskLevel] }} /></span><span className="rank-value mono">{count}</span></Link>)}
              </div>
            </section>

            <section className="card workspace-panel workspace-recent-updates">
              <div className="card-header"><h2>RECENT UPDATES</h2></div>
              <div className="workspace-panel-body workspace-update-list">
                {recentUpdates.map((update) => <div key={update.title} className="workspace-update-row"><div><strong>{update.title}</strong><span>{update.detail}</span></div><time>{update.when}</time></div>)}
              </div>
            </section>
          </aside>

          <main className="workspace-column workspace-main-column">
            <section className="card workspace-panel workspace-current-project">
              <div className="card-header"><h2>Current investigation</h2><span className="workspace-status"><span className="status-dot" style={{ background: caseStatusColor(c.status) }} />{c.status}</span></div>
              <div className="workspace-panel-body">
                {showLinkedFirst ? <>{linkedInvestigations()}{flaggedPatterns(true)}</> : <>{flaggedPatterns()}{linkedInvestigations(true)}</>}
              </div>
            </section>

            <section className="card workspace-panel workspace-activity-panel">
              <div className="card-header"><h2>Recorded activity</h2><Link to="/map">See on map</Link></div>
              <div className="workspace-map-preview">
                <MapContainer center={[20.5937, 78.9629]} zoom={5} zoomControl={false} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
                  <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri" />
                  <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}" attribution="&copy; OpenStreetMap contributors" />
                  <FitBounds points={previewPoints} />
                  <CaptureMap />
                  {mapPoints.map((point) => <Marker key={point.id} position={[point.lat, point.lng]} icon={markerIcon(point)}><Tooltip direction="top" offset={[0, -8]}><strong>{point.label}</strong><br />{point.precision === "recorded" ? "Recorded coordinates" : "City-level location"}</Tooltip></Marker>)}
                  {activityPoints.map((point) => {
                    const event = events.find((item) => `activity-${item.id}` === point.id);
                    return <Marker key={point.id} position={[point.lat, point.lng]} icon={markerIcon(point)}><Tooltip direction="top" offset={[0, -8]}><strong>{event?.time} · {event?.locationLabel ?? "Recorded activity"}</strong><br />{event?.summary}</Tooltip></Marker>;
                  })}
                </MapContainer>
                {!previewPoints.length && <div className="workspace-map-empty">No mapped locations in this case.</div>}
              </div>
              <div className="workspace-activity-ribbon">
                {events.length === 0 ? "No timestamped activity logged for this case." : `${events.length} timestamped activit${events.length === 1 ? "y" : "ies"} recorded · ${activityPoints.length} mapped`}
              </div>
            </section>
          </main>

          <aside className="workspace-column workspace-actions-column">
            <section className="card workspace-panel">
              <div className="card-header"><h2>Case actions</h2></div>
              <div className="workspace-panel-body workspace-action-list">
                <button className="btn btn-primary" onClick={() => navigate(`/network?case=${c.id}`)}>Open network graph</button>
                <button className="btn" onClick={() => navigate("/map")}>Location map</button>
                <Link to={`/dossier/${c.id}`} className="btn" target="_blank" rel="noopener noreferrer">Print dossier</Link>
              </div>
            </section>

            <section className="card workspace-panel">
              <div className="card-header"><h2>Court schedule</h2><Link to="/court-dates">See all</Link></div>
              <div className="case-rows workspace-panel-body">
                {scheduledHearings.map((h) => <Link key={h.id} to="/court-dates" className="case-row"><span className="case-row-main"><span className="case-row-title">{h.hearingType}</span><span className="case-row-meta">{h.court} &middot; {h.judge}</span></span><span className="case-row-count mono">{formatDate(h.date)}</span></Link>)}
              </div>
            </section>

            <section className="card workspace-panel">
              <div className="card-header"><h2>CCTV sightings</h2><Link to="/cctv">Open viewer</Link></div>
              <div className="case-rows workspace-panel-body">
                {recentFootage.length === 0 ? <div className="empty-state">No footage logged.</div> : recentFootage.map((f) => <Link key={f.id} to="/cctv" className="case-row"><span className="case-row-main"><span className="case-row-title">{f.title}</span><span className="case-row-meta">{f.locationLabel} &middot; {f.recordedOn}</span></span><span className="case-row-count mono">{f.duration}</span></Link>)}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
