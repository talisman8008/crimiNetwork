import { useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import EntityDetailPanel from "../components/EntityDetailPanel";
import { entities, getEntityById, relationshipsFor } from "../data/mockData";
import { EntityIcon, entitySubLabel, entityTypeLabel, RiskBadge } from "../components/ui";
import { IconSearch } from "../components/icons";
import type { EntityType, RiskLevel } from "../data/types";

export default function Entities() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<EntityType | "all">("all");
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [caseSort, setCaseSort] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const result = entities.filter((e) => {
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (riskFilter !== "all" && e.riskLevel !== riskFilter) return false;
      if (search && !e.label.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    return result.sort((a, b) => {
      const difference = a.caseIds.length - b.caseIds.length;
      return caseSort === "asc" ? difference : -difference;
    });
  }, [search, typeFilter, riskFilter, caseSort]);

  const selectedEntity = selectedId ? getEntityById(selectedId) : undefined;
  const allSelected = filtered.length > 0 && filtered.every((entity) => selectedIds.includes(entity.id));

  function toggleSelection(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]));
  }

  function toggleAll() {
    setSelectedIds((current) => {
      if (allSelected) return current.filter((id) => !filtered.some((entity) => entity.id === id));
      return [...new Set([...current, ...filtered.map((entity) => entity.id)])];
    });
  }

  function exportSelectedProfile() {
    if (selectedIds.length !== 1) return;
    window.open(`/profile/${selectedIds[0]}?print=1`, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <PageHeader
        eyebrow="Registry"
        title="Entity registry"
      />
      <div className="registry-toolbar">
        <div className="registry-filter-label">Filter by</div>
        <select className="select" aria-label="Filter entities by type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as EntityType | "all")}>
          <option value="all">All types</option>
          <option value="person">Person</option>
          <option value="organization">Organisation</option>
          <option value="location">Location</option>
          <option value="vehicle">Vehicle</option>
          <option value="phone">Phone</option>
        </select>
        <select className="select" aria-label="Filter entities by risk level" value={riskFilter} onChange={(e) => setRiskFilter(e.target.value as RiskLevel | "all")}>
          <option value="all">All risk levels</option>
          <option value="high">High risk</option>
          <option value="medium">Medium risk</option>
          <option value="low">Low risk</option>
        </select>
        <div className="registry-toolbar-search search-input">
          <IconSearch />
          <input aria-label="Search entities by name" placeholder="Search by name..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn registry-export" disabled={selectedIds.length !== 1} onClick={exportSelectedProfile} title={selectedIds.length === 1 ? "Export the selected profile as PDF" : "Select one entity to export its profile"}>
          <span aria-hidden="true">↓</span>
          {selectedIds.length > 1 ? "Select one profile" : "Export PDF"}
        </button>
      </div>

      <div className="registry-body">
        <div className="registry-table-wrap">
          <table className="data-table registry-table">
            <thead>
              <tr>
                <th className="registry-check-cell">
                  <input type="checkbox" aria-label="Select all visible entities" checked={allSelected} onChange={toggleAll} />
                </th>
                <th>Entity</th>
                <th>Type</th>
                <th>Risk</th>
                <th>Connections</th>
                <th aria-sort={caseSort === "asc" ? "ascending" : "descending"}>
                  <button className="registry-sort" onClick={() => setCaseSort((current) => (current === "asc" ? "desc" : "asc"))}>
                    Cases <span aria-hidden="true">{caseSort === "asc" ? "↑" : "↓"}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="clickable" onClick={() => setSelectedId(e.id)}>
                  <td className="registry-check-cell" onClick={(event) => event.stopPropagation()}>
                    <input type="checkbox" aria-label={`Select ${e.label}`} checked={selectedIds.includes(e.id)} onChange={() => toggleSelection(e.id)} />
                  </td>
                  <td>
                    <div className="row-entity">
                      <EntityIcon type={e.type} />
                      <div>
                        <div className="row-entity-name">{e.label}</div>
                        <div className="row-entity-sub">
                          {entityTypeLabel[e.type]} &middot; {entitySubLabel(e)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="registry-type">{entityTypeLabel[e.type]}</td>
                  <td>
                    <RiskBadge level={e.riskLevel} />
                  </td>
                  <td>
                    {(() => {
                      const connectedIds = [...new Set(relationshipsFor(e.id).map((relationship) => relationship.source === e.id ? relationship.target : relationship.source))];
                      const visibleConnections = connectedIds.slice(0, 3).map((id) => getEntityById(id)).filter(Boolean);
                      const remainingConnections = connectedIds.length - visibleConnections.length;
                      return (
                        <div className="connection-avatars" aria-label={`${connectedIds.length} connections`}>
                          {visibleConnections.map((connectedEntity) => connectedEntity && (
                            <span key={connectedEntity.id} className="connection-avatar" title={connectedEntity.label}>
                              <EntityIcon type={connectedEntity.type} />
                            </span>
                          ))}
                          {remainingConnections > 0 && <span className="connection-avatar-more">+{remainingConnections}</span>}
                          {connectedIds.length === 0 && <span className="connection-none">—</span>}
                        </div>
                      );
                    })()}
                  </td>
                  <td>{e.caseIds.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty-state">No entities match the current filters.</div>}
        </div>
        {selectedEntity && (
          <div className="registry-detail">
            <EntityDetailPanel
              entity={selectedEntity}
              onClose={() => setSelectedId(null)}
              onSelectRelated={setSelectedId}
            />
          </div>
        )}
      </div>
    </>
  );
}
