import PageHeader from "../components/PageHeader";
import { dataSources } from "../data/mockData";
import type { DataSource } from "../data/types";

const statusMeta: Record<DataSource["status"], { label: string; color: string }> = {
  connected: { label: "Connected", color: "var(--status-connected)" },
  syncing: { label: "Syncing", color: "var(--status-syncing)" },
  error: { label: "Sync error", color: "var(--status-error)" },
};

export default function DataSources() {
  return (
    <>
      <PageHeader eyebrow="Ingestion" title="Data Sources" />
      <div className="content">
        <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Sources connected</div>
            <div className="stat-value">{dataSources.filter((s) => s.status === "connected").length}/{dataSources.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total records indexed</div>
            <div className="stat-value">{dataSources.reduce((sum, s) => sum + s.recordCount, 0).toLocaleString("en-IN")}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Sources needing attention</div>
            <div className="stat-value" style={{ color: "var(--risk-high)" }}>
              {dataSources.filter((s) => s.status === "error").length}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Connected feeds</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Records</th>
                <th>Last sync</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {dataSources.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="row-entity-name">{s.name}</div>
                    <div className="row-entity-sub">{s.description}</div>
                  </td>
                  <td className="mono">{s.recordCount.toLocaleString("en-IN")}</td>
                  <td className="mono" style={{ color: "var(--text-secondary)" }}>
                    {s.lastSync}
                  </td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                      <span className="status-dot" style={{ background: statusMeta[s.status].color }} />
                      {statusMeta[s.status].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
