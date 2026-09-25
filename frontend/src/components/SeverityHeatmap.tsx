import { useState } from "react";
import { MapContainer, CircleMarker, TileLayer, Tooltip, useMap } from "react-leaflet";
import { Link } from "react-router-dom";
import { entities } from "../data/mockData";
import type { LocationEntity } from "../data/types";
import { IconMaximize, IconMinus, IconPlus } from "./icons";

const severityColor: Record<string, string> = {
  high: "#dc2626",
  medium: "#f59e0b",
  low: "#16a34a",
};

// Compact-map enrichment for the recorded demo case. These remain local to the
// dashboard preview rather than changing the case graph or full map data.
const demoPreviewLocations: LocationEntity[] = [
  { id: "preview-pune", type: "location", label: "Kothrud Exchange, Pune", riskLevel: "medium", caseIds: ["case-1"], tags: [], address: "Kothrud, Pune", locationType: "CDR tower", lat: 18.5074, lng: 73.8077 },
  { id: "preview-nashik", type: "location", label: "Nashik Bypass Toll Plaza", riskLevel: "low", caseIds: ["case-1"], tags: [], address: "Nashik, Maharashtra", locationType: "Toll plaza", lat: 19.9975, lng: 73.7898 },
  { id: "preview-panipat", type: "location", label: "GT Road Depot, Panipat", riskLevel: "high", caseIds: ["case-1"], tags: [], address: "Panipat, Haryana", locationType: "Warehouse", lat: 29.3909, lng: 76.9635 },
  { id: "preview-delhi", type: "location", label: "Rohini Cell Site, Delhi", riskLevel: "medium", caseIds: ["case-1"], tags: [], address: "Rohini, Delhi", locationType: "CDR tower", lat: 28.7494, lng: 77.0566 },
  { id: "preview-bhopal", type: "location", label: "Bhopal Transit Point", riskLevel: "low", caseIds: ["case-1"], tags: [], address: "Bhopal, Madhya Pradesh", locationType: "Transit", lat: 23.2599, lng: 77.4126 },
  { id: "preview-nariman", type: "location", label: "Nariman Point Office", riskLevel: "high", caseIds: ["case-1"], tags: [], address: "Nariman Point, Mumbai", locationType: "Office", lat: 18.9256, lng: 72.8242 },
];

/** Leaflet ships its own zoom control, but it does not match anything else on the page, so the
 *  buttons are ours and drive the map through its instance. */
function ZoomButtons() {
  const map = useMap();
  return (
    <div className="heatmap-zoom">
      <button onClick={() => map.zoomIn()} aria-label="Zoom in">
        <IconPlus />
      </button>
      <button onClick={() => map.zoomOut()} aria-label="Zoom out">
        <IconMinus />
      </button>
    </div>
  );
}

export default function SeverityHeatmap({ caseId }: { caseId?: string }) {
  const places = [...entities, ...(caseId === "case-1" ? demoPreviewLocations : [])].filter(
    (e): e is LocationEntity =>
      e.type === "location" &&
      e.lat != null &&
      e.lng != null &&
      (caseId == null || e.caseIds.includes(caseId)),
  );
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="heatmap-wrap">
      <MapContainer
        center={[23.5, 78.5]}
        zoom={4}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        style={{ height: "100%", width: "100%", background: "transparent" }}
      >
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}" />
        {places.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={hovered === p.id ? 9 : 6}
            pathOptions={{
              color: "#fff",
              weight: 2,
              fillColor: severityColor[p.riskLevel] ?? "#64748b",
              fillOpacity: 1,
            }}
            eventHandlers={{
              mouseover: () => setHovered(p.id),
              mouseout: () => setHovered(null),
            }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <strong>{p.label}</strong>
              <br />
              {p.riskLevel} risk
            </Tooltip>
          </CircleMarker>
        ))}
        <ZoomButtons />
      </MapContainer>

      <Link to="/map" className="heatmap-expand" aria-label="Open the full location map">
        <IconMaximize />
      </Link>
    </div>
  );
}
