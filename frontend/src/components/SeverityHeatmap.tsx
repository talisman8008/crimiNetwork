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

export default function SeverityHeatmap() {
  const places = entities.filter(
    (e): e is LocationEntity => e.type === "location" && e.lat != null && e.lng != null,
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
