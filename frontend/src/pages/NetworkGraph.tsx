import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import GraphView2D, { typeColor as typeSwatch } from "../components/GraphView2D";
import EntityDetailPanel from "../components/EntityDetailPanel";
import EvidenceBoard from "../components/EvidenceBoard";
import { useCaseGraph } from "../hooks/useCaseData";
import {
  cases,
  entitiesForCase,
  relationshipsForCase,
} from "../data/mockData";
import { cctvFootage } from "../data/cctvData";
import { EntityIcon, entityTypeLabel, formatDate, RiskBadge } from "../components/ui";
import { IconCamera, IconFolder, IconNetwork, IconPause, IconPlay, IconScale, IconUsers } from "../components/icons";
import { Search } from "lucide-react";
import { findShortestPath } from "../lib/graphAlgo";
import { useCaseWorkspaces } from "../lib/caseWorkspace";
import { communityColor, detectCommunities } from "../lib/communities";
import { useActiveCase } from "../lib/activeCase";
import type { Entity, EntityType, RelationType, Relationship, SourceType } from "../data/types";
import { eventsForCase } from "../data/timelineData";
import EventTimeline from "../components/EventTimeline";


const allTypes: EntityType[] = ["person", "organization", "location", "vehicle", "phone"];
const allRelationTypes: RelationType[] = ["associate", "family", "financial", "communication", "ownership", "frequents", "employment"];
const allSources: SourceType[] = [
  "FIR & Police Reports",
  "Call Detail Records",
  "Financial Transactions",
  "Surveillance Reports",
  "Social Media Intelligence",
  "Criminal History Database",
  "Intelligence Agency Reports",
];

const graphTypeLabels: Record<EntityType, string> = {
  person: "People",
  organization: "Organisation",
  location: "Location",
  vehicle: "Vehicle",
  phone: "Phone",
};

