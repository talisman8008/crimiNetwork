import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import PageHeader from "../components/PageHeader";
import EntityDetailPanel from "../components/EntityDetailPanel";
import { cases, entities, getEntityById, relationshipsFor, relationships } from "../data/mockData";
import type { EntityType, RiskLevel } from "../data/types";
import { IconMinus, IconPlus, IconTarget } from "../components/icons";
import { eventDates, eventsWithLocation, eventTypeLabel } from "../data/timelineData";
import EventTimeline from "../components/EventTimeline";
import { formatDate } from "../components/ui";
import { useActiveCase } from "../lib/activeCase";

const typeColor: Record<string, string> = {
  person: "#2563eb",
  location: "#0d9488",
};

const riskSize: Record<RiskLevel, number> = { high: 22, medium: 17, low: 13 };

interface MapPoint {
  id: string;
  type: EntityType;
  label: string;
  lat: number;
  lng: number;
  riskLevel: RiskLevel;
}

function markerIcon(point: MapPoint) {
  const color = typeColor[point.type] ?? "#5b6472";
  const size = riskSize[point.riskLevel];
  return L.divIcon({
    className: "map-marker-icon",
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(15,32,54,0.5);"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const eventTypeColor: Record<string, string> = {
  call: "#2563eb",
  sighting: "#0d9488",
  transaction: "#d97706",
  "cell-site": "#7c3aed",
  "vehicle-movement": "#e11d48",
  meeting: "#16a34a",
};

/** Square marker so timed observations read differently from the round entity pins. */
function eventIcon(type: string) {
  const color = eventTypeColor[type] ?? "#5b6472";
  return L.divIcon({
    className: "map-event-icon",
    html: `<span style="display:block;width:14px;height:14px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(15,32,54,0.55);transform:rotate(45deg);"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function CaptureMap({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 12);
    } else {
      map.fitBounds(
        points.map((p) => [p.lat, p.lng]),
        { padding: [48, 48] },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.map((p) => p.id).join(","), map]);
  return null;
}

export default function MapView() {
  const { activeCaseId } = useActiveCase();
  const [caseId, setCaseId] = useState(activeCaseId ?? "all");
  const [showLocations, setShowLocations] = useState(true);
  const [showPersons, setShowPersons] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [dayIndex, setDayIndex] = useState<number>(0);
  const [dayMode, setDayMode] = useState(true);

  // Located observations for this case, and the days they fall on. Picking a day filters the
  // map to what was actually recorded that day, with clock times, rather than static pins.
  const locatedEvents = useMemo(
    () => eventsWithLocation().filter((e) => caseId === "all" || e.caseId === caseId),
    [caseId],
  );
  const days = useMemo(() => eventDates(locatedEvents), [locatedEvents]);
  const activeDay = dayMode && days[dayIndex] ? days[dayIndex] : null;
  const dayEvents = useMemo(
    () => (activeDay ? locatedEvents.filter((e) => e.date === activeDay) : []),
    [locatedEvents, activeDay],
  );

  const points = useMemo<MapPoint[]>(() => {
    const result: MapPoint[] = [];
    for (const e of entities) {
      if (caseId !== "all" && !e.caseIds.includes(caseId)) continue;
      if (e.type === "location" && showLocations) {
        result.push({ id: e.id, type: e.type, label: e.label, lat: e.lat, lng: e.lng, riskLevel: e.riskLevel });
      } else if (e.type === "person" && showPersons && e.lat != null && e.lng != null) {
        result.push({ id: e.id, type: e.type, label: e.label, lat: e.lat, lng: e.lng, riskLevel: e.riskLevel });
      }
    }
    return result;
  }, [caseId, showLocations, showPersons]);

  const selectedEntity = selectedId ? getEntityById(selectedId) : undefined;
  const selectedConnections = useMemo(() => {
    if (!selectedEntity) return 0;
    return new Set(
      relationshipsFor(selectedEntity.id).map((r) => (r.source === selectedEntity.id ? r.target : r.source)),
    ).size;
  }, [selectedEntity]);

  function recenter() {
    if (!mapInstance || points.length === 0) return;
    if (points.length === 1) {
      mapInstance.setView([points[0].lat, points[0].lng], 12);
    } else {
      mapInstance.fitBounds(
        points.map((p) => [p.lat, p.lng]),
        { padding: [48, 48] },
      );
    }
  }

  return (
    <>
      <PageHeader eyebrow="Geospatial" title="Location Map" />
      <div className="filter-bar">
        <select className="select" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
          <option value="all">All cases</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}: {c.title}
            </option>
          ))}
        </select>
        <div style={{ width: 1, height: 20, background: "var(--border)" }} />
        <button className={`chip-toggle ${showLocations ? "active" : ""}`} onClick={() => setShowLocations((v) => !v)}>
          <span className="swatch" style={{ background: typeColor.location }} />
          Locations
        </button>
        <button className={`chip-toggle ${showPersons ? "active" : ""}`} onClick={() => setShowPersons((v) => !v)}>
          <span className="swatch" style={{ background: typeColor.person }} />
          Persons of interest
        </button>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-tertiary)" }}>{points.length} plotted</div>
      </div>

      {days.length > 0 && (
        <div className="filter-bar day-scrubber">
          <button className={`btn ${dayMode ? "btn-primary" : ""}`} onClick={() => setDayMode((v) => !v)}>
            {dayMode ? "Timeline on" : "Timeline off"}
          </button>
          <button
            className="btn"
            onClick={() => setDayIndex((i) => Math.max(0, i - 1))}
            disabled={!dayMode || dayIndex === 0}
          >
            &lsaquo;
          </button>
          <input
            type="range"
            min={0}
            max={days.length - 1}
            value={dayIndex}
            disabled={!dayMode}
            onChange={(e) => setDayIndex(Number(e.target.value))}
            aria-label="Scrub recorded days"
            style={{ flex: 1, minWidth: 140, accentColor: "var(--accent)" }}
          />
          <button
            className="btn"
            onClick={() => setDayIndex((i) => Math.min(days.length - 1, i + 1))}
            disabled={!dayMode || dayIndex === days.length - 1}
          >
            &rsaquo;
          </button>
          <span className="mono" style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", minWidth: 92 }}>
            {activeDay ? formatDate(activeDay) : `${days.length} days`}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
            {activeDay
              ? `${dayEvents.length} recorded ${dayEvents.length === 1 ? "event" : "events"}`
              : `${locatedEvents.length} events total`}
          </span>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <MapContainer center={[20.5, 77]} zoom={5} zoomControl={false} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri"
            />
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <FitBounds points={points} />
            <CaptureMap onReady={setMapInstance} />
            {activeDay &&
              dayEvents.map((ev) => (
                <Marker
                  key={ev.id}
                  position={[ev.lat!, ev.lng!]}
                  icon={eventIcon(ev.type)}
                  eventHandlers={{ click: () => setSelectedId(ev.entityIds[0] ?? null) }}
                >
                  <Tooltip direction="top" offset={[0, -10]}>
                    <strong>{ev.time}</strong> &middot; {eventTypeLabel[ev.type]}
                    <br />
                    {ev.summary}
                  </Tooltip>
                </Marker>
              ))}
            {points.map((p) => (
              <Marker
                key={p.id}
                position={[p.lat, p.lng]}
                icon={markerIcon(p)}
                eventHandlers={{ click: () => setSelectedId(p.id) }}
              >
                <Tooltip direction="top" offset={[0, -8]}>
                  {p.label}
                </Tooltip>
              </Marker>
            ))}
          </MapContainer>

          <div className="icon-dock icon-dock-center-left">
            <button className="icon-dock-btn" onClick={recenter} aria-label="Recenter map on plotted points">
              <IconTarget />
            </button>
            <button className="icon-dock-btn" onClick={() => mapInstance?.zoomIn()} aria-label="Zoom in">
              <IconPlus />
            </button>
            <button className="icon-dock-btn" onClick={() => mapInstance?.zoomOut()} aria-label="Zoom out">
              <IconMinus />
            </button>
          </div>

          {selectedEntity && (
            <div className="map-stat-pills">
              <div className="map-stat-pill">
                <div className="map-stat-pill-value">{selectedConnections}</div>
                <div className="map-stat-pill-label">Connections</div>
              </div>
              <div className="map-stat-pill">
                <div className="map-stat-pill-value" style={{ textTransform: "capitalize" }}>
                  {selectedEntity.riskLevel}
                </div>
                <div className="map-stat-pill-label">Risk level</div>
              </div>
              <div className="map-stat-pill">
                <div className="map-stat-pill-value">{selectedEntity.caseIds.length}</div>
                <div className="map-stat-pill-label">{selectedEntity.caseIds.length === 1 ? "Case" : "Cases"}</div>
              </div>
            </div>
          )}
        </div>
        <div style={{ width: 340, borderLeft: "1px solid var(--border)", padding: 14, flexShrink: 0, overflow: "hidden" }}>
          {selectedEntity ? (
            <EntityDetailPanel entity={selectedEntity} allEntities={entities} allRelationships={relationships} onClose={() => setSelectedId(null)} onSelectRelated={setSelectedId} />
          ) : (
            activeDay ? (
            <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <div className="card-header">
                <h2>Activity on {formatDate(activeDay)}</h2>
              </div>
              <div className="card-body" style={{ overflowY: "auto", flex: 1 }}>
                <EventTimeline events={dayEvents} activeDate={activeDay} emptyMessage="Nothing recorded on this day." />
              </div>
            </div>
            ) : (
            <div className="card" style={{ height: "100%" }}>
              <div className="card-header">
                <h2>Legend</h2>
              </div>
              <div className="card-body">
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14 }}>
                  Select a marker to view its profile. Marker size reflects assessed risk level.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: typeColor.location }} />
                    Locations: warehouses, offices, residences
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: typeColor.person }} />
                    Persons of interest: last known location
                  </div>
                </div>
                <div className="section-title">Data source</div>
                <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                  Coordinates are derived from FIR filings, surveillance logs, and registered addresses. Positions
                  are approximate.
                </p>
              </div>
            </div>
            )
          )}
        </div>
      </div>
    </>
  );
}
