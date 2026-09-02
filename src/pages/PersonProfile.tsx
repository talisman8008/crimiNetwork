import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { alerts, corroborationFor, getCaseById, getEntityById, relationshipsFor } from "../data/mockData";
import { cctvFootage } from "../data/cctvData";
import { courtDatesForCase } from "../data/courtData";
import { getSocialProfile } from "../data/socialData";
import { fieldsFor } from "../components/EntityDetailPanel";
import NetworkRoleCard from "../components/NetworkRoleCard";
import EventTimeline from "../components/EventTimeline";
import { eventsForEntity } from "../data/timelineData";
import { EntityIcon, entityTypeLabel, formatDate, RiskBadge, SeverityBadge } from "../components/ui";
import { IconChevronRight } from "../components/icons";
import { useRedaction } from "../lib/redaction";
import { useWatchlist } from "../lib/watchlist";

export default function PersonProfile() {
  const { entityId } = useParams<{ entityId: string }>();
  const entity = entityId ? getEntityById(entityId) : undefined;
  const { redacted } = useRedaction();
  const { isPinned, toggle } = useWatchlist();
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

  if (!entity) {
    return (
      <div style={{ padding: 40 }}>
        <p>Entity not found.</p>
        <Link to="/entities">Back to entities</Link>
      </div>
    );
  }

  const connections = relationshipsFor(entity.id);
  const corroborated = corroborationFor(entity.id);
  const corroboratedIds = new Set(corroborated.map((c) => c.otherId));
  const uniqueConnections = [...new Set(connections.map((r) => (r.source === entity.id ? r.target : r.source)))].map(
    (otherId) => ({ otherId, isCorroborated: corroboratedIds.has(otherId) }),
  );
  const activity = eventsForEntity(entity.id);
  const relatedAlerts = alerts.filter((a) => a.relatedEntityIds.includes(entity.id));
  const relatedFootage = cctvFootage.filter((c) => c.linkedEntityIds.includes(entity.id));
  const relatedHearings = entity.caseIds.flatMap((cid) => courtDatesForCase(cid).map((h) => ({ ...h, caseCode: getCaseById(cid)?.code })));
  const socialProfile = entity.type === "person" ? getSocialProfile(entity.id) : undefined;
  const pinned = isPinned(entity.id);

  return (
    <>
      <PageHeader
        eyebrow="Profile"
        title={entity.label}
        right={
          <button className={`btn ${pinned ? "btn-primary" : ""}`} onClick={() => toggle(entity.id)}>
            {pinned ? "Watchlisted" : "Add to watchlist"}
          </button>
        }
      />
      <div className="content">
        <div className="two-col">
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-body" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <span className="profile-avatar">
                  <EntityIcon type={entity.type} />
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{entity.label}</div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 10 }}>
                    {entityTypeLabel[entity.type]} &middot;{" "}
                    {entity.caseIds
                      .map((cid) => getCaseById(cid)?.code)
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <RiskBadge level={entity.riskLevel} />
                    {entity.tags.map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <h2>Details</h2>
              </div>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {fieldsFor(entity, redacted).map((f) => (
                  <div key={f.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                    <span style={{ color: "var(--text-tertiary)" }}>{f.label}</span>
                    <span style={{ textAlign: "right" }}>{f.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <h2>Why this matters</h2>
              </div>
              <div className="card-body">
                <NetworkRoleCard entityId={entity.id} />
              </div>
            </div>

            {activity.length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-header">
                  <h2>Recorded activity ({activity.length})</h2>
                </div>
                <div className="card-body">
                  <EventTimeline events={activity} />
                </div>
              </div>
            )}

            {entity.notes && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-header">
                  <h2>Investigator notes</h2>
                </div>
                <div className="card-body">
                  <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{entity.notes}</p>
                </div>
              </div>
            )}

            {entity.type === "person" && (
              <div className="card">
                <div className="card-header">
                  <h2>Social media intelligence</h2>
                </div>
                <div className="card-body">
                  {socialProfile ? (
                    <>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 10 }}>
                        {socialProfile.platform} &middot; {socialProfile.handle} &middot;{" "}
                        {socialProfile.followers.toLocaleString("en-IN")} followers &middot; scanned{" "}
                        {socialProfile.lastScanned}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {socialProfile.posts.map((post) => (
                          <div key={post.id} className="social-post">
                            <p style={{ fontSize: 12, marginBottom: 6 }}>&ldquo;{post.content}&rdquo;</p>
                            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6 }}>
                              {formatDate(post.postedOn)}
                              {post.location && ` · ${post.location}`}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--risk-medium)" }}>&#9888; {post.flagReason}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : scanned ? (
                    <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No public social activity found.</p>
                  ) : (
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
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <h2>Connections ({connections.length})</h2>
                {corroborated.length > 0 && <span className="badge badge-risk-low">{corroborated.length} corroborated</span>}
              </div>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {uniqueConnections.length === 0 && <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No linked entities.</p>}
                {uniqueConnections.slice(0, 6).map(({ otherId, isCorroborated }) => {
                  const other = getEntityById(otherId);
                  if (!other) return null;
                  return (
                    <Link
                      key={otherId}
                      to={`/profile/${otherId}`}
                      style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}
                    >
                      <EntityIcon type={other.type} />
                      <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{other.label}</span>
                      {isCorroborated && <span className="badge badge-risk-low">corroborated</span>}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <h2>Related alerts ({relatedAlerts.length})</h2>
              </div>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {relatedAlerts.length === 0 && <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No alerts.</p>}
                {relatedAlerts.map((a) => (
                  <Link key={a.id} to="/alerts" style={{ textDecoration: "none", color: "inherit" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{a.title}</span>
                      <SeverityBadge severity={a.severity} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{formatDate(a.detectedOn)}</div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <h2>CCTV sightings ({relatedFootage.length})</h2>
              </div>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {relatedFootage.length === 0 && <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No footage.</p>}
                {relatedFootage.map((f) => (
                  <Link key={f.id} to="/cctv" style={{ textDecoration: "none", color: "inherit" }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{f.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {f.locationLabel} &middot; {formatDate(f.recordedOn.slice(0, 10))}
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2>Court dates ({relatedHearings.length})</h2>
                <Link to="/court-dates" className="btn">
                  View all
                  <IconChevronRight />
                </Link>
              </div>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {relatedHearings.length === 0 && <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No hearings.</p>}
                {relatedHearings.map((h) => (
                  <div key={h.id}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{h.hearingType}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {formatDate(h.date)} &middot; {h.caseCode}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