export default function NetworkGraph() {
  const [searchParams] = useSearchParams();
  const { activeCaseId } = useActiveCase();
  const [tab, setTab] = useState<"graph" | "board">("graph");
  const [caseId, setCaseId] = useState<string>(searchParams.get("case") ?? activeCaseId ?? "all");
  const [activeTypes, setActiveTypes] = useState<Set<EntityType>>(new Set(allTypes));
  const [relationType, setRelationType] = useState<RelationType | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<SourceType | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showKeyPlayers, setShowKeyPlayers] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("entity"));
  const [pathfinderOpen, setPathfinderOpen] = useState(false);
  const [pathFrom, setPathFrom] = useState("");
  const [pathTo, setPathTo] = useState("");
  const [communitiesOn] = useState(false);
  const [timelineOn, setTimelineOn] = useState(false);
  const [timelineStep, setTimelineStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playTimer = useRef<number | null>(null);
  const { entities: liveEntities, relationships: liveRelationships } = useCaseGraph(
    caseId === "all" ? null : caseId
  );
  const isDemoCase = caseId === "demo-uploaded-case";
  const demoGraphLinks = useMemo<Relationship[]>(() => [
    ...relationshipsForCase("case-1"),
    { id: "demo-rk-rajan", source: "rk", target: "rajan", type: "financial", weight: 4, evidenceSource: "Financial Transactions", observedOn: "2026-03-12", description: "Front company account routed proceeds to the key suspect." },
    { id: "demo-rajan-andheri", source: "rajan", target: "andheri", type: "frequents", weight: 3, evidenceSource: "Surveillance Reports", observedOn: "2026-03-15", description: "Subject sighted near the origin incident location." },
    { id: "demo-rajan-car", source: "rajan", target: "car", type: "ownership", weight: 2, evidenceSource: "FIR & Police Reports", observedOn: "2026-02-04", description: "Vehicle access attributed to the key suspect." },
    { id: "demo-imran-malad", source: "imran", target: "malad", type: "frequents", weight: 4, evidenceSource: "Surveillance Reports", observedOn: "2026-03-13", description: "Field coordinator was observed at Evershine Nagar before the interception." },
    { id: "demo-rajan-phone", source: "rajan", target: "phone-key", type: "communication", weight: 6, evidenceSource: "Call Detail Records", observedOn: "2026-03-16", description: "Encrypted handset used by the key suspect." },
    { id: "demo-phone-imran", source: "phone-key", target: "imran", type: "communication", weight: 5, evidenceSource: "Call Detail Records", observedOn: "2026-03-17", description: "Encrypted handset contacted the field coordinator." },
  ], []);
  const demoPhone: Entity = { id: "phone-key", type: "phone", label: "Encrypted Phone", number: "+91 98••• 4412", riskLevel: "high", caseIds: ["case-1"], tags: ["encrypted device", "CDR link"], notes: "Handset recovered from a vehicle associated with the key suspect." };
  const graphEntities = isDemoCase ? [...entitiesForCase("case-1"), demoPhone] : liveEntities;
  const graphRelationships = isDemoCase ? demoGraphLinks : liveRelationships;
  const { workspaces, save: saveWorkspace } = useCaseWorkspaces();
  const restoredFor = useRef<string | null>(null);

  // Reopening a case puts the board back exactly as it was left: same filters, same subject in
  // focus, same timeline position. A case never worked on starts clean.
  useEffect(() => {
    if (caseId === "all" || restoredFor.current === caseId) return;
    restoredFor.current = caseId;
    const w = workspaces[caseId];
    if (!w) return;
    setTab(w.tab);
    setActiveTypes(new Set(w.activeTypes));
    setRelationType(w.relationType);
    setSourceFilter(w.sourceFilter);
    setDateFrom(w.dateFrom);
    setDateTo(w.dateTo);
    setSearch(w.search);
    setSelectedId(w.selectedEntityId);
    setTimelineOn(w.timelineOn);
    setTimelineStep(w.timelineStep);
    setPlaying(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  // Persist the working context whenever any of it changes, so it survives navigating away.
  useEffect(() => {
    if (caseId === "all" || restoredFor.current !== caseId) return;
    saveWorkspace(caseId, {
      selectedEntityId: selectedId,
      relationType,
      sourceFilter,
      dateFrom,
      dateTo,
      activeTypes: [...activeTypes],
      tab,
      timelineOn,
      timelineStep,
      search,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, selectedId, relationType, sourceFilter, dateFrom, dateTo, activeTypes, tab, timelineOn, timelineStep, search]);

  const filteredEntities = useMemo(() => {
    return graphEntities.filter((e) => {
      if (!activeTypes.has(e.type)) return false;
      if (search && !e.label.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [graphEntities, activeTypes, search]);

  const filteredIds = useMemo(() => new Set(filteredEntities.map((e) => e.id)), [filteredEntities]);
  const entityById = useMemo(() => new Map(graphEntities.map((entity) => [entity.id, entity])), [graphEntities]);

  const filteredRelationships = useMemo(
    () =>
      graphRelationships.filter((r) => {
        if (!filteredIds.has(r.source) || !filteredIds.has(r.target)) return false;
        if (relationType !== "all" && r.type !== relationType) return false;
        if (sourceFilter !== "all" && r.evidenceSource !== sourceFilter) return false;
        if (dateFrom && r.observedOn < dateFrom) return false;
        if (dateTo && r.observedOn > dateTo) return false;
        return true;
      }),
    [graphRelationships, filteredIds, relationType, sourceFilter, dateFrom, dateTo],
  );

  const communityResult = useMemo(
    () => detectCommunities(filteredEntities, filteredRelationships),
    [filteredEntities, filteredRelationships],
  );

  const nodeColorOverride = useMemo(() => {
    if (!communitiesOn) return undefined;
    const map = new Map<string, string>();
    communityResult.assignment.forEach((communityId, entityId) => {
      map.set(entityId, communityColor(communityId));
    });
    return map;
  }, [communitiesOn, communityResult]);

  // Every distinct date on which a relationship was observed, in order. Scrubbing across these
  // replays how the network was actually pieced together from the evidence.
  const timelineDates = useMemo(
    () => [...new Set(filteredRelationships.map((r) => r.observedOn))].sort(),
    [filteredRelationships],
  );

  const currentDate = timelineDates[Math.min(timelineStep, timelineDates.length - 1)] ?? null;

  const hiddenEdgeIds = useMemo(() => {
    if (!timelineOn || !currentDate) return undefined;
    return new Set(filteredRelationships.filter((r) => r.observedOn > currentDate).map((r) => r.id));
  }, [timelineOn, currentDate, filteredRelationships]);

  const visibleAtStep = useMemo(
    () => (currentDate ? filteredRelationships.filter((r) => r.observedOn <= currentDate) : []),
    [filteredRelationships, currentDate],
  );

  const newAtStep = useMemo(
    () => (currentDate ? filteredRelationships.filter((r) => r.observedOn === currentDate).length : 0),
    [filteredRelationships, currentDate],
  );

  const dimmedNodeIds = useMemo(() => {
    if (!timelineOn || !currentDate) return undefined;
    const connected = new Set<string>();
    visibleAtStep.forEach((r) => {
      connected.add(r.source);
      connected.add(r.target);
    });
    return new Set(filteredEntities.filter((e) => !connected.has(e.id)).map((e) => e.id));
  }, [timelineOn, currentDate, visibleAtStep, filteredEntities]);

  // advance the scrubber while playing, stopping at the final date
  useEffect(() => {
    if (!playing) return;
    if (timelineStep >= timelineDates.length - 1) {
      setPlaying(false);
      return;
    }
    playTimer.current = window.setTimeout(() => setTimelineStep((s) => s + 1), 900);
    return () => {
      if (playTimer.current) window.clearTimeout(playTimer.current);
    };
  }, [playing, timelineStep, timelineDates.length]);

  const keyPlayers = useMemo(() => {
    const degree = new Map<string, number>();
    filteredRelationships.forEach((r) => {
      degree.set(r.source, (degree.get(r.source) ?? 0) + 1);
      degree.set(r.target, (degree.get(r.target) ?? 0) + 1);
    });
    return [...degree.entries()]
      .map(([id, count]) => ({ entity: entityById.get(id), count }))
      .filter((x): x is { entity: NonNullable<typeof x.entity>; count: number } => !!x.entity)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [filteredRelationships, entityById]);

  function toggleType(type: EntityType) {
    setActiveTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  const highlightedKeyPlayerIds = useMemo(
    () => (showKeyPlayers ? new Set(keyPlayers.map(({ entity }) => entity.id)) : undefined),
    [showKeyPlayers, keyPlayers],
  );

  const pathResult = useMemo(() => {
    if (!pathFrom || !pathTo || pathFrom === pathTo) return null;
    return findShortestPath(filteredRelationships, pathFrom, pathTo);
  }, [filteredRelationships, pathFrom, pathTo]);

  const highlightEdgeIds = useMemo(
    () => (pathResult ? new Set(pathResult.relationshipIds) : undefined),
    [pathResult],
  );

  const selectedEntity = selectedId ? entityById.get(selectedId) : undefined;
  const panelMode: "entity" | "pathfinder" | "communities" | "legend" = selectedEntity
    ? "entity"
    : pathfinderOpen
      ? "pathfinder"
      : communitiesOn
        ? "communities"
        : "legend";

  const spotlightConnections = useMemo(() => {
    if (!selectedEntity) return [];
    const otherIds = [
      ...new Set(graphRelationships.filter((r) => r.source === selectedEntity.id || r.target === selectedEntity.id)
        .map((r) => (r.source === selectedEntity.id ? r.target : r.source))),
    ];
    return otherIds.map((id) => entityById.get(id)).filter((e): e is NonNullable<typeof e> => !!e);
  }, [selectedEntity, graphRelationships, entityById]);
  const spotlightRole = useMemo(() => {
    if (!selectedEntity) return undefined;
    const score = Math.min(100, spotlightConnections.length * 12);
    return {
      score,
      reasons: spotlightConnections.length
        ? [`Directly connected to ${spotlightConnections.length} ${spotlightConnections.length === 1 ? "entity" : "entities"} in this investigation.`]
        : ["Not yet linked to any other entity in the network."],
    };
  }, [selectedEntity, spotlightConnections]);
  const spotlightFootage = useMemo(() => {
    if (!selectedEntity) return [];
    const linked = cctvFootage.filter((footage) => footage.linkedEntityIds.includes(selectedEntity.id));
    if (linked.length) return linked;

    // The demo graph uses its own curated entity ids, separate from the historical CCTV fixture.
    // Keep the prototype informative for every selected entity without pretending it came from live video.
    const linkedLocation = spotlightConnections[0];
    const location = selectedEntity.type === "location"
      ? selectedEntity.address
      : selectedEntity.type === "person"
        ? selectedEntity.lastKnownLocation
        : linkedLocation?.type === "person"
          ? linkedLocation.lastKnownLocation
          : linkedLocation?.type === "location"
            ? linkedLocation.address
            : "Mumbai investigation area";
    const tag = selectedEntity.label.replace(/[^A-Za-z0-9]/g, "").slice(0, 7).toUpperCase() || "NODE";
    return [
      {
        id: `demo-cctv-${selectedEntity.id}-1`,
        cameraId: `CAM-${tag}-021`,
        title: `${selectedEntity.label} — route observation`,
        duration: "03:12",
        recordedOn: "2026-03-16 18:42",
        locationLabel: location ?? "Mumbai investigation area",
      },
      {
        id: `demo-cctv-${selectedEntity.id}-2`,
        cameraId: `CAM-${tag}-044`,
        title: `${selectedEntity.label} — linked activity`,
        duration: "01:48",
        recordedOn: "2026-03-17 09:15",
        locationLabel: location ?? "Mumbai investigation area",
      },
    ];
  }, [selectedEntity, spotlightConnections]);
  const spotlightLastObserved = useMemo(() => {
    if (!selectedEntity) return null;
    const dates = graphRelationships.filter((r) => r.source === selectedEntity.id || r.target === selectedEntity.id)
      .map((r) => r.observedOn)
      .sort();
    return dates.length ? dates[dates.length - 1] : null;
  }, [selectedEntity, graphRelationships]);

  return (
    <div className={`network-page ${selectedEntity ? "focus-mode" : ""}`}>
      <PageHeader
        title="Network Graph"
        right={
          tab === "graph" ? (
            <div className="search-input">
                  <Search aria-hidden="true" />
              <input placeholder="Search entities..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          ) : undefined
        }
      />
      <div className="tab-strip">
        <button className={tab === "graph" ? "active" : ""} onClick={() => setTab("graph")}>
          Graph View
        </button>
        <button className={tab === "board" ? "active" : ""} onClick={() => setTab("board")}>
          Evidence Board
        </button>
      </div>

      {tab === "graph" ? (
        <>
          {selectedEntity && (
            <div className="focus-exit">
              <div className="focus-exit-label">
                <EntityIcon type={selectedEntity.type} />
                <span className="focus-exit-name">{selectedEntity.label}</span>
                <span>&middot; {entityTypeLabel[selectedEntity.type]}</span>
              </div>
              <button className="btn" onClick={() => setSelectedId(null)}>
                Back to full network
              </button>
            </div>
          )}

          <div className={`tab-fade-in graph-stage ${selectedEntity ? "focused" : ""}`}>
            <div className="graph-canvas-pane">
              {filteredEntities.length > 0 ? (
                <GraphView2D
                  entities={filteredEntities}
                  relationships={filteredRelationships}
                  selectedId={selectedId}
                  onSelect={(id) => {
                    setSelectedId(id);
                    if (id) setPathfinderOpen(false);
                  }}
                  highlightEdgeIds={highlightEdgeIds}
                  hiddenEdgeIds={hiddenEdgeIds}
                  dimmedNodeIds={dimmedNodeIds}
                  nodeColorOverride={nodeColorOverride}
                  highlightNodeIds={highlightedKeyPlayerIds}
                />
              ) : (
                <div className="empty-state">No entities match the current filters.</div>
              )}

              {!selectedEntity && (
                <aside className="graph-legend" aria-label="Graph legend">
                  <div className="graph-legend-column">
                    <div className="graph-legend-title">Entity types</div>
                    {allTypes.map((type) => (
                      <div key={type} className="graph-legend-row">
                        <span className="graph-legend-type-swatch" style={{ background: typeSwatch[type] }} />
                        <span>{entityTypeLabel[type]}</span>
                      </div>
                    ))}
                  </div>
                  <div className="graph-legend-column">
                    <div className="graph-legend-title">Risk ring</div>
                    <div className="graph-legend-row">
                      <span className="graph-legend-risk-ring graph-legend-risk-high" />
                      <span>High risk</span>
                    </div>
                    <div className="graph-legend-row">
                      <span className="graph-legend-risk-ring graph-legend-risk-medium" />
                      <span>Medium risk</span>
                    </div>
                    <div className="graph-legend-row">
                      <span className="graph-legend-risk-ring graph-legend-risk-low" />
                      <span>Low risk</span>
                    </div>
                  </div>
                </aside>
              )}

              {timelineOn && timelineDates.length > 0 && (
                <div className="timeline-bar">
                  <button
                    className="timeline-play"
                    onClick={() => {
                      if (timelineStep >= timelineDates.length - 1) setTimelineStep(0);
                      setPlaying((p) => !p);
                    }}
                    aria-label={playing ? "Pause timeline" : "Play timeline"}
                  >
                    {playing ? <IconPause /> : <IconPlay />}
                  </button>

                  <div className="timeline-track">
                    <input
                      type="range"
                      min={0}
                      max={timelineDates.length - 1}
                      value={Math.min(timelineStep, timelineDates.length - 1)}
                      onChange={(e) => {
                        setPlaying(false);
                        setTimelineStep(Number(e.target.value));
                      }}
                      aria-label="Scrub network timeline"
                    />
                    <div className="timeline-ends">
                      <span className="mono">{formatDate(timelineDates[0])}</span>
                      <span className="mono">{formatDate(timelineDates[timelineDates.length - 1])}</span>
                    </div>
                  </div>

                  <div className="timeline-readout">
                    <div className="timeline-readout-date mono">{currentDate ? formatDate(currentDate) : ""}</div>
                    <div className="timeline-readout-sub">
                      {visibleAtStep.length} of {filteredRelationships.length} links
                      {newAtStep > 0 && ` · +${newAtStep} today`}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="graph-side-pane">
              {/* Activity feed when timeline is on */}
              {timelineOn && !selectedEntity && !pathfinderOpen && (() => {
                const caseEvents = caseId === "all"
                  ? [...eventsForCase("case-1"), ...eventsForCase("case-2")].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
                  : eventsForCase(caseId);
                const visibleEvents = currentDate
                  ? caseEvents.filter((e) => e.date <= currentDate)
                  : caseEvents;
                return (
                  <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                    <div className="card-header">
                      <h2>Activity log</h2>
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }} className="mono">
                        {visibleEvents.length} events
                      </span>
                    </div>
                    <div className="card-body" style={{ overflowY: "auto", flex: 1 }}>
                      <EventTimeline
                        events={visibleEvents}
                        activeDate={currentDate}
                        emptyMessage="No observations recorded up to this date."
                      />
                    </div>
                  </div>
                );
              })()}

              {panelMode === "entity" && selectedEntity && (
                <EntityDetailPanel
                  entity={selectedEntity}
                  relationships={graphRelationships}
                  entityById={entityById}
                  onClose={() => setSelectedId(null)}
                  onSelectRelated={setSelectedId}
                />
              )}

              {panelMode === "pathfinder" && (
                <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                  <div className="card-header">
                    <h2>Path finder</h2>
                    <button className="btn" onClick={() => setPathfinderOpen(false)}>
                      Close
                    </button>
                  </div>
                  <div className="card-body" style={{ overflowY: "auto", flex: 1 }}>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
                      Find the shortest chain of connections between two entities, using only links visible under the
                      current filters.
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                      <select className="select" value={pathFrom} onChange={(e) => setPathFrom(e.target.value)}>
                        <option value="">From entity...</option>
                        {filteredEntities.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.label}
                          </option>
                        ))}
                      </select>
                      <select className="select" value={pathTo} onChange={(e) => setPathTo(e.target.value)}>
                        <option value="">To entity...</option>
                        {filteredEntities.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {pathFrom && pathTo && pathFrom === pathTo && (
                      <div className="empty-state">Choose two different entities.</div>
                    )}
                    {pathFrom && pathTo && pathFrom !== pathTo && !pathResult && (
                      <div className="empty-state">No connecting path found within the current filters.</div>
                    )}
                    {pathResult && (
                      <>
                        <div className="section-title">
                          {pathResult.entityIds.length - 1} hop{pathResult.entityIds.length - 1 === 1 ? "" : "s"}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {pathResult.entityIds.map((id, i) => {
                            const ent = entityById.get(id);
                            if (!ent) return null;
                            const rel =
                              i < pathResult.relationshipIds.length
                                ? filteredRelationships.find((r) => r.id === pathResult.relationshipIds[i])
                                : null;
                            return (
                              <div key={id}>
                                <button
                                  onClick={() => {
                                    setSelectedId(id);
                                    setPathfinderOpen(false);
                                  }}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "8px 9px",
                                    border: "1px solid var(--border)",
                                    borderRadius: "var(--radius-sm)",
                                    background: "var(--surface-sunken)",
                                    cursor: "pointer",
                                    width: "100%",
                                    textAlign: "left",
                                  }}
                                >
                                  <EntityIcon type={ent.type} />
                                  <span style={{ fontSize: 13, fontWeight: 500 }}>{ent.label}</span>
                                </button>
                                {rel && (
                                  <div
                                    style={{
                                      fontSize: 12,
                                      color: "var(--text-tertiary)",
                                      textTransform: "capitalize",
                                      padding: "4px 0 4px 14px",
                                      borderLeft: "2px solid var(--border-strong)",
                                      marginLeft: 13,
                                    }}
                                  >
                                    &darr; {rel.type}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {panelMode === "communities" && (
                <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                  <div className="card-header">
                    <h2>Detected communities</h2>
                    <span className="badge badge-neutral">
                      Q = {communityResult.modularity.toFixed(2)}
                    </span>
                  </div>
                  <div className="card-body" style={{ overflowY: "auto", flex: 1 }}>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
                      Sub-groups that talk mostly among themselves, found by greedy modularity
                      optimisation. Modularity above 0.30 means the split is meaningful rather than
                      an artefact of a sparse graph.
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {communityResult.communities.length === 0 && (
                        <div className="empty-state">No clusters in this view.</div>
                      )}
                      {communityResult.communities.map((c) => (
                        <div key={c.id} className="community-row">
                          <div className="community-row-head">
                            <span
                              className="community-swatch"
                              style={{ background: communityColor(c.id) }}
                            />
                            <span className="community-label">{c.label}</span>
                            <span className="community-size mono">{c.entityIds.length}</span>
                          </div>
                          <div className="community-members">
                            {c.entityIds.map((id) => {
                              const ent = entityById.get(id);
                              if (!ent) return null;
                              return (
                                <button
                                  key={id}
                                  className="community-chip"
                                  onClick={() => setSelectedId(id)}
                                >
                                  {ent.label}
                                </button>
                              );
                            })}
                          </div>
                          <div className="community-stats">
                            {c.internalLinks} internal link{c.internalLinks === 1 ? "" : "s"}
                            {c.externalLinks > 0 && ` · ${c.externalLinks} reaching outside`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {panelMode === "legend" && (
                <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                  <div className="card-header">
                    <h2>Network controls</h2>
                  </div>
                  <div className="graph-control-panel">
                    <section className="graph-control-section">
                      <div className="graph-control-label">Entity labels</div>
                      <div className="graph-type-labels">
                        {allTypes.map((type) => (
                          <button
                            key={type}
                            type="button"
                            className={`graph-type-label ${activeTypes.has(type) ? "is-active" : ""}`}
                            aria-pressed={activeTypes.has(type)}
                            onClick={() => toggleType(type)}
                          >
                            <span className="graph-legend-type-swatch" style={{ background: typeSwatch[type] }} />
                            {graphTypeLabels[type]}
                            <span className="graph-type-label-close" aria-hidden="true">×</span>
                          </button>
                        ))}
                      </div>

                      <div className="graph-control-label graph-control-spaced-label">Connection filters</div>
                      <div className="graph-control-fields">
                        <label>
                          <span>Relationship type</span>
                          <select className="select" value={relationType} onChange={(e) => setRelationType(e.target.value as RelationType | "all")}>
                            <option value="all">All relationship types</option>
                            {allRelationTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                          </select>
                        </label>
                        <label>
                          <span>Evidence source</span>
                          <select className="select" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as SourceType | "all")}>
                            <option value="all">All evidence sources</option>
                            {allSources.map((source) => <option key={source} value={source}>{source}</option>)}
                          </select>
                        </label>
                      </div>
                    </section>

                    <section className="graph-control-section">
                      <label className="graph-key-player-toggle">
                        <input type="checkbox" checked={showKeyPlayers} onChange={(event) => setShowKeyPlayers(event.target.checked)} />
                        <span>
                          <strong>Show key players</strong>
                          <small>Highlight the most connected entities in this view.</small>
                        </span>
                      </label>
                    </section>

                    <section className="graph-control-section">
                      <div className="graph-control-label">Observed date</div>
                      <div className="graph-date-fields">
                        <label>
                          <span>From</span>
                          <input className="input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                        </label>
                        <label>
                          <span>To</span>
                          <input className="input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                        </label>
                      </div>
                    </section>
                    <div hidden>
                      {keyPlayers.length === 0 && <div className="empty-state">No connections in this view.</div>}
                      {keyPlayers.map(({ entity, count }, i) => (
                        <button
                          key={entity.id}
                          onClick={() => setSelectedId(entity.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 9px",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-sm)",
                            background: "var(--surface-sunken)",
                            cursor: "pointer",
                            width: "100%",
                            textAlign: "left",
                          }}
                        >
                          <span className="mono" style={{ fontSize: 12, color: "var(--text-tertiary)", width: 14 }}>
                            {i + 1}
                          </span>
                          <EntityIcon type={entity.type} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{entity.label}</div>
                            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{count} connections</div>
                          </div>
                          <RiskBadge level={entity.riskLevel} />
                        </button>
                      ))}
                    </div>

                  </div>
                </div>
              )}
            </div>
          </div>

          {selectedEntity && (
            <div className="entity-spotlight">
              <div className="entity-spotlight-card">
                <div className="entity-spotlight-header">
                  <div>
                    <div className="entity-spotlight-title">{selectedEntity.label}</div>
                    <div className="entity-spotlight-sub">
                      {entityTypeLabel[selectedEntity.type]} &middot;{" "}
                      {selectedEntity.caseIds.map((cid) => cases.find((c) => c.id === cid)?.code).filter(Boolean).join(", ") ||
                        "No case on file"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <RiskBadge level={selectedEntity.riskLevel} />
                    {spotlightLastObserved && (
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 5 }}>
                        Last observed {formatDate(spotlightLastObserved)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="entity-spotlight-cells">
                  <div className="entity-spotlight-cell">
                    <span className="entity-spotlight-cell-icon">
                      <IconUsers />
                    </span>
                    <div className="entity-spotlight-cell-label">Connections</div>
                    <div className="entity-spotlight-cell-value">{spotlightConnections.length}</div>
                  </div>
                  <div className="entity-spotlight-cell">
                    <span className="entity-spotlight-cell-icon">
                      <IconFolder />
                    </span>
                    <div className="entity-spotlight-cell-label">Cases</div>
                    <div className="entity-spotlight-cell-value">{selectedEntity.caseIds.length}</div>
                  </div>
                  <div className="entity-spotlight-cell">
                    <span className="entity-spotlight-cell-icon">
                      <IconScale />
                    </span>
                    <div className="entity-spotlight-cell-label">Importance</div>
                    <div className="entity-spotlight-cell-value">{spotlightRole?.score ?? 0}</div>
                  </div>
                </div>
              </div>

              <div className="entity-spotlight-media">
                {spotlightFootage.length ? (
                  <div className="entity-spotlight-footage-stack" aria-label="Linked CCTV footage">
                    <div className="entity-spotlight-footage-heading">Linked CCTV footage</div>
                    {spotlightFootage.slice(0, 3).map((footage) => (
                      <Link key={footage.id} to="/cctv" className="entity-spotlight-footage-item">
                        <span className="entity-spotlight-footage-icon"><IconCamera /></span>
                        <span className="entity-spotlight-footage-copy">
                          <span className="entity-spotlight-footage-title">{footage.title}</span>
                          <span className="entity-spotlight-footage-meta">{footage.cameraId} · {formatDate(footage.recordedOn)}</span>
                        </span>
                        <span className="entity-spotlight-footage-duration"><IconPlay /> {footage.duration}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="entity-spotlight-media-empty">
                    <IconCamera />
                    <span>No linked footage</span>
                  </div>
                )}
              </div>

              <div className="entity-spotlight-card">
                <div className="entity-spotlight-header">
                  <div>
                    <div className="entity-spotlight-title">Network role</div>
                    <div className="entity-spotlight-sub">
                      {spotlightRole?.reasons[0] ?? "Not yet linked to any other entity in the network."}
                    </div>
                  </div>
                </div>
                <div className="entity-spotlight-role-body">
                  <div className="entity-spotlight-avatars">
                    {spotlightConnections.slice(0, 4).map((c) => (
                      <span key={c.id} className="entity-spotlight-avatar">
                        <EntityIcon type={c.type} />
                      </span>
                    ))}
                    {spotlightConnections.length > 4 && (
                      <span className="entity-spotlight-avatar entity-spotlight-avatar-more">
                        +{spotlightConnections.length - 4}
                      </span>
                    )}
                    {spotlightConnections.length === 0 && (
                      <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No connections yet</span>
                    )}
                  </div>
                  <div
                    className="entity-spotlight-donut"
                    style={{
                      background: `conic-gradient(var(--accent) ${(spotlightRole?.score ?? 0) * 3.6}deg, var(--surface-sunken) 0deg)`,
                    }}
                  >
                    <span className="entity-spotlight-donut-value">{spotlightRole?.score ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="filter-bar">
            <select className="select" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
              <option value="all">Select a case...</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}: {c.title}
                </option>
              ))}
            </select>
            {caseId !== "all" && (
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                Board is saved locally per case and persists between visits.
              </span>
            )}
          </div>
          {caseId === "all" ? (
            <div className="board-empty-case tab-fade-in">
              <span className="board-empty-icon">
                <IconNetwork />
              </span>
              <div className="board-empty-heading">No evidence board open</div>
              <p className="board-empty-sub">
                Pick a case to start pinning subjects, photos, and clippings, then connect them with coloured
                strings.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                {cases.map((c) => (
                  <button key={c.id} className="btn btn-primary board-empty-cta" onClick={() => setCaseId(c.id)}>
                    {c.code}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <EvidenceBoard key={caseId} caseId={caseId} entities={entitiesForCase(caseId)} />
          )}
        </>
      )}
    </div>
  );
}
