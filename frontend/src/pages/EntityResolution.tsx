import { useMemo } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { getCaseById } from "../data/mockData";
import type { MergeDecision } from "../lib/entityResolution";
import { useLocalStorage } from "../lib/useLocalStorage";
import { EntityIcon, formatDate, RiskBadge } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useActiveCase } from "../lib/activeCase";
import { useEntityResolutionQueue } from "../hooks/useCaseData";
import { useCaseGraph } from "../hooks/useCaseData";
import type { Entity } from "../data/types";

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
  const { activeCaseId } = useActiveCase();
  const { queue, loading, error, approve, reject } = useEntityResolutionQueue(activeCaseId);
  const { entities } = useCaseGraph(activeCaseId);
  const [decisions, setDecisions] = useLocalStorage<Record<string, DecisionRecord>>("netra-merge-decisions", {});

  // Resolve entity IDs from the backend pairs to full Entity objects via the loaded graph.
  const byId = useMemo(() => {
    const m = new Map<string, Entity>();
    for (const e of entities) m.set(e.id, e);
    return m;
  }, [entities]);

  const pairs = queue?.pairs ?? [];
  const pending = pairs.filter((p) => !decisions[p.pair_id]);
  const resolved = pairs.filter((p) => decisions[p.pair_id]);

  function decide(pairId: string, decision: MergeDecision) {
    setDecisions((prev) => ({
      ...prev,
      [pairId]: { decision, by: officerId ?? "unknown", at: today() },
    }));
    if (decision === "approved") approve(pairId);
    else reject(pairId);
  }

  function undo(pairId: string) {
    setDecisions((prev) => {
      const next = { ...prev };
      delete next[pairId];
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

        {!activeCaseId && (
          <div className="card">
            <div className="empty-state">Open a case to review its merge queue.</div>
          </div>
        )}

        {activeCaseId && loading && (
          <div className="card">
            <div className="empty-state">Loading merge queue&hellip;</div>
          </div>
        )}

        {activeCaseId && error && (
          <div className="card">
            <div className="empty-state">Could not load the merge queue: {error}</div>
          </div>
        )}

        {activeCaseId && !loading && !error && pending.length === 0 && (
          <div className="card">
            <div className="empty-state">No candidate duplicates awaiting review.</div>
          </div>
        )}

        {pending.map((p) => {
          const primary = byId.get(p.entity_a.id);
          const duplicate = byId.get(p.entity_b.id);
          const pct = Math.round(p.similarity * 100);
          const band = pct >= 80 ? "high" : pct >= 65 ? "medium" : "low";
          return (
            <div className="card" key={p.pair_id} style={{ marginBottom: 16 }}>
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
                      {primary && <EntityIcon type={primary.type} />}
                      <div>
                        <div className="merge-record-name">{primary?.label ?? p.entity_a.name}</div>
                        <div className="merge-record-sub">
                          {(primary?.caseIds ?? []).map((id) => getCaseById(id)?.code).filter(Boolean).join(", ")}
                        </div>
                      </div>
                    </div>
                    <dl className="merge-fields">
                      <dt>Risk</dt>
                      <dd>{primary ? <RiskBadge level={primary.riskLevel} /> : "-"}</dd>
                    </dl>
                  </div>

                  <div className="merge-joiner">=?</div>

                  <div className="merge-record">
                    <div className="merge-record-tag merge-record-tag-dup">Would be merged in</div>
                    <div className="merge-record-head">
                      {duplicate && <EntityIcon type={duplicate.type} />}
                      <div>
                        <div className="merge-record-name">{duplicate?.label ?? p.entity_b.name}</div>
                        <div className="merge-record-sub">
                          {(duplicate?.caseIds ?? []).map((id) => getCaseById(id)?.code).filter(Boolean).join(", ")}
                        </div>
                      </div>
                    </div>
                    <dl className="merge-fields">
                      <dt>Risk</dt>
                      <dd>{duplicate ? <RiskBadge level={duplicate.riskLevel} /> : "-"}</dd>
                    </dl>
                  </div>
                </div>

                <div className="section-title" style={{ marginTop: 18 }}>
                  Why these were matched
                </div>
                <ul className="merge-signals">
                  <li className="supports">
                    <span className="merge-signal-mark">&#10003;</span>
                    <span>
                      <strong>Similarity:</strong> {pct}% match score
                    </span>
                  </li>
                  <li className="supports">
                    <span className="merge-signal-mark">&#10003;</span>
                    <span>
                      <strong>Suggested action:</strong> {p.suggested_action}
                    </span>
                  </li>
                </ul>

                <div className="merge-actions">
                  <button className="btn btn-primary" onClick={() => decide(p.pair_id, "approved")}>
                    Confirm same person
                  </button>
                  <button className="btn" onClick={() => decide(p.pair_id, "rejected")}>
                    Not the same
                  </button>
                  <Link className="btn" to={`/profile/${p.entity_b.id}`}>
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
                {resolved.map((p) => {
                  const d = decisions[p.pair_id];
                  const primary = byId.get(p.entity_a.id);
                  const duplicate = byId.get(p.entity_b.id);
                  return (
                    <tr key={p.pair_id}>
                      <td>
                        {(primary?.label ?? p.entity_a.name)} &harr; {(duplicate?.label ?? p.entity_b.name)}
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
                        <button className="btn" onClick={() => undo(p.pair_id)}>
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
