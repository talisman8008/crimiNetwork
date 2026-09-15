import { useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import { relationships, getEntityById } from "../data/mockData";
import { EntityIcon, formatDate } from "../components/ui";
import { useValidations, type Verdict } from "../lib/validations";

const verdictLabel: Record<Verdict, string> = {
  confirmed: "Confirmed",
  disputed: "Disputed",
  review: "Needs review",
};

const relationLabel: Record<string, string> = {
  associate: "Associate of",
  family: "Family of",
  financial: "Transacted with",
  communication: "In contact with",
  ownership: "Owns",
  frequents: "Frequents",
  employment: "Works with",
};

type Filter = "all" | "unruled" | Verdict;

export default function ValidationQueue() {
  const { linkRuling, setVerdict, setNote, counts } = useValidations();
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(() => {
    return relationships
      .map((r) => ({ r, a: getEntityById(r.source), b: getEntityById(r.target), ruling: linkRuling(r.id) }))
      .filter((x) => x.a && x.b)
      .filter((x) => {
        if (filter === "all") return true;
        if (filter === "unruled") return !x.ruling.verdict;
        return x.ruling.verdict === filter;
      });
  }, [filter, linkRuling]);

  const total = relationships.length;
  const ruled = counts.confirmed + counts.disputed + counts.review;

  return (
    <>
      <PageHeader
        eyebrow="Human in the loop"
        title="Relationship Validation"
        right={
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            {ruled} of {total} links reviewed
          </span>
        }
      />
      <div className="content" style={{ paddingBottom: 64 }}>
        <p className="workspace-intro">
          Every link the system drew is a proposal. Confirm the ones the evidence supports, dispute the
          ones it does not, and flag anything that needs a second look. Your ruling and note stay with the
          link.
        </p>

        <div className="validation-filters">
          {(
            [
              ["all", `All (${total})`],
              ["unruled", `Unreviewed (${total - ruled})`],
              ["confirmed", `Confirmed (${counts.confirmed})`],
              ["disputed", `Disputed (${counts.disputed})`],
              ["review", `Flagged (${counts.review})`],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              className={`chip-toggle ${filter === key ? "active" : ""}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="validation-list">
          {rows.length === 0 && <div className="empty-state">Nothing in this view.</div>}
          {rows.map(({ r, a, b, ruling }) => (
            <div key={r.id} className={`validation-row ${ruling.verdict ? `ruled-${ruling.verdict}` : ""}`}>
              <div className="validation-pair">
                <span className="validation-ent">
                  <EntityIcon type={a!.type} />
                  <span>{a!.label}</span>
                </span>
                <span className="validation-rel">{relationLabel[r.type] ?? r.type}</span>
                <span className="validation-ent">
                  <EntityIcon type={b!.type} />
                  <span>{b!.label}</span>
                </span>
              </div>

              <div className="validation-evidence">
                <span className="validation-source">{r.evidenceSource}</span>
                <span className="validation-date mono">{formatDate(r.observedOn)}</span>
              </div>
              <p className="validation-desc">{r.description}</p>

              <div className="validation-actions">
                {(["confirmed", "disputed", "review"] as Verdict[]).map((v) => (
                  <button
                    key={v}
                    className={`validation-verdict v-${v} ${ruling.verdict === v ? "active" : ""}`}
                    onClick={() => setVerdict(r.id, ruling.verdict === v ? undefined : v)}
                  >
                    {verdictLabel[v]}
                  </button>
                ))}
                <input
                  className="validation-note"
                  value={ruling.note ?? ""}
                  onChange={(e) => setNote(r.id, e.target.value)}
                  placeholder="Annotate this link…"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
