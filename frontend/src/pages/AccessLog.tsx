import { useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../lib/auth";
import type { AccessStatus } from "../data/types";

export default function AccessLog() {
  const { accessLog } = useAuth();
  const [statusFilter, setStatusFilter] = useState<AccessStatus | "all">("all");
  const [officerFilter, setOfficerFilter] = useState("all");

  const officers = useMemo(() => [...new Set(accessLog.map((a) => a.officerId))].sort(), [accessLog]);

  const filtered = useMemo(
    () =>
      accessLog
        .filter((a) => (statusFilter === "all" ? true : a.status === statusFilter))
        .filter((a) => (officerFilter === "all" ? true : a.officerId === officerFilter)),
    [accessLog, statusFilter, officerFilter],
  );

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const loginsToday = accessLog.filter((a) => a.action === "login" && a.status === "success" && a.at.startsWith(today)).length;
    const failedAttempts = accessLog.filter((a) => a.status === "failed").length;
    const uniqueIps = new Set(accessLog.map((a) => a.ipAddress)).size;
    const uniqueOfficers = new Set(accessLog.filter((a) => a.status === "success").map((a) => a.officerId)).size;
    return { loginsToday, failedAttempts, uniqueIps, uniqueOfficers };
  }, [accessLog]);

  return (
    <>
      <PageHeader eyebrow="Security" title="Access Log" />
      <div className="content">
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Successful logins today</div>
            <div className="stat-value">{stats.loginsToday}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Failed attempts</div>
            <div className="stat-value" style={{ color: stats.failedAttempts > 0 ? "var(--risk-high)" : undefined }}>
              {stats.failedAttempts}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Unique IP addresses</div>
            <div className="stat-value">{stats.uniqueIps}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Officers with access</div>
            <div className="stat-value">{stats.uniqueOfficers}</div>
          </div>
        </div>

        <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 16 }}>
          Logs are retained for 180 days in line with CERT-In cybersecurity directions (2022) on mandatory log
          preservation.
        </p>

        <div className="card">
          <div className="card-header">
            <h2>Login &amp; access history</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <select className="select" value={officerFilter} onChange={(e) => setOfficerFilter(e.target.value)}>
                <option value="all">All officers</option>
                {officers.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AccessStatus | "all")}>
                <option value="all">All statuses</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Officer</th>
                <th>Action</th>
                <th>IP address</th>
                <th>Location</th>
                <th>Device</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td className="mono" style={{ color: "var(--text-secondary)" }}>
                    {a.at}
                  </td>
                  <td style={{ fontWeight: 500 }}>{a.officerId}</td>
                  <td style={{ textTransform: "capitalize" }}>{a.action}</td>
                  <td className="mono">{a.ipAddress}</td>
                  <td>{a.location}</td>
                  <td>{a.device}</td>
                  <td>
                    <span className={`badge ${a.status === "success" ? "badge-risk-low" : "badge-risk-high"}`}>
                      {a.status === "success" ? "Success" : "Failed"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty-state">No access events match the current filters.</div>}
        </div>
      </div>
    </>
  );
}
