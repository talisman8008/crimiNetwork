import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { cctvFootage as initialFootage } from "../data/cctvData";
import { cases, getEntityById } from "../data/mockData";
import { EntityIcon, formatDate } from "../components/ui";
import { IconCamera, IconPlay, IconX } from "../components/icons";
import { useAuth } from "../lib/auth";
import type { CctvFootage, FootageStatus } from "../data/types";

const statusMeta: Record<FootageStatus, { label: string; color: string }> = {
  unreviewed: { label: "Unreviewed", color: "var(--status-syncing)" },
  reviewed: { label: "Reviewed", color: "var(--status-connected)" },
  flagged: { label: "Flagged", color: "var(--risk-high)" },
};

function Thumb({ clip, large }: { clip: CctvFootage; large?: boolean }) {
  return (
    <div className={`cctv-thumb ${large ? "large" : ""}`}>
      <span className="cctv-thumb-rec">
        <span className="dot" /> {clip.cameraId} &middot; {clip.recordedOn}
      </span>
      <span className="cctv-thumb-cam">
        <IconCamera />
      </span>
      <span className="cctv-play-btn">
        <IconPlay />
      </span>
      <span className="cctv-thumb-duration">{clip.duration}</span>
    </div>
  );
}

export default function CctvFootagePage() {
  const { officerId } = useAuth();
  const [footage, setFootage] = useState<CctvFootage[]>(initialFootage);
  const [caseId, setCaseId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<FootageStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const filtered = useMemo(
    () =>
      footage
        .filter((c) => (caseId === "all" ? true : c.caseId === caseId))
        .filter((c) => (statusFilter === "all" ? true : c.status === statusFilter))
        .sort((a, b) => (a.recordedOn < b.recordedOn ? 1 : -1)),
    [footage, caseId, statusFilter],
  );

  const selected = selectedId ? footage.find((c) => c.id === selectedId) : undefined;

  function setStatus(id: string, status: FootageStatus) {
    setFootage((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status,
              history: [
                ...c.history,
                { actor: officerId ?? "Unknown officer", action: `Marked as ${status}`, at: new Date().toISOString().slice(0, 16).replace("T", " ") },
              ],
            }
          : c,
      ),
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Field Evidence"
        title="CCTV Footage"
        right={<span className="synthetic-tag">Synthetic footage · for demonstration</span>}
      />
      <div className="filter-bar">
        <select className="select" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
          <option value="all">All cases</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}: {c.title}
            </option>
          ))}
        </select>
        <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as FootageStatus | "all")}>
          <option value="all">All statuses</option>
          <option value="unreviewed">Unreviewed</option>
          <option value="reviewed">Reviewed</option>
          <option value="flagged">Flagged</option>
        </select>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-tertiary)" }}>
          {filtered.length} of {footage.length} clips
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div className="cctv-grid">
            {filtered.map((clip) => (
              <button
                key={clip.id}
                className="cctv-card"
                onClick={() => {
                  setSelectedId(clip.id);
                  setPlaying(false);
                }}
              >
                <Thumb clip={clip} />
                <div className="cctv-card-body">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{clip.title}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>
                    {clip.source} &middot; {clip.locationLabel}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="status-dot" style={{ background: statusMeta[clip.status].color }} />
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{statusMeta[clip.status].label}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {filtered.length === 0 && <div className="empty-state">No footage matches the current filters.</div>}
        </div>

        {selected && (
          <div style={{ width: 380, borderLeft: "1px solid var(--border)", padding: 14, flexShrink: 0, overflowY: "auto" }}>
            <div className="card">
              <div className="card-header">
                <h2>Footage detail</h2>
                <button className="btn" onClick={() => setSelectedId(null)} aria-label="Close panel">
                  <IconX />
                </button>
              </div>
              <div className="card-body">
                <div onClick={() => setPlaying((v) => !v)} style={{ cursor: "pointer", marginBottom: 14 }}>
                  <Thumb clip={selected} large />
                </div>
                {playing && (
                  <div className="login-error" style={{ color: "var(--text-tertiary)", marginBottom: 14 }}>
                    Playback requires a connection to the source DVR / NVR system. Not available in this preview.
                  </div>
                )}

                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{selected.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 12 }}>
                  {formatDate(selected.recordedOn.slice(0, 10))} &middot; {selected.recordedOn.slice(11)} &middot; {selected.duration}
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  <span className="badge badge-neutral">{statusMeta[selected.status].label}</span>
                  {selected.tags.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>

                <div className="section-title">Details</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
                  {[
                    ["Camera ID", selected.cameraId],
                    ["Camera type", selected.cameraType],
                    ["Source", selected.source],
                    ["Monitored by", selected.monitoredBy],
                    ["Location", selected.locationLabel],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                      <span style={{ color: "var(--text-tertiary)" }}>{label}</span>
                      <span style={{ textAlign: "right" }}>{value}</span>
                    </div>
                  ))}
                </div>

                <div className="section-title">Notes</div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>{selected.notes}</p>

                {selected.linkedEntityIds.length > 0 && (
                  <>
                    <div className="section-title">Linked entities</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                      {selected.linkedEntityIds.map((id) => {
                        const e = getEntityById(id);
                        if (!e) return null;
                        return (
                          <Link
                            key={id}
                            to={`/network?case=${selected.caseId}&entity=${id}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "8px 9px",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius-sm)",
                              background: "var(--surface-sunken)",
                              textDecoration: "none",
                              color: "inherit",
                            }}
                          >
                            <EntityIcon type={e.type} />
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{e.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}

                <div className="section-title">Chain of custody</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                  {selected.history.map((h, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, fontSize: 12 }}>
                      <span className="mono" style={{ color: "var(--text-tertiary)", flexShrink: 0, width: 100 }}>
                        {h.at}
                      </span>
                      <span>
                        <strong>{h.actor}:</strong> {h.action}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" onClick={() => setStatus(selected.id, "reviewed")}>
                    Mark reviewed
                  </button>
                  <button className="btn btn-primary" onClick={() => setStatus(selected.id, "flagged")}>
                    Flag for case file
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
