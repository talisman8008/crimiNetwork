import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import PageHeader from "../components/PageHeader";
import EntityDetailPanel from "../components/EntityDetailPanel";
import { EntityIcon } from "../components/ui";
import { IconMinus, IconPlus, IconTarget } from "../components/icons";
import { useActiveCase } from "../lib/activeCase";
import { useCaseGraph } from "../hooks/useCaseData";
import { entitiesForCase, relationshipsForCase } from "../data/mockData";
import type { Entity, EntityType, Relationship, RiskLevel } from "../data/types";

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

const DEMO_CASE_ID = "demo-uploaded-case";
export const demoMapLocations: Entity[] = [
  { id: "demo-bandra", type: "location", label: "Bandra transit hub", riskLevel: "medium", caseIds: ["case-1"], tags: ["CDR cluster", "transit"], address: "Bandra West, Mumbai", locationType: "Transit area", lat: 19.0596, lng: 72.8295, notes: "Repeated handset activity around the transit hub on the day before the incident." },
  { id: "demo-kurla", type: "location", label: "Kurla warehouse lane", riskLevel: "high", caseIds: ["case-1"], tags: ["CCTV", "vehicle sighting"], address: "Kurla West, Mumbai", locationType: "Industrial lane", lat: 19.0728, lng: 72.8826, notes: "Vehicle matching the FIR description was recorded entering this lane." },
  { id: "demo-colaba", type: "location", label: "Colaba financial district", riskLevel: "medium", caseIds: ["case-1"], tags: ["financial activity"], address: "Colaba, Mumbai", locationType: "Commercial area", lat: 18.9067, lng: 72.8147, notes: "Financial transaction activity linked to the front company was concentrated here." },
  { id: "demo-govandi", type: "location", label: "Govandi storage site", riskLevel: "high", caseIds: ["case-1"], tags: ["surveillance", "evidence lead"], address: "Govandi East, Mumbai", locationType: "Storage facility", lat: 19.0535, lng: 72.9225, notes: "Storage site identified from surveillance notes and vehicle movement records." },
];
export const demoMapRelationships: Relationship[] = [
  ...relationshipsForCase("case-1"),
  { id: "map-rajan-kurla", source: "rajan", target: "demo-kurla", type: "frequents", weight: 4, evidenceSource: "Surveillance Reports", observedOn: "2026-03-15", description: "Subject sighted near the warehouse lane." },
  { id: "map-imran-bandra", source: "imran", target: "demo-bandra", type: "communication", weight: 3, evidenceSource: "Call Detail Records", observedOn: "2026-03-16", description: "Coordinator handset was active near the transit hub." },
  { id: "map-vikram-colaba", source: "vikram", target: "demo-colaba", type: "financial", weight: 3, evidenceSource: "Financial Transactions", observedOn: "2026-03-14", description: "Transaction trail points to the commercial district." },
  { id: "map-arun-govandi", source: "arun", target: "demo-govandi", type: "frequents", weight: 4, evidenceSource: "Surveillance Reports", observedOn: "2026-03-17", description: "Driver linked to the storage site through vehicle movement." },
  { id: "map-imran-malad", source: "imran", target: "malad", type: "frequents", weight: 4, evidenceSource: "Surveillance Reports", observedOn: "2026-03-13", description: "Field coordinator was observed near Evershine Nagar." },
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

/** Shared marker projection for the full map and the workspace preview. */
export function investigationMapPoints(
  entities: Entity[],
  relationships: Relationship[],
  options = { locations: true, persons: true },
): MapPoint[] {
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  const plotted = new Map<string, MapPoint>();
  if (options.locations) {
    entities.filter((entity) => entity.type === "location").forEach((entity) => {
      const coordinate = locationCoordinate(entity);
      if (coordinate) plotted.set(entity.id, { ...entity, ...coordinate });
    });
  }
  if (options.persons) {
    entities.filter((entity) => entity.type === "person").forEach((person) => {
      const relatedLocationId = relationships
        .filter((relationship) => relationship.source === person.id || relationship.target === person.id)
        .map((relationship) => relationship.source === person.id ? relationship.target : relationship.source)
        .find((id) => entityById.get(id)?.type === "location");
      const relatedLocation = relatedLocationId ? entityById.get(relatedLocationId) : undefined;
      const coordinate = relatedLocation ? locationCoordinate(relatedLocation) : null;
      if (coordinate) plotted.set(person.id, { id: person.id, type: person.type, label: person.label, lat: coordinate.lat, lng: coordinate.lng, riskLevel: person.riskLevel, precision: "linked" });
    });
  }
  return [...plotted.values()];
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
  const [caseId, setCaseId] = useState(activeCaseId ?? "");
  const [showLocations, setShowLocations] = useState(true);
  const [showPersons, setShowPersons] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const { entities: liveEntities, relationships: liveRelationships, loading, error } = useCaseGraph(caseId || null);

  useEffect(() => { if (activeCaseId) setCaseId(activeCaseId); }, [activeCaseId]);

  const isDemoCase = caseId === DEMO_CASE_ID;
  const entities = isDemoCase ? [...entitiesForCase("case-1"), ...demoMapLocations] : liveEntities;
  const relationships = isDemoCase ? demoMapRelationships : liveRelationships;
  const mapLoading = isDemoCase ? false : loading;
  const mapError = isDemoCase ? null : error;
  const entityById = useMemo(() => new Map(entities.map((entity) => [entity.id, entity])), [entities]);
  const points = useMemo(
    () => investigationMapPoints(entities, relationships, { locations: showLocations, persons: showPersons }),
    [entities, relationships, showLocations, showPersons],
  );

  const selectedEntity = selectedId ? entityById.get(selectedId) : undefined;
  const selectedConnections = useMemo(() => selectedEntity ? new Set(relationships.filter((relationship) => relationship.source === selectedEntity.id || relationship.target === selectedEntity.id).map((relationship) => relationship.source === selectedEntity.id ? relationship.target : relationship.source)).size : 0, [selectedEntity, relationships]);
  const mappedLocations = points.filter((point) => point.type === "location");
  const mappedPeople = points.filter((point) => point.type === "person");
  const highRiskLocations = mappedLocations.filter((point) => point.riskLevel === "high");
  const evidenceSources = new Set(relationships.map((relationship) => relationship.evidenceSource));

  function recenter() {
    if (!mapInstance || !points.length) return;
    if (points.length === 1) mapInstance.setView([points[0].lat, points[0].lng], 11);
    else mapInstance.fitBounds(points.map((point) => [point.lat, point.lng]), { padding: [52, 52] });
  }

  return <>
    <PageHeader eyebrow="Geospatial" title="Location Map" />
    <div className="filter-bar">
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
        {!mapLoading && caseId && points.length === 0 && <div className="map-empty-overlay">No mapped locations in this case. Import coordinates or location labels that identify a city to plot them here.</div>}
        {selectedEntity && <div className="map-stat-pills">
          <div className="map-stat-pill"><div className="map-stat-pill-value">{selectedConnections}</div><div className="map-stat-pill-label">Connections</div></div>
          <div className="map-stat-pill"><div className="map-stat-pill-value" style={{ textTransform: "capitalize" }}>{selectedEntity.riskLevel}</div><div className="map-stat-pill-label">Risk level</div></div>
          <div className="map-stat-pill"><div className="map-stat-pill-value">{selectedEntity.caseIds.length}</div><div className="map-stat-pill-label">Cases</div></div>
        </div>}
      </div>
      <div className="location-map-sidebar">
        {selectedEntity ? <EntityDetailPanel entity={selectedEntity} relationships={relationships} entityById={entityById} onClose={() => setSelectedId(null)} onSelectRelated={setSelectedId} /> : <div className="card map-guide-card" style={{ height: "100%" }}>
          <div className="card-header"><h2>Map guide</h2></div>
          <div className="card-body">
            {mapLoading && <div className="empty-state">Loading case locations&hellip;</div>}
            {mapError && <div className="empty-state">Could not load map data: {mapError}</div>}
            {!mapLoading && !mapError && <>
              <p className="map-guide-intro">Investigation footprint for the selected case. Select a marker to inspect its entity record, direct links, and source evidence.</p>
              <div className="map-guide-summary">
                <div><strong>{mappedLocations.length}</strong><span>locations</span></div>
                <div><strong>{mappedPeople.length}</strong><span>linked people</span></div>
                <div><strong>{highRiskLocations.length}</strong><span>high risk</span></div>
              </div>
              <div className="map-guide-section-title">Marker guide</div>
              <div className="map-guide-legend">
                <div><EntityIcon type="location" /><span>Recorded location or observed site</span></div>
                <div><EntityIcon type="person" /><span>Person positioned from a linked location</span></div>
              </div>
              <div className="map-guide-section-title">Priority locations</div>
              <div className="map-guide-locations">
                {highRiskLocations.slice(0, 4).map((point) => (
                  <button key={point.id} onClick={() => setSelectedId(point.id)}>
                    <span className="map-guide-risk-dot" />
                    <span>{point.label}</span>
                    <span className="map-guide-location-meta">High risk</span>
                  </button>
                ))}
              </div>
              <div className="map-guide-evidence">Evidence overlay: {evidenceSources.size} corroborating sources · FIR, CDR, finance and surveillance records.</div>
            </>}
          </div>
        </div>}
      </div>
    </div>
  </>;
}
