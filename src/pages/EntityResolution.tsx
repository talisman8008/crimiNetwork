import { useMemo } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { entities, getCaseById } from "../data/mockData";
import { findMergeCandidates, type MergeDecision } from "../lib/entityResolution";
import { useLocalStorage } from "../lib/useLocalStorage";
import { EntityIcon, formatDate, RiskBadge } from "../components/ui";
import { useAuth } from "../lib/auth";

interface DecisionRecord {
  decision: MergeDecision;
  by: string;
  at: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Human-in-the-loop entity resolution: the system proposes that two records describe the same
 *  person, an investigator confirms or rejects it, and the decision is logged against their ID.
 *  Nothing merges automatically. */
export default function EntityResolution() {
  const { officerId } = useAuth();
  const [decisions, setDecisions] = useLocalStorage<Record<string, DecisionRecord>>("netra-merge-decisions", {});

  const candidates = useMemo(() => findMergeCandidates(entities), []);
  const pending = candidates.filter((c) => !decisions[c.id]);
  const resolved = candidates.filter((c) => decisions[c.id]);

  function decide(id: string, decision: MergeDecision) {
    setDecisions((prev) => ({
      ...prev,
      [id]: { decision, by: officerId ?? "unknown", at: today() },
    }));
  }

  function undo(id: string) {
    setDecisions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="Entity Resolution"
        title="Merge Review Queue"
        right={
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            {pending.length} awaiting review &middot; {resolved.length} resolved
          </span>
        }
      />
      <div className="content" style={{ maxWidth: 900 }}>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20, maxWidth: 620, lineHeight: 1.6 }}>
          Records arriving from CCTNS, telecom subscriber data, and bank KYC filings spell the same person's name
          differently, so one individual can sit in the system several times over. These pairs are proposed as the
          same person. Nothing is merged until you confirm it.
        </p>

        {pending.length === 0 && (
          <div className="card">
            <div className="empty-state">No candidate duplicates awaiting review.</div>
          </div>
        )}

        {pending.map((c) => {
          const pct = Math.round(c.confidence * 100);
          const band = pct >= 80 ? "high" : pct >= 65 ? "medium" : "low";
          return (
            <div className="card" key={c.id} style={{ marginBottom: 16 }}>
              <div className="card-header">
                <h2>Possible duplicate</h2>
                <span className={`badge badge-risk-${band === "high" ? "high" : band === "medium" ? "medium" : "low"}`}>
                  {pct}% confidence
                </span>
              </div>
              <div className="card-body">
                <div className="merge-pair">
                  <div className="merge-record">
                    <div className="merge-record-tag">Keep as primary</div>
                    <div className="merge-record-head">
                      <EntityIcon type={c.primary.type} />
                      <div>
                        <div className="merge-record-name">{c.primary.label}</div>
                        <div className="merge-record-sub">
                          {c.primary.caseIds.map((id) => getCaseById(id)?.code).filter(Boolean).join(", ")}
                        </div>
                      </div>
                    </div>
                    <dl className="merge-fields">
                      {c.primary.dob && (
                        <>
                          <dt>Date of birth</dt>
                          <dd>{formatDate(c.primary.dob)}</dd>
                        </>
                      )}
                      {c.primary.aliases?.length ? (
                        <>
                          <dt>Aliases</dt>
                          <dd>{c.primary.aliases.join(", ")}</dd>
                        </>
                      ) : null}
                      {c.primary.lastKnownLocation && (
                        <>
                          <dt>Location</dt>
                          <dd>{c.primary.lastKnownLocation}</dd>
                        </>
                      )}
                      <dt>Risk</dt>
                      <dd>
                        <RiskBadge level={c.primary.riskLevel} />
                      </dd>
                    </dl>
                    {c.primary.notes && <p className="merge-record-note">{c.primary.notes}</p>}
                  </div>

                  <div className="merge-joiner">=?</div>

                  <div className="merge-record">
                    <div className="merge-record-tag merge-record-tag-dup">Would be merged in</div>
                    <div className="merge-record-head">
                      <EntityIcon type={c.duplicate.type} />
                      <div>
                        <div className="merge-record-name">{c.duplicate.label}</div>
                        <div className="merge-record-sub">
                          {c.duplicate.caseIds.map((id) => getCaseById(id)?.code).filter(Boolean).join(", ")}
                        </div>
                      </div>
                    </div>
                    <dl className="merge-fields">
                      {c.duplicate.dob && (
                        <>
                          <dt>Date of birth</dt>
                          <dd>{formatDate(c.duplicate.dob)}</dd>
                        </>
                      )}
                      {c.duplicate.aliases?.length ? (
                        <>
                          <dt>Aliases</dt>
                          <dd>{c.duplicate.aliases.join(", ")}</dd>
                        </>
                      ) : null}
                      {c.duplicate.lastKnownLocation && (
                        <>
                          <dt>Location</dt>
                          <dd>{c.duplicate.lastKnownLocation}</dd>
                        </>
                      )}
                      <dt>Risk</dt>
                      <dd>
                        <RiskBadge level={c.duplicate.riskLevel} />
                      </dd>
                    </dl>
                    {c.duplicate.notes && <p className="merge-record-note">{c.duplicate.notes}</p>}
                  </div>
                </div>

                <div className="section-title" style={{ marginTop: 18 }}>
                  Why these were matched
                </div>
                <ul className="merge-signals">
                  {c.signals.map((s) => (
                    <li key={s.label} className={s.supports ? "supports" : "conflicts"}>
                      <span className="merge-signal-mark">{s.supports ? "✓" : "✕"}</span>
                      <span>
                        <strong>{s.label}:</strong> {s.detail}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="merge-actions">
                  <button className="btn btn-primary" onClick={() => decide(c.id, "approved")}>
                    Confirm same person
                  </button>
                  <button className="btn" onClick={() => decide(c.id, "rejected")}>
                    Not the same
                  </button>
                  <Link className="btn" to={`/profile/${c.duplicate.id}`}>
                    Inspect record
                  </Link>
                </div>
              </div>
            </div>
          );
        })}

        {resolved.length > 0 && (
          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-header">
              <h2>Decision log</h2>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Records</th>
                  <th>Decision</th>
                  <th>Officer</th>
                  <th>Date</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {resolved.map((c) => {
                  const d = decisions[c.id];
                  return (
                    <tr key={c.id}>
                      <td>
                        {c.primary.label} &harr; {c.duplicate.label}
                      </td>
                      <td>
                        <span className={`badge ${d.decision === "approved" ? "badge-risk-low" : "badge-neutral"}`}>
                          {d.decision === "approved" ? "Merged" : "Rejected"}
                        </span>
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>{d.by}</td>
                      <td className="mono" style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                        {formatDate(d.at)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button className="btn" onClick={() => undo(c.id)}>
                          Undo
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
