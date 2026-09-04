import { useState } from "react";
import { Link } from "react-router-dom";
import { getSocialProfile } from "../data/socialData";
import type { Entity, Relationship } from "../data/types";
import { calculateAge, EntityIcon, entitySubLabel, entityTypeLabel, formatDate, RiskBadge } from "./ui";
import { IconX } from "./icons";
import NetworkRoleCard from "./NetworkRoleCard";
import { maskLocation, maskPhone, maskPlate, useRedaction } from "../lib/redaction";
import { useWatchlist } from "../lib/watchlist";

interface EntityDetailPanelProps {
  entity: Entity;
  allEntities: Entity[];
  allRelationships: Relationship[];
  onClose: () => void;
  onSelectRelated: (id: string) => void;
}

export function fieldsFor(e: Entity, redacted: boolean): { label: string; value: string }[] {
  switch (e.type) {
    case "person":
      return [
        ...(e.aliases?.length ? [{ label: "Aliases", value: e.aliases.join(", ") }] : []),
        ...(e.dob ? [{ label: "Date of birth", value: formatDate(e.dob) }] : []),
        ...(e.dob ? [{ label: "Age", value: `${calculateAge(e.dob)} yrs` }] : []),
        ...(e.sex ? [{ label: "Sex", value: e.sex }] : []),
        { label: "Status", value: e.status },
        ...(e.lastKnownLocation
          ? [{ label: "Last known location", value: redacted ? maskLocation(e.lastKnownLocation) : e.lastKnownLocation }]
          : []),
      ];
    case "organization":
      return [
        { label: "Type", value: e.orgType },
        ...(e.registrationId ? [{ label: "Registration ID", value: e.registrationId }] : []),
      ];
    case "location":
      return [
        { label: "Address", value: redacted ? maskLocation(e.address) : e.address },
        { label: "Type", value: e.locationType },
      ];
    case "vehicle":
      return [
        { label: "Plate", value: redacted ? maskPlate(e.plate) : e.plate },
        { label: "Make / model", value: e.makeModel },
        ...(e.registeredTo ? [{ label: "Registered to", value: e.registeredTo }] : []),
      ];
    case "phone":
      return [
        { label: "Number", value: redacted ? maskPhone(e.number) : e.number },
        ...(e.carrier ? [{ label: "Carrier", value: e.carrier }] : []),
        ...(e.registeredTo ? [{ label: "Registered to", value: e.registeredTo }] : []),
      ];
  }
}

