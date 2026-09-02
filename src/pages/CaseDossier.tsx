import { useParams, Link } from "react-router-dom";
import { entitiesForCase, getCaseById, relationshipsForCase } from "../data/mockData";
import { calculateAge, entitySubLabel, entityTypeLabel, formatDate } from "../components/ui";
import { officersForCase } from "../data/officersData";
import { maskLocation, maskPhone, maskPlate, useRedaction } from "../lib/redaction";
import type { Entity } from "../data/types";

/** Identifiers that must not appear on a copy leaving the investigating team. */
function dossierLabel(e: Entity, redacted: boolean): string {
  if (!redacted) return e.label;
  if (e.type === "phone") return maskPhone(e.number);
  if (e.type === "vehicle") return maskPlate(e.plate);
  if (e.type === "location") return maskLocation(e.address);
  return e.label;
}

function dossierDetail(e: Entity, redacted: boolean): string {
  if (redacted && e.type === "person" && e.lastKnownLocation) return maskLocation(e.lastKnownLocation);
  return entitySubLabel(e);
}

export default function CaseDossier() {
  const { caseId } = useParams<{ caseId: string }>();
  const { redacted, setRedacted } = useRedaction();
  const c = caseId ? getCaseById(caseId) : undefined;

  if (!c) {
    return (
      <div style={{ padding: 40 }}>
        <p>Case not found.</p>
        <Link to="/cases">Back to cases</Link>
      </div>
    );
  }

  const caseEntities = entitiesForCase(c.id);
  const caseRelationships = relationshipsForCase(c.id);
  const team = officersForCase(c.id);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 28px 80px", fontFamily: "var(--font-sans)", color: "var(--text-primary)" }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
        <Link to="/cases" className="btn">
          &larr; Back to cases
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className={`dossier-redact-toggle ${redacted ? "on" : ""}`}
            onClick={() => setRedacted(!redacted)}
            title={
              redacted
                ? "Identifiers are masked on this copy"
                : "Identifiers are printed in full on this copy"
            }
          >
            <span className="switch">
              <span className="switch-knob" />
            </span>
            Redacted
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            Print / save as PDF
          </button>
        </div>
      </div>

      {redacted && (
        <div className="dossier-redacted-banner">
          Redacted copy &mdash; personal identifiers masked under the Right to Information Act, 2005 s.8(1)(j)
        </div>
      )}

      <div style={{ borderBottom: "3px solid var(--navy-800)", paddingBottom: 14, marginBottom: 20 }}>
        <div className="eyebrow" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 6 }}>
          Case Brief &middot; Restricted &middot; For Investigative Use Only
        </div>
        <h1 style={{ marginBottom: 8 }}>{c.title}</h1>
        <div className="mono" style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
          {c.code} &middot; Status: {c.status} &middot; Priority: {c.priority}
        </div>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)", marginBottom: 3 }}>
          Sections invoked
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {c.sections.map((s) => (
            <span key={s} className="mono" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {s}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24, fontSize: 13 }}>
        <div>
          <div style={{ color: "var(--text-tertiary)", fontSize: 11, textTransform: "uppercase", marginBottom: 3 }}>Opened</div>
          <div>{formatDate(c.openedOn)}</div>
        </div>
        <div>
          <div style={{ color: "var(--text-tertiary)", fontSize: 11, textTransform: "uppercase", marginBottom: 3 }}>Lead officer</div>
          <div>{c.leadOfficer}</div>
        </div>
        <div>
          <div style={{ color: "var(--text-tertiary)", fontSize: 11, textTransform: "uppercase", marginBottom: 3 }}>Station</div>
          <div>{c.station}</div>
        </div>
        <div>
          <div style={{ color: "var(--text-tertiary)", fontSize: 11, textTransform: "uppercase", marginBottom: 3 }}>Generated</div>
          <div>{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
        </div>
      </div>

      <h2 style={{ marginBottom: 8 }}>Summary</h2>
      <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>{c.summary}</p>

      <h2 style={{ marginBottom: 10 }}>Investigating team ({team.length})</h2>
      <table className="data-table" style={{ marginBottom: 24 }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Rank</th>
            <th>Role on case</th>
            <th>Station</th>
            <th>Contact</th>
          </tr>
        </thead>
        <tbody>
          {team.map((o) => (
            <tr key={o.id}>
              <td>{o.name}</td>
              <td>{o.rank}</td>
              <td>{o.role}</td>
              <td>{o.station}</td>
              <td className="mono">{o.phone}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginBottom: 10 }}>Entities of interest ({caseEntities.length})</h2>
      <table className="data-table" style={{ marginBottom: 24 }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Age / Sex</th>
            <th>Risk</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {caseEntities.map((e) => (
            <tr key={e.id}>
              <td>{dossierLabel(e, redacted)}</td>
              <td>{entityTypeLabel[e.type]}</td>
              <td className="mono">{e.type === "person" && e.dob ? `${calculateAge(e.dob)} / ${e.sex?.charAt(0) ?? "-"}` : "-"}</td>
              <td style={{ textTransform: "capitalize" }}>{e.riskLevel}</td>
              <td>{dossierDetail(e, redacted)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginBottom: 10 }}>Known relationships ({caseRelationships.length})</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>From</th>
            <th>To</th>
            <th>Type</th>
            <th>Source</th>
            <th>Observed</th>
          </tr>
        </thead>
        <tbody>
          {caseRelationships.map((r) => {
            const from = caseEntities.find((e) => e.id === r.source);
            const to = caseEntities.find((e) => e.id === r.target);
            return (
              <tr key={r.id}>
                <td>{from ? dossierLabel(from, redacted) : r.source}</td>
                <td>{to ? dossierLabel(to, redacted) : r.target}</td>
                <td style={{ textTransform: "capitalize" }}>{r.type}</td>
                <td>{r.evidenceSource}</td>
                <td>{formatDate(r.observedOn)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ marginTop: 32, fontSize: 12, color: "var(--text-tertiary)" }}>
        Generated by NETRA &middot; Fragmented evidence. Clear intelligence. For internal investigative use only. Not
        for external distribution.
      </div>
    </div>
  );
}
