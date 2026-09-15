import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import GraphView2D, { typeColor as typeSwatch } from "../components/GraphView2D";
import EntityDetailPanel from "../components/EntityDetailPanel";
import EvidenceBoard from "../components/EvidenceBoard";
import {
  cases,
  entities,
  entitiesForCase,
  getEntityById,
  networkRoleFor,
  relationships,
  relationshipsFor,
} from "../data/mockData";
import { cctvFootage } from "../data/cctvData";
import { EntityIcon, entityTypeLabel, formatDate, RiskBadge } from "../components/ui";
import { IconCamera, IconFolder, IconNetwork, IconPause, IconPlay, IconScale, IconSearch, IconUsers } from "../components/icons";
import { findShortestPath } from "../lib/graphAlgo";
import { useCaseWorkspaces } from "../lib/caseWorkspace";
import { communityColor, detectCommunities } from "../lib/communities";
import { challengeCase, challengeCategoryLabel } from "../lib/challengeCase";
import { useValidations } from "../lib/validations";
import { useActiveCase } from "../lib/activeCase";
import type { EntityType, RelationType, SourceType } from "../data/types";
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

export default function NetworkGraph() {
  const [searchParams] = useSearchParams();
  const { activeCaseId } = useActiveCase();
  const { priorityNudge } = useValidations();
  const [tab, setTab] = useState<"graph" | "board">("graph");
  const [caseId, setCaseId] = useState<string>(searchParams.get("case") ?? activeCaseId ?? "all");
  const [activeTypes, setActiveTypes] = useState<Set<EntityType>>(new Set(allTypes));
  const [relationType, setRelationType] = useState<RelationType | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<SourceType | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("entity"));
  const [pathfinderOpen, setPathfinderOpen] = useState(false);
  const [pathFrom, setPathFrom] = useState("");
  const [pathTo, setPathTo] = useState("");
  const [communitiesOn, setCommunitiesOn] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [timelineOn, setTimelineOn] = useState(false);
  const [timelineStep, setTimelineStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playTimer = useRef<number | null>(null);

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
    return entities.filter((e) => {
      if (caseId !== "all" && !e.caseIds.includes(caseId)) return false;
      if (!activeTypes.has(e.type)) return false;
      if (search && !e.label.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [caseId, activeTypes, search]);

  const filteredIds = useMemo(() => new Set(filteredEntities.map((e) => e.id)), [filteredEntities]);

  const filteredRelationships = useMemo(
    () =>
      relationships.filter((r) => {
        if (!filteredIds.has(r.source) || !filteredIds.has(r.target)) return false;
        if (relationType !== "all" && r.type !== relationType) return false;
        if (sourceFilter !== "all" && r.evidenceSource !== sourceFilter) return false;
        if (dateFrom && r.observedOn < dateFrom) return false;
        if (dateTo && r.observedOn > dateTo) return false;
        return true;
      }),
    [filteredIds, relationType, sourceFilter, dateFrom, dateTo],
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

  const crossCaseInView = useMemo(() => filteredEntities.filter((e) => e.caseIds.length > 1).length, [filteredEntities]);

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

  // Activity per date, with the days where new links spike well above the run rate marked as
  // surges. This is what turns the scrubber from a slider into behavioural-anomaly detection:
  // an officer sees *when* the network suddenly lit up, not just that it grew.
  const timelineActivity = useMemo(() => {
    const counts = timelineDates.map(
      (d) => filteredRelationships.filter((r) => r.observedOn === d).length,
    );
    const max = Math.max(...counts, 1);
    const mean = counts.reduce((a, b) => a + b, 0) / (counts.length || 1);
    const threshold = Math.max(mean * 1.8, mean + 1);
    return timelineDates.map((date, i) => ({
      date,
      count: counts[i],
      height: counts[i] / max,
      surge: counts[i] > 1 && counts[i] >= threshold,
    }));
  }, [timelineDates, filteredRelationships]);

  const currentIsSurge = timelineActivity[Math.min(timelineStep, timelineActivity.length - 1)]?.surge ?? false;
  const surgeCount = useMemo(() => timelineActivity.filter((a) => a.surge).length, [timelineActivity]);

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

  function toggleTimeline() {
    const next = !timelineOn;
    setTimelineOn(next);
    setPlaying(false);
    if (next) setTimelineStep(timelineDates.length - 1);
  }

  const keyPlayers = useMemo(() => {
    const degree = new Map<string, number>();
    filteredRelationships.forEach((r) => {
      degree.set(r.source, (degree.get(r.source) ?? 0) + 1);
      degree.set(r.target, (degree.get(r.target) ?? 0) + 1);
    });
    return [...degree.entries()]
      .map(([id, count]) => ({ entity: getEntityById(id), count, nudge: priorityNudge(id) }))
      .filter((x): x is { entity: NonNullable<typeof x.entity>; count: number; nudge: number } => !!x.entity)
      // An officer's priority override wins over the raw connection count; ties break on count.
      .sort((a, b) => b.nudge - a.nudge || b.count - a.count)
      .slice(0, 6);
  }, [filteredRelationships, priorityNudge]);

  const pathResult = useMemo(() => {
    if (!pathFrom || !pathTo || pathFrom === pathTo) return null;
    return findShortestPath(filteredRelationships, pathFrom, pathTo);
  }, [filteredRelationships, pathFrom, pathTo]);

  const highlightEdgeIds = useMemo(
    () => (pathResult ? new Set(pathResult.relationshipIds) : undefined),
    [pathResult],
  );

  function toggleType(t: EntityType) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function openPathfinder() {
    setPathfinderOpen(true);
    setSelectedId(null);
  }

  const selectedEntity = selectedId ? getEntityById(selectedId) : undefined;
  const panelMode: "entity" | "challenge" | "pathfinder" | "communities" | "legend" = selectedEntity
    ? "entity"
    : challengeOpen
      ? "challenge"
      : pathfinderOpen
        ? "pathfinder"
        : communitiesOn
          ? "communities"
          : "legend";

  const challengeEvents = useMemo(
    () =>
      caseId === "all"
        ? [...eventsForCase("case-1"), ...eventsForCase("case-2")]
        : eventsForCase(caseId),
    [caseId],
  );

  const challengeResult = useMemo(
    () => challengeCase(filteredEntities, filteredRelationships, challengeEvents),
    [filteredEntities, filteredRelationships, challengeEvents],
  );

  const spotlightRole = selectedEntity ? networkRoleFor(selectedEntity.id) : undefined;
  const spotlightConnections = useMemo(() => {
    if (!selectedEntity) return [];
    const otherIds = [
      ...new Set(relationshipsFor(selectedEntity.id).map((r) => (r.source === selectedEntity.id ? r.target : r.source))),
    ];
    return otherIds.map((id) => getEntityById(id)).filter((e): e is NonNullable<typeof e> => !!e);
  }, [selectedEntity]);
  const spotlightFootage = selectedEntity
    ? cctvFootage.find((f) => f.linkedEntityIds.includes(selectedEntity.id))
    : undefined;
  const spotlightLastObserved = useMemo(() => {
    if (!selectedEntity) return null;
    const dates = relationshipsFor(selectedEntity.id)
      .map((r) => r.observedOn)
      .sort();
    return dates.length ? dates[dates.length - 1] : null;
  }, [selectedEntity]);

  return (
    <div className={`network-page ${selectedEntity ? "focus-mode" : ""}`}>
      <PageHeader
        eyebrow="Analysis"
        title="Network Graph"
        right={
          tab === "graph" ? (
            <div className="search-input">
              <IconSearch />
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
          <div className="filter-bar">
            <select className="select" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
              <option value="all">All cases</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}: {c.title}
                </option>
              ))}
            </select>
            <select className="select" value={relationType} onChange={(e) => setRelationType(e.target.value as RelationType | "all")}>
              <option value="all">All relationship types</option>
              {allRelationTypes.map((t) => (
                <option key={t} value={t} style={{ textTransform: "capitalize" }}>
                  {t}
                </option>
              ))}
            </select>
            <select className="select" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as SourceType | "all")}>
              <option value="all">All evidence sources</option>
              {allSources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-tertiary)" }}>
              From
              <input type="date" className="select" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-tertiary)" }}>
              To
              <input type="date" className="select" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>
          </div>
          <div className="filter-bar analysis-tools">
            {allTypes.map((t) => (
              <button key={t} className={`chip-toggle ${activeTypes.has(t) ? "active" : ""}`} onClick={() => toggleType(t)}>
                <span className="swatch" style={{ background: typeSwatch[t] }} />
                {entityTypeLabel[t]}
              </button>
            ))}
            <button className={`btn ${pathfinderOpen ? "btn-primary" : ""}`} onClick={openPathfinder}>
              Path finder
            </button>
            <button
              className={`btn ${communitiesOn ? "btn-primary" : ""}`}
              onClick={() => setCommunitiesOn((v) => !v)}
            >
              Communities
            </button>
            <button className={`btn ${timelineOn ? "btn-primary" : ""}`} onClick={toggleTimeline}>
              Timeline
            </button>
            <button
              className={`btn btn-challenge ${challengeOpen ? "active" : ""}`}
              onClick={() => {
                setChallengeOpen((v) => !v);
                setSelectedId(null);
                setPathfinderOpen(false);
              }}
              title="Argue the case from the other side"
            >
              Challenge this case
            </button>
            <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-tertiary)" }}>
              {filteredEntities.length} entities &middot; {filteredRelationships.length} links
            </div>
          </div>

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
              <div className="graph-stat-stack">
                <div className="graph-stat-card graph-stat-live">
                  <span className="graph-stat-live-dot" />
                  <div>
                    <div className="graph-stat-live-label">Live monitoring</div>
                    <div className="graph-stat-live-sub">Feeds syncing every 6h</div>
                  </div>
                </div>
                <div className="graph-stat-card">
                  <div className="graph-stat-value">{filteredEntities.length}</div>
                  <div className="graph-stat-label">Entities in view</div>
                </div>
                <div className="graph-stat-card">
                  <div className="graph-stat-value">{filteredRelationships.length}</div>
                  <div className="graph-stat-label">Links in view</div>
                </div>
                <div className="graph-stat-card">
                  <div className="graph-stat-value">{crossCaseInView}</div>
                  <div className="graph-stat-label">Cross-case links</div>
                </div>
              </div>
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
                />
              ) : (
                <div className="empty-state">No entities match the current filters.</div>
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
                    <div className="timeline-hist" aria-hidden="true">
                      {timelineActivity.map((a, i) => (
                        <button
                          key={a.date}
                          className={`timeline-bar-tick ${i <= timelineStep ? "past" : "future"} ${a.surge ? "surge" : ""} ${i === timelineStep ? "current" : ""}`}
                          style={{ height: `${20 + a.height * 80}%` }}
                          onClick={() => {
                            setPlaying(false);
                            setTimelineStep(i);
                          }}
                          title={`${formatDate(a.date)} · +${a.count} link${a.count === 1 ? "" : "s"}${a.surge ? " · activity surge" : ""}`}
                        />
                      ))}
                    </div>
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
                      {surgeCount > 0 && (
                        <span className="timeline-surge-legend">
                          <span className="timeline-surge-dot" /> {surgeCount} activity surge{surgeCount === 1 ? "" : "s"}
                        </span>
                      )}
                      <span className="mono">{formatDate(timelineDates[timelineDates.length - 1])}</span>
                    </div>
                  </div>

                  <div className="timeline-readout">
                    <div className="timeline-readout-date mono">{currentDate ? formatDate(currentDate) : ""}</div>
                    <div className={`timeline-readout-sub ${currentIsSurge ? "is-surge" : ""}`}>
                      {currentIsSurge && <span className="timeline-surge-badge">SURGE</span>}
                      {visibleAtStep.length} of {filteredRelationships.length} links
                      {newAtStep > 0 && ` · +${newAtStep} this day`}
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
                  onClose={() => setSelectedId(null)}
                  onSelectRelated={setSelectedId}
                />
              )}

              {panelMode === "challenge" && (
                <div className="card challenge-card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                  <div className="card-header">
                    <h2>Challenge this case</h2>
                    <button className="btn" onClick={() => setChallengeOpen(false)}>
                      Close
                    </button>
                  </div>
                  <div className="card-body" style={{ overflowY: "auto", flex: 1 }}>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14 }}>
                      NETRA argues the other side: it searches the case's own records for the weaknesses a
                      defence would exploit, then scores how well it would hold up.
                    </p>

                    <div className="robustness">
                      <div className="robustness-score">
                        <span className="robustness-value mono">{challengeResult.score}</span>
                        <span className="robustness-max">/ 100</span>
                      </div>
                      <div className="robustness-meta">
                        <div className="robustness-label">Case robustness</div>
                        <div className="robustness-bar">
                          <span
                            style={{
                              width: `${challengeResult.score}%`,
                              background:
                                challengeResult.score >= 75
                                  ? "var(--risk-low)"
                                  : challengeResult.score >= 55
                                    ? "var(--risk-medium)"
                                    : "var(--risk-high)",
                            }}
                          />
                        </div>
                        <div className="robustness-sub">
                          {challengeResult.areasNeedingCorroboration} area
                          {challengeResult.areasNeedingCorroboration === 1 ? "" : "s"} require additional
                          corroboration.
                        </div>
                      </div>
                    </div>

                    {challengeResult.challenges.length === 0 ? (
                      <div className="empty-state">No weaknesses found under the current filters.</div>
                    ) : (
                      <div className="challenge-list">
                        {challengeResult.challenges.map((c, i) => (
                          <div key={i} className={`challenge-item sev-${c.severity}`}>
                            <div className="challenge-item-head">
                              <span className="challenge-cat">{challengeCategoryLabel(c.category)}</span>
                              <span className={`challenge-sev sev-${c.severity}`}>{c.severity}</span>
                            </div>
                            <p className="challenge-finding">{c.finding}</p>
                            {c.entityIds.length > 0 && (
                              <div className="challenge-refs">
                                {c.entityIds.map((id) => {
                                  const ent = getEntityById(id);
                                  if (!ent) return null;
                                  return (
                                    <button key={id} className="challenge-ref" onClick={() => setSelectedId(id)}>
                                      {ent.label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
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
                            const ent = getEntityById(id);
                            if (!ent) return null;
                            const rel =
                              i < pathResult.relationshipIds.length
                                ? relationships.find((r) => r.id === pathResult.relationshipIds[i])
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
                              const ent = getEntityById(id);
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
                    <h2>Key players</h2>
                  </div>
                  <div className="card-body" style={{ overflowY: "auto", flex: 1 }}>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
                      Entities ranked by number of connections under the current filters. A fast read on who
                      holds the network together.
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
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

                    <div className="section-title">Entity types</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                      {allTypes.map((t) => (
                        <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 3, background: typeSwatch[t] }} />
                          {entityTypeLabel[t]}
                        </div>
                      ))}
                    </div>
                    <div className="section-title">Risk ring</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", border: "2.5px solid var(--risk-high)" }} />
                        High risk
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", border: "2.5px solid var(--risk-medium)" }} />
                        Medium risk
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", border: "2.5px solid var(--border-strong)" }} />
                        Low risk
                      </div>
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
                {spotlightFootage ? (
                  <Link to="/cctv" className="cctv-thumb" style={{ display: "block", height: "100%" }}>
                    <span className="cctv-thumb-rec">
                      <span className="dot" /> {spotlightFootage.cameraId}
                    </span>
                    <span className="cctv-thumb-cam">
                      <IconCamera />
                    </span>
                    <span className="cctv-play-btn">
                      <IconPlay />
                    </span>
                    <span className="cctv-thumb-duration">{spotlightFootage.duration}</span>
                  </Link>
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
