import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { alerts as curatedAlerts, corroborationFor, getCaseById, getEntityById, relationshipsFor } from "../data/mockData";
import { cctvFootage } from "../data/cctvData";
import { courtDatesForCase } from "../data/courtData";
import { getSocialProfile } from "../data/socialData";
import NetworkRoleCard from "../components/NetworkRoleCard";
import EventTimeline from "../components/EventTimeline";
import { eventsForEntity } from "../data/timelineData";
import { EntityIcon, entityTypeLabel, formatDate, RiskBadge, SeverityBadge } from "../components/ui";
import { LoaderCircle } from "lucide-react";
import { useWatchlist } from "../lib/watchlist";
import { useActiveCase } from "../lib/activeCase";
import { useCase, useCaseAlerts, useCaseEntityProfile, useCaseGraph } from "../hooks/useCaseData";
import type { SocialProfile, TimelineEvent } from "../data/types";

const profileAvatarFiles = [
  "/avatars/profile-1.jpeg",
  "/avatars/profile-2.jpeg",
  "/avatars/profile-3.jpeg",
  "/avatars/profile-4.jpeg",
  "/avatars/profile-5.jpeg",
];

export default function PersonProfile() {
  const { entityId } = useParams<{ entityId: string }>();
  const location = useLocation();
  const { activeCaseId } = useActiveCase();
  const { entities: liveEntities, relationships: liveRelationships, loading: graphLoading } = useCaseGraph(activeCaseId);
  const { case: activeCase } = useCase(activeCaseId);
  const { alerts: caseAlerts } = useCaseAlerts(activeCaseId);
  const { profile: entityProfile } = useCaseEntityProfile(activeCaseId, entityId);
  const entity = entityId ? liveEntities.find((candidate) => candidate.id === entityId) ?? getEntityById(entityId) : undefined;
  const { isPinned, toggle } = useWatchlist();
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [activityTab, setActivityTab] = useState<"activity" | "court">("activity");

  useEffect(() => {
    if (location.search !== "?print=1") return;
    const printTimer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(printTimer);
  }, [location.search]);

  if (!entity) {
    return (
      <div style={{ padding: 40 }}>
        <p>{graphLoading ? "Loading entity…" : "Entity not found."}</p>
        <Link to="/entities">Back to entities</Link>
      </div>
    );
  }

  const mockCaseId = activeCaseId === "demo-uploaded-case" || activeCaseId === "case-1"
    ? "case-1"
    : activeCaseId === "case-2" || activeCase?.code.startsWith("CASE002")
      ? "case-2"
      : activeCase?.code.startsWith("CASE001")
        ? "case-1"
        : undefined;
  const connections = liveEntities.some((candidate) => candidate.id === entity.id)
    ? liveRelationships.filter((relationship) => relationship.source === entity.id || relationship.target === entity.id)
    : relationshipsFor(entity.id);
  const corroborated = corroborationFor(entity.id);
  const corroboratedIds = new Set(corroborated.map((c) => c.otherId));
  const findEntity = (id: string) => liveEntities.find((candidate) => candidate.id === id) ?? getEntityById(id);
  const uniqueConnections = [...new Set(connections.map((r) => (r.source === entity.id ? r.target : r.source)))].map(
    (otherId) => ({ otherId, isCorroborated: corroboratedIds.has(otherId) }),
  );
  const relationshipActivity: TimelineEvent[] = connections
    .filter((relationship) => /^\d{4}-\d{2}-\d{2}/.test(relationship.observedOn))
    .map((relationship) => {
      const otherId = relationship.source === entity.id ? relationship.target : relationship.source;
      const other = findEntity(otherId);
      const [date, time = "—"] = relationship.observedOn.replace("T", " ").split(" ");
      const type: TimelineEvent["type"] = relationship.type === "communication" ? "call" : relationship.type === "financial" ? "transaction" : relationship.type === "frequents" ? "sighting" : "meeting";
      return {
        id: relationship.id,
        type,
        caseId: activeCaseId ?? "",
        date,
        time: time.slice(0, 5),
        entityIds: [relationship.source, relationship.target],
        evidenceSource: relationship.evidenceSource,
        sourceRef: relationship.evidenceSource,
        summary: `${entity.label} has a ${relationship.type.replace("_", " ")} link with ${other?.label ?? "a connected entity"}.`,
      };
    })
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  const activity = relationshipActivity.length > 0 ? relationshipActivity : eventsForEntity(entity.id);
  const profileAlerts = mockCaseId ? curatedAlerts.filter((alert) => alert.caseId === mockCaseId) : caseAlerts;
  const relatedAlerts = profileAlerts.filter((alert) => alert.relatedEntityIds.includes(entity.id));
  const relatedFootage = mockCaseId ? cctvFootage.filter((footage) => footage.caseId === mockCaseId).slice(0, 3) : [];
  const relatedHearings = mockCaseId
    ? courtDatesForCase(mockCaseId).map((hearing) => ({ ...hearing, caseCode: getCaseById(mockCaseId)?.code }))
    : entity.caseIds.flatMap((cid) => courtDatesForCase(cid).map((hearing) => ({ ...hearing, caseCode: getCaseById(cid)?.code })));
  const socialProfile: SocialProfile | undefined = entity.type === "person"
    ? getSocialProfile(entity.id) ?? {
      entityId: entity.id,
      platform: "Telegram",
      handle: `@${entity.label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      displayName: entity.label,
      followers: 186,
      lastScanned: "2026-03-18 10:24",
      posts: [
        {
          id: `demo-social-${entity.id}`,
          platform: "Telegram",
          handle: `@${entity.label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
          postedOn: "2026-03-16",
          content: "Coordination activity noted around the active investigation window.",
          flagReason: "Account timing overlaps with a corroborated case event and is retained for investigator review.",
          location: entity.lastKnownLocation,
        },
      ],
    }
    : undefined;
  const avatarSrc = entity.type === "person"
    ? profileAvatarFiles[[...entity.id].reduce((total, character) => total + character.charCodeAt(0), 0) % profileAvatarFiles.length]
    : undefined;
  const caseCodes = entity.caseIds.map((cid) => getCaseById(cid)?.code).filter((code): code is string => Boolean(code));
  const typeSpecificFields = (() => {
    switch (entity.type) {
      case "person":
        return [
          ...(entity.aliases?.length ? [{ label: "Aliases", value: entity.aliases.join(", ") }] : []),
          ...(entity.dob ? [{ label: "Date of birth", value: formatDate(entity.dob) }] : []),
          ...(entity.sex ? [{ label: "Sex", value: entity.sex }] : []),
          { label: "Case status", value: entity.status[0].toUpperCase() + entity.status.slice(1) },
          ...(entity.lastKnownLocation ? [{ label: "Last known location", value: entity.lastKnownLocation }] : []),
        ];
      case "organization":
        return [
          { label: "Organisation type", value: entity.orgType },
          ...(entity.registrationId ? [{ label: "Registration ID", value: entity.registrationId }] : []),
        ];
      case "location":
        return [
          { label: "Address", value: entity.address },
          { label: "Location type", value: entity.locationType },
          { label: "Coordinates", value: `${entity.lat.toFixed(4)}, ${entity.lng.toFixed(4)}` },
        ];
      case "vehicle":
        return [
          { label: "Registration", value: entity.plate },
          { label: "Make / model", value: entity.makeModel },
          ...(entity.registeredTo ? [{ label: "Registered to", value: entity.registeredTo }] : []),
        ];
      case "phone":
        return [
          { label: "Number", value: entity.number },
          ...(entity.carrier ? [{ label: "Carrier", value: entity.carrier }] : []),
          ...(entity.registeredTo ? [{ label: "Registered to", value: entity.registeredTo }] : []),
        ];
    }
  })();
  const detailFields = [
    { label: "Entity type", value: entityTypeLabel[entity.type] },
    { label: "Risk assessment", value: `${entity.riskLevel[0].toUpperCase()}${entity.riskLevel.slice(1)} priority` },
    { label: "Case files", value: caseCodes.join(", ") || activeCase?.code || "Unassigned" },
    { label: "Evidence links", value: `${connections.length} recorded relationship${connections.length === 1 ? "" : "s"}` },
    ...typeSpecificFields,
    ...(entityProfile?.identity.sources?.length ? [{ label: "Sources", value: entityProfile.identity.sources.join(", ") }] : []),
    ...(entityProfile?.identity.appearance_count ? [{ label: "Appearances", value: String(entityProfile.identity.appearance_count) }] : []),
    ...(entityProfile?.identity.confidence != null ? [{ label: "Confidence", value: `${Math.round(entityProfile.identity.confidence * 100)}%` }] : []),
  ];
  const pinned = isPinned(entity.id);

  return (
    <>
      <PageHeader
        title="PROFILE"
        right={
          <button className={`btn no-print ${pinned ? "btn-primary" : ""}`} onClick={() => toggle(entity.id)}>
            {pinned ? "Watchlisted" : "Add to watchlist"}
          </button>
        }
      />
      <div className="content profile-content">
        <div className="profile-bento">
          <div className="profile-bento-primary">
            <div className="card profile-identity">
              <div className="card-body" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <span className="profile-avatar">
                  {avatarSrc ? <img src={avatarSrc} alt="" /> : <EntityIcon type={entity.type} />}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{entity.label}</div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 10 }}>
                    {entityTypeLabel[entity.type]} &middot;{" "}
                    {activeCase?.code ?? entity.caseIds.map((cid) => getCaseById(cid)?.code).filter(Boolean).join(", ")}
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

            <div className="card profile-details">
              <div className="card-header">
                <h2>Details</h2>
              </div>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {detailFields.map((f) => (
                  <div key={f.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                    <span style={{ color: "var(--text-tertiary)" }}>{f.label}</span>
                    <span style={{ textAlign: "right" }}>{f.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card profile-network">
              <div className="card-header">
                <h2>Why this matters</h2>
              </div>
              <div className="card-body">
                <NetworkRoleCard entityId={entity.id} connectionCount={connections.length} totalEntities={liveEntities.length} />
              </div>
            </div>

            <div className="card profile-activity">
                <div className="card-header">
                  <div className="profile-card-tabs" role="tablist" aria-label="Activity and court records">
                    <button className={activityTab === "activity" ? "active" : ""} role="tab" aria-selected={activityTab === "activity"} onClick={() => setActivityTab("activity")}>
                      Recorded activity
                    </button>
                    <button className={activityTab === "court" ? "active" : ""} role="tab" aria-selected={activityTab === "court"} onClick={() => setActivityTab("court")}>
                      Court dates ({relatedHearings.length})
                    </button>
                  </div>
                </div>
                {activityTab === "activity" ? (
                  <div className="card-body">
                    {activity.length > 0 ? <EventTimeline events={activity} /> : <p className="profile-empty">No recorded activity.</p>}
                  </div>
                ) : (
                  <div className="card-body profile-court-tab-body">
                    {relatedHearings.length === 0 && <p className="profile-empty">No hearings.</p>}
                    {relatedHearings.map((h) => (
                      <div key={h.id} className="profile-court-tab-row">
                        <div>{h.hearingType}</div>
                        <div>{formatDate(h.date)} &middot; {h.caseCode}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            {entity.notes && (
              <div className="card profile-notes">
                <div className="card-header">
                  <h2>Investigator notes</h2>
                </div>
                <div className="card-body">
                  <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{entity.notes}</p>
                </div>
              </div>
            )}

            {entity.type === "person" && (
              <div className="card profile-social">
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
                      className="btn profile-social-scan"
                      disabled={scanning}
                      aria-busy={scanning}
                      onClick={() => {
                        setScanning(true);
                        setTimeout(() => {
                          setScanning(false);
                          setScanned(true);
                        }, 900);
                      }}
                    >
                      {scanning && <LoaderCircle className="profile-scan-spinner" aria-hidden="true" />}
                      {scanning ? "Scanning open sources..." : "Scan for social activity"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="profile-bento-secondary">
            <div className="card profile-connections">
              <div className="card-header">
                <h2>Connections ({connections.length})</h2>
                {corroborated.length > 0 && <span className="badge badge-risk-low">{corroborated.length} corroborated</span>}
              </div>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {uniqueConnections.length === 0 && <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No linked entities.</p>}
                {uniqueConnections.slice(0, 6).map(({ otherId, isCorroborated }) => {
                  const other = findEntity(otherId);
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

            <div className="card profile-alerts">
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

            <div className="card profile-cctv">
              <div className="card-header">
                <h2>Case CCTV sightings ({relatedFootage.length})</h2>
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

          </div>
        </div>
      </div>
    </>
  );
}
