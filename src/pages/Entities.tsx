import { useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import EntityDetailPanel from "../components/EntityDetailPanel";
import { entities, getEntityById, relationshipsFor, relationships } from "../data/mockData";
import { EntityIcon, entitySubLabel, entityTypeLabel, RiskBadge } from "../components/ui";
import { IconSearch } from "../components/icons";
import type { EntityType, RiskLevel } from "../data/types";

export default function Entities() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<EntityType | "all">("all");
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return entities.filter((e) => {
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (riskFilter !== "all" && e.riskLevel !== riskFilter) return false;
      if (search && !e.label.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [search, typeFilter, riskFilter]);

  const selectedEntity = selectedId ? getEntityById(selectedId) : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Registry"
        title="Entities"
        right={
          <div className="search-input">
            <IconSearch />
            <input placeholder="Search by name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        }
      />
      <div className="filter-bar">
        <select className="select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as EntityType | "all")}>
          <option value="all">All types</option>
          <option value="person">Person</option>
          <option value="organization">Organisation</option>
          <option value="location">Location</option>
          <option value="vehicle">Vehicle</option>
          <option value="phone">Phone</option>
        </select>
        <select className="select" value={riskFilter} onChange={(e) => setRiskFilter(e.target.value as RiskLevel | "all")}>
          <option value="all">All risk levels</option>
          <option value="high">High risk</option>
          <option value="medium">Medium risk</option>
          <option value="low">Low risk</option>
        </select>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-tertiary)" }}>
          {filtered.length} of {entities.length} entities
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Entity</th>
                <th>Risk</th>
                <th>Connections</th>
                <th>Cases</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="clickable" onClick={() => setSelectedId(e.id)}>
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
                  <td>
                    <RiskBadge level={e.riskLevel} />
                  </td>
                  <td className="mono">{relationshipsFor(e.id).length}</td>
                  <td>{e.caseIds.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty-state">No entities match the current filters.</div>}
        </div>
        {selectedEntity && (
          <div style={{ width: 340, borderLeft: "1px solid var(--border)", padding: 14, flexShrink: 0 }}>
            <EntityDetailPanel
              entity={selectedEntity}
              allEntities={entities}
              allRelationships={relationships}
              onClose={() => setSelectedId(null)}
              onSelectRelated={setSelectedId}
            />
          </div>
        )}
      </div>
    </>
  );
}