export default function EntityDetailPanel({ entity, allEntities, allRelationships, onClose, onSelectRelated }: EntityDetailPanelProps) {
  const connections = allRelationships.filter((r) => r.source === entity.id || r.target === entity.id);
  // Calculate corroboration from actual relationships: if multiple evidenceSources verify a link between A and B
  const corroboratedIds = new Set<string>();
  
  const { redacted } = useRedaction();
  const { isPinned, toggle } = useWatchlist();
  const pinned = isPinned(entity.id);
  const socialProfile = entity.type === "person" ? getSocialProfile(entity.id) : undefined;
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

  // group relationships by the entity on the other end, so a pair confirmed via two sources renders as one row
  const groupedConnections = new Map<string, typeof connections>();
  for (const rel of connections) {
    const otherId = rel.source === entity.id ? rel.target : rel.source;
    if (!groupedConnections.has(otherId)) groupedConnections.set(otherId, []);
    groupedConnections.get(otherId)!.push(rel);
  }

  // Populate corroboratedIds
  for (const [otherId, rels] of groupedConnections.entries()) {
    const sources = new Set(rels.map((r) => r.evidenceSource));
    if (sources.size > 1) {
      corroboratedIds.add(otherId);
    }
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="card-header">
        <h2>Entity profile</h2>
        <div style={{ display: "flex", gap: 6 }}>
          <button className={`btn ${pinned ? "btn-primary" : ""}`} onClick={() => toggle(entity.id)}>
            {pinned ? "Watchlisted" : "Add to watchlist"}
          </button>
          <button className="btn" onClick={onClose} aria-label="Close panel">
            <IconX />
          </button>
        </div>
      </div>
      <div className="card-body" style={{ overflowY: "auto", flex: 1 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
          <EntityIcon type={entity.type} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{entity.label}</div>
              <Link to={`/profile/${entity.id}`} style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none", whiteSpace: "nowrap" }}>
                Full profile &rsaquo;
              </Link>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              {entityTypeLabel[entity.type]} &middot; {entitySubLabel(entity)}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          <RiskBadge level={entity.riskLevel} />
          {entity.tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>

        <div className="section-title">Details</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
          {fieldsFor(entity, redacted).map((f) => (
            <div key={f.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
              <span style={{ color: "var(--text-tertiary)" }}>{f.label}</span>
              <span style={{ textAlign: "right", textTransform: f.label === "Status" ? "capitalize" : "none" }}>
                {f.value}
              </span>
            </div>
          ))}
        </div>

        <div className="section-title">Why this matters</div>
        <div style={{ marginBottom: 16 }}>
          <NetworkRoleCard entityId={entity.id} />
        </div>

        {entity.notes && (
          <>
            <div className="section-title">Investigator notes</div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>{entity.notes}</p>
          </>
        )}

        <div className="section-title">Connections ({groupedConnections.size})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: entity.type === "person" ? 16 : 0 }}>
          {[...groupedConnections.entries()].map(([otherId, rels]) => {
            const other = allEntities.find((e) => e.id === otherId);
            if (!other) return null;
            const sources = [...new Set(rels.map((r) => r.evidenceSource))];
            const isCorroborated = corroboratedIds.has(otherId);
            return (
              <button
                key={otherId}
                onClick={() => onSelectRelated(otherId)}
                className="connection-row"
                style={{ display: "flex", alignItems: "flex-start", gap: 8, textAlign: "left", width: "100%" }}
              >
                <EntityIcon type={other.type} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{other.label}</span>
                    {isCorroborated && (
                      <span className="badge badge-risk-low" title={`Confirmed independently via ${sources.length} sources`}>
                        {sources.length}&times; corroborated
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                    {rels.map((r, i) => (
                      <span key={r.id} style={{ textTransform: "capitalize" }}>
                        {i > 0 && " + "}
                        {r.type} &middot; {r.evidenceSource}
                      </span>
                    ))}
                    {" · "}
                    {formatDate(rels[0].observedOn)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {entity.type === "person" && (
          <>
            <div className="section-title">Social media intelligence</div>
            {socialProfile ? (
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                    fontSize: 12,
                    color: "var(--text-tertiary)",
                  }}
                >
                  <span>
                    {socialProfile.platform} &middot; {socialProfile.handle} &middot; {socialProfile.followers.toLocaleString("en-IN")} followers
                  </span>
                  <span className="mono">Scanned {socialProfile.lastScanned}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {socialProfile.posts.map((post) => (
                    <div key={post.id} className="social-post">
                      <p style={{ fontSize: 12, marginBottom: 6 }}>&ldquo;{post.content}&rdquo;</p>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6 }}>
                        {formatDate(post.postedOn)}
                        {post.location && ` · ${post.location}`}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--risk-medium)", display: "flex", gap: 5, alignItems: "flex-start" }}>
                        <span>&#9888;</span>
                        {post.flagReason}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : scanned ? (
              <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                No public social activity found linked to this subject.
              </p>
            ) : (
              <div>
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 10 }}>
                  Run an open-source scan for social accounts and posts associated with this subject.
                </p>
                <button
                  className="btn"
                  disabled={scanning}
                  onClick={() => {
                    setScanning(true);
                    setTimeout(() => {
                      setScanning(false);
                      setScanned(true);
                    }, 900);
                  }}
                >
                  {scanning ? "Scanning open sources..." : "Scan for social activity"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
