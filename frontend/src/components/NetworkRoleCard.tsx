import { networkRoleFor } from "../data/mockData";

interface NetworkRoleCardProps {
  entityId: string;
}

/** "Why does this entity matter" — degree, betweenness, and PageRank centrality turned into a
 *  plain-language explanation, scored and ranked against every other entity across all cases. */
export default function NetworkRoleCard({ entityId }: NetworkRoleCardProps) {
  const role = networkRoleFor(entityId);
  if (!role) return null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 10 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, color: "var(--accent-strong)", lineHeight: 1 }}>
          {role.score}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>/ 100 importance score</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
        {role.reasons.map((reason, i) => (
          <p key={i} style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {reason}
          </p>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
        Ranked out of {role.totalEntities} entities across all cases, by degree, betweenness, and PageRank
        centrality.
      </div>
    </div>
  );
}
