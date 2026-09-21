import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import PageHeader from "../components/PageHeader";
import EntityDetailPanel from "../components/EntityDetailPanel";
import { EntityIcon } from "../components/ui";
import { IconMinus, IconPlus, IconTarget } from "../components/icons";
import { useActiveCase } from "../lib/activeCase";
import { useCaseGraph, useCases } from "../hooks/useCaseData";
import type { Entity, EntityType, RiskLevel } from "../data/types";

const typeColor: Record<EntityType, string> = { person: "#2563eb", organization: "#7c6a45", location: "#0d9488", vehicle: "#5b5476", phone: "#7a4f58" };
const riskSize: Record<RiskLevel, number> = { high: 22, medium: 17, low: 13 };

// The graph only persists coordinates for some records. These anchors are used when an actual
// location label identifies a city; tooltips say so, rather than presenting it as GPS data.
const cityAnchors: Array<{ terms: string[]; lat: number; lng: number }> = [
  { terms: ["mumbai", "dadar", "andheri", "kurla", "nariman"], lat: 19.076, lng: 72.8777 },
  { terms: ["pune", "kothrud", "shivajinagar"], lat: 18.5204, lng: 73.8567 },
  { terms: ["panipat", "gt road", "haryana"], lat: 29.3909, lng: 76.9635 },
  { terms: ["delhi", "rohini", "dwarka", "connaught"], lat: 28.6139, lng: 77.209 },
  { terms: ["kolkata", "howrah"], lat: 22.5726, lng: 88.3639 },
  { terms: ["bengaluru", "bangalore"], lat: 12.9716, lng: 77.5946 },
  { terms: ["chennai"], lat: 13.0827, lng: 80.2707 },
];

export interface MapPoint { id: string; type: EntityType; label: string; lat: number; lng: number; riskLevel: RiskLevel; precision: "recorded" | "city" | "linked"; }

export function markerIcon(point: MapPoint) {
  const size = riskSize[point.riskLevel];
  return L.divIcon({
    className: "map-marker-icon",
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${typeColor[point.type]};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(15,32,54,0.5);"></span>`,
    iconSize: [size, size], iconAnchor: [size / 2, size / 2],
  });
}

export function locationCoordinate(entity: Entity) {
  if (entity.type === "location" && Number.isFinite(entity.lat) && Number.isFinite(entity.lng) && !(entity.lat === 0 && entity.lng === 0)) {
    return { lat: entity.lat, lng: entity.lng, precision: "recorded" as const };
  }
  const normalized = entity.label.toLowerCase();
  const city = cityAnchors.find((anchor) => anchor.terms.some((term) => normalized.includes(term)));
  return city ? { lat: city.lat, lng: city.lng, precision: "city" as const } : null;
}

export function CaptureMap({ onReady }: { onReady?: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady?.(map);
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => map.invalidateSize()));
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [map, onReady]);
  return null;
}

export function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  const pointKey = points.map((point) => `${point.id}:${point.lat}:${point.lng}`).join(",");
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 11);
    else map.fitBounds(points.map((point) => [point.lat, point.lng]), { padding: [52, 52] });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, pointKey]);
  return null;
}

