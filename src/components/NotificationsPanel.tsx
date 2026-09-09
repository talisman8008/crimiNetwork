import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { alerts as allAlerts } from "../data/mockData";
import { upcomingCourtDates } from "../data/courtData";
import { formatDate, SeverityBadge } from "./ui";
import { IconBell, IconScale } from "./icons";
import type { AlertSeverity } from "../data/types";

const severityOrder: Record<AlertSeverity, number> = { high: 0, medium: 1, low: 2 };

/** Bell icon in the top navbar that opens a dropdown of everything worth an officer's attention
 *  right now: active pattern alerts and upcoming court hearings, newest/most severe first. */
export default function NotificationsPanel() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const activeAlerts = allAlerts
    .filter((a) => a.status !== "dismissed")
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || (a.detectedOn < b.detectedOn ? 1 : -1))
    .slice(0, 5);
  const hearings = upcomingCourtDates(5);
  const total = activeAlerts.length + hearings.length;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function go(path: string) {
    navigate(path);
    setOpen(false);
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button className="notif-bell" onClick={() => setOpen((v) => !v)} aria-label="Alerts and upcoming notifications">
        <IconBell />
        {total > 0 && <span className="notif-badge">{total}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <section className="notif-col">
            <div className="notif-col-header">
              <span>Active alerts</span>
              <span className="notif-col-count">{activeAlerts.length}</span>
            </div>
            <div className="notif-col-body">
              {activeAlerts.length === 0 && <div className="notif-empty">No active alerts.</div>}
              {activeAlerts.map((a) => (
                <button key={a.id} className="notif-row" onClick={() => go("/alerts")}>
                  <SeverityBadge severity={a.severity} />
                  <div className="notif-row-body">
                    <div className="notif-row-title">{a.title}</div>
                    <div className="notif-row-sub">
                      {a.patternType} &middot; {formatDate(a.detectedOn)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {activeAlerts.length > 0 && (
              <button className="notif-col-foot" onClick={() => go("/alerts")}>
                View all alerts
              </button>
            )}
          </section>

          <section className="notif-col">
            <div className="notif-col-header">
              <span>Upcoming court dates</span>
              <span className="notif-col-count">{hearings.length}</span>
            </div>
            <div className="notif-col-body">
              {hearings.length === 0 && <div className="notif-empty">No upcoming hearings.</div>}
              {hearings.map((h) => (
                <button key={h.id} className="notif-row" onClick={() => go("/court-dates")}>
                  <IconScale />
                  <div className="notif-row-body">
                    <div className="notif-row-title">{h.hearingType}</div>
                    <div className="notif-row-sub">
                      {h.court} &middot; {formatDate(h.date)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {hearings.length > 0 && (
              <button className="notif-col-foot" onClick={() => go("/court-dates")}>
                View all hearings
              </button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
