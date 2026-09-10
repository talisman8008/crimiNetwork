import { Link } from "react-router-dom";
import { eventTypeLabel, formatDuration } from "../data/timelineData";
import { getEntityById } from "../data/mockData";
import { formatDate } from "./ui";
import type { TimelineEvent } from "../data/types";

const typeColor: Record<TimelineEvent["type"], string> = {
  call: "#2563eb",
  sighting: "#0d9488",
  transaction: "#d97706",
  "cell-site": "#7c3aed",
  "vehicle-movement": "#e11d48",
  meeting: "#16a34a",
};

interface EventTimelineProps {
  events: TimelineEvent[];
  /** Highlight rows on this date, used when a scrubber is driving the view. */
  activeDate?: string | null;
  emptyMessage?: string;
}

/** Chronological log of timestamped observations, grouped by day and marked with clock times. */
export default function EventTimeline({ events, activeDate, emptyMessage }: EventTimelineProps) {
  if (events.length === 0) {
    return <div className="empty-state">{emptyMessage ?? "No recorded activity."}</div>;
  }

  const byDay = new Map<string, TimelineEvent[]>();
  events.forEach((e) => {
    if (!byDay.has(e.date)) byDay.set(e.date, []);
    byDay.get(e.date)!.push(e);
  });

  return (
    <div className="event-timeline">
      {[...byDay.entries()].map(([day, dayEvents]) => (
        <div key={day} className={`event-day ${activeDate === day ? "active" : ""}`}>
          <div className="event-day-head">{formatDate(day)}</div>
          {dayEvents.map((e) => (
            <div key={e.id} className="event-row">
              <span className="event-time mono">{e.time}</span>
              <span className="event-dot" style={{ background: typeColor[e.type] }} />
              <div className="event-body">
                <div className="event-summary">{e.summary}</div>
                <div className="event-meta">
                  <span className="event-type" style={{ color: typeColor[e.type] }}>
                    {eventTypeLabel[e.type]}
                  </span>
                  {e.durationSec != null && <> &middot; {formatDuration(e.durationSec)}</>}
                  {e.amount != null && <> &middot; &#8377;{e.amount.toLocaleString("en-IN")}</>}
                  {e.locationLabel && <> &middot; {e.locationLabel}</>}
                  {e.sourceRef && <> &middot; <span className="mono">{e.sourceRef}</span></>}
                </div>
                <div className="event-entities">
                  {e.entityIds.map((id) => {
                    const ent = getEntityById(id);
                    if (!ent) return null;
                    return (
                      <Link key={id} to={`/profile/${id}`} className="event-entity-chip">
                        {ent.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