export default function MapView() {
  const { activeCaseId } = useActiveCase();
  const { cases } = useCases();
  const [caseId, setCaseId] = useState(activeCaseId ?? "");
  const [showLocations, setShowLocations] = useState(true);
  const [showPersons, setShowPersons] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const { entities, relationships, loading, error } = useCaseGraph(caseId || null);

  useEffect(() => { if (activeCaseId) setCaseId(activeCaseId); }, [activeCaseId]);

  const entityById = useMemo(() => new Map(entities.map((entity) => [entity.id, entity])), [entities]);
  const points = useMemo<MapPoint[]>(() => {
    const plotted = new Map<string, MapPoint>();
    if (showLocations) entities.filter((entity) => entity.type === "location").forEach((entity) => {
      const coordinate = locationCoordinate(entity);
      if (coordinate) plotted.set(entity.id, { ...entity, ...coordinate });
    });
    if (showPersons) entities.filter((entity) => entity.type === "person").forEach((person) => {
      const relatedLocationId = relationships
        .filter((relationship) => relationship.source === person.id || relationship.target === person.id)
        .map((relationship) => relationship.source === person.id ? relationship.target : relationship.source)
        .find((id) => entityById.get(id)?.type === "location");
      const relatedLocation = relatedLocationId ? entityById.get(relatedLocationId) : undefined;
      const coordinate = relatedLocation ? locationCoordinate(relatedLocation) : null;
      if (coordinate) plotted.set(person.id, { id: person.id, type: person.type, label: person.label, lat: coordinate.lat, lng: coordinate.lng, riskLevel: person.riskLevel, precision: "linked" });
    });
    return [...plotted.values()];
  }, [entities, relationships, entityById, showLocations, showPersons]);

  const selectedEntity = selectedId ? entityById.get(selectedId) : undefined;
  const selectedConnections = useMemo(() => selectedEntity ? new Set(relationships.filter((relationship) => relationship.source === selectedEntity.id || relationship.target === selectedEntity.id).map((relationship) => relationship.source === selectedEntity.id ? relationship.target : relationship.source)).size : 0, [selectedEntity, relationships]);

  function recenter() {
    if (!mapInstance || !points.length) return;
    if (points.length === 1) mapInstance.setView([points[0].lat, points[0].lng], 11);
    else mapInstance.fitBounds(points.map((point) => [point.lat, point.lng]), { padding: [52, 52] });
  }

  return <>
    <PageHeader eyebrow="Geospatial" title="Location Map" />
    <div className="filter-bar">
      <select className="select" value={caseId} onChange={(event) => { setCaseId(event.target.value); setSelectedId(null); }}>
        <option value="">Select a case</option>
        {cases.map((caseData) => <option key={caseData.id} value={caseData.id}>{caseData.code}: {caseData.title}</option>)}
      </select>
      <div style={{ width: 1, height: 20, background: "var(--border)" }} />
      <button className={`chip-toggle ${showLocations ? "active" : ""}`} onClick={() => setShowLocations((value) => !value)}><span className="swatch" style={{ background: typeColor.location }} /> Locations</button>
      <button className={`chip-toggle ${showPersons ? "active" : ""}`} onClick={() => setShowPersons((value) => !value)}><span className="swatch" style={{ background: typeColor.person }} /> Persons at linked locations</button>
      <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-tertiary)" }}>{points.length} plotted</div>
    </div>

    <div className="location-map-workspace">
      <div className="location-map-canvas" style={{ flex: 1, position: "relative" }}>
        <MapContainer center={[20.5937, 78.9629]} zoom={5} zoomControl={false} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri" />
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}" attribution="&copy; OpenStreetMap contributors" />
          <FitBounds points={points} />
          <CaptureMap onReady={setMapInstance} />
          {points.map((point) => <Marker key={point.id} position={[point.lat, point.lng]} icon={markerIcon(point)} eventHandlers={{ click: () => setSelectedId(point.id) }}><Tooltip direction="top" offset={[0, -8]}><strong>{point.label}</strong><br />{point.precision === "recorded" ? "Recorded coordinates" : point.precision === "linked" ? "Linked location" : "City-level location"}</Tooltip></Marker>)}
        </MapContainer>
        <div className="icon-dock icon-dock-center-left">
          <button className="icon-dock-btn" onClick={recenter} aria-label="Recenter map on plotted points"><IconTarget /></button>
          <button className="icon-dock-btn" onClick={() => mapInstance?.zoomIn()} aria-label="Zoom in"><IconPlus /></button>
          <button className="icon-dock-btn" onClick={() => mapInstance?.zoomOut()} aria-label="Zoom out"><IconMinus /></button>
        </div>
        {!loading && caseId && points.length === 0 && <div className="map-empty-overlay">No mapped locations in this case. Import coordinates or location labels that identify a city to plot them here.</div>}
        {selectedEntity && <div className="map-stat-pills">
          <div className="map-stat-pill"><div className="map-stat-pill-value">{selectedConnections}</div><div className="map-stat-pill-label">Connections</div></div>
          <div className="map-stat-pill"><div className="map-stat-pill-value" style={{ textTransform: "capitalize" }}>{selectedEntity.riskLevel}</div><div className="map-stat-pill-label">Risk level</div></div>
          <div className="map-stat-pill"><div className="map-stat-pill-value">{selectedEntity.caseIds.length}</div><div className="map-stat-pill-label">Cases</div></div>
        </div>}
      </div>
      <div className="location-map-sidebar">
        {selectedEntity ? <EntityDetailPanel entity={selectedEntity} relationships={relationships} entityById={entityById} onClose={() => setSelectedId(null)} onSelectRelated={setSelectedId} /> : <div className="card" style={{ height: "100%" }}>
          <div className="card-header"><h2>Map guide</h2></div>
          <div className="card-body">
            {loading && <div className="empty-state">Loading case locations&hellip;</div>}
            {error && <div className="empty-state">Could not load map data: {error}</div>}
            {!loading && !error && <><p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14 }}>Explore the current case geographically. Select a marker to inspect its live entity record and connections.</p><div style={{ display: "flex", flexDirection: "column", gap: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}><EntityIcon type="location" /> Locations use recorded or city-level coordinates.</div><div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}><EntityIcon type="person" /> Person markers indicate a graph-linked location.</div></div></>}
          </div>
        </div>}
      </div>
    </div>
  </>;
}
