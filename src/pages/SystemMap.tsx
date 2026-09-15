import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";

/**
 * The capability map: what NETRA does, laid out the way the system was conceived — discover,
 * analyse, act, all answerable through an explainable assistant, all under human control and
 * adversarial challenge, all sitting on a governance base. Leaves that map to a working screen
 * are links; the few that are features rather than pages are plain text.
 */

interface Leaf {
  label: string;
  to?: string;
  note?: string;
}

interface Pillar {
  title: string;
  blurb: string;
  leaves: Leaf[];
}

const pillars: Pillar[] = [
  {
    title: "Discover",
    blurb: "Surface what is hidden in the records",
    leaves: [
      { label: "Hidden links", to: "/network", note: "Path finder" },
      { label: "Cross-case matches", to: "/cases" },
      { label: "Identity resolution", to: "/resolution" },
      { label: "Public OSINT", note: "On the entity profile" },
    ],
  },
  {
    title: "Analyse",
    blurb: "Read the shape of the network",
    leaves: [
      { label: "Network roles", to: "/network" },
      { label: "Network evolution", to: "/network", note: "Timeline" },
      { label: "Behavioural anomalies", to: "/alerts" },
      { label: "Risk scoring", to: "/network" },
    ],
  },
  {
    title: "Act",
    blurb: "Turn analysis into next steps",
    leaves: [
      { label: "Prioritise", to: "/", note: "Where to start" },
      { label: "Alerts", to: "/alerts" },
      { label: "Briefs & dossiers", to: "/cases" },
    ],
  },
];

const controls: Pillar[] = [
  {
    title: "Human control",
    blurb: "The officer overrides the machine",
    leaves: [
      { label: "Identity resolution", to: "/resolution" },
      { label: "Validate links", to: "/validation" },
      { label: "Annotate & correct", to: "/validation" },
      { label: "Override priority", to: "/network" },
    ],
  },
  {
    title: "Adversarial AI",
    blurb: "The system argues the other side",
    leaves: [
      { label: "Challenge the case", to: "/network", note: "Challenge this case" },
      { label: "Find contradictions", to: "/network" },
      { label: "Find gaps", to: "/network" },
      { label: "Alternative suspects", to: "/network" },
    ],
  },
];

const governance: Leaf[] = [
  { label: "Evidence integrity", to: "/cases" },
  { label: "Chain of custody", to: "/access-log" },
  { label: "Access monitoring", to: "/access-log" },
  { label: "Audit trail", to: "/access-log" },
  { label: "Role-based access", note: "At sign-in" },
];

export default function SystemMap() {
  const navigate = useNavigate();

  const Chip = ({ leaf }: { leaf: Leaf }) =>
    leaf.to ? (
      <button className="sysmap-leaf is-link" onClick={() => navigate(leaf.to!)} title={leaf.note}>
        {leaf.label}
        {leaf.note && <span className="sysmap-leaf-note">{leaf.note}</span>}
      </button>
    ) : (
      <span className="sysmap-leaf" title={leaf.note}>
        {leaf.label}
        {leaf.note && <span className="sysmap-leaf-note">{leaf.note}</span>}
      </span>
    );

  return (
    <>
      <PageHeader eyebrow="How NETRA works" title="System capabilities" />
      <div className="content sysmap" style={{ paddingBottom: 64 }}>
        <div className="sysmap-root">NETRA</div>
        <div className="sysmap-stem" />

        <div className="sysmap-tier three">
          {pillars.map((p) => (
            <section key={p.title} className="panel sysmap-card">
              <h2 className="sysmap-card-title">{p.title}</h2>
              <p className="sysmap-card-blurb">{p.blurb}</p>
              <div className="sysmap-leaves">
                {p.leaves.map((l) => (
                  <Chip key={l.label} leaf={l} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="sysmap-stem" />
        <div className="sysmap-band">
          <strong>Ask NETRA</strong>
          <span>Every answer explainable and evidence-backed</span>
        </div>
        <div className="sysmap-stem" />

        <div className="sysmap-tier two">
          {controls.map((p) => (
            <section key={p.title} className="panel sysmap-card">
              <h2 className="sysmap-card-title">{p.title}</h2>
              <p className="sysmap-card-blurb">{p.blurb}</p>
              <div className="sysmap-leaves">
                {p.leaves.map((l) => (
                  <Chip key={l.label} leaf={l} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="sysmap-stem" />
        <section className="panel sysmap-card sysmap-foundation">
          <h2 className="sysmap-card-title">Governance</h2>
          <p className="sysmap-card-blurb">What keeps the intelligence admissible and accountable</p>
          <div className="sysmap-leaves">
            {governance.map((l) => (
              <Chip key={l.label} leaf={l} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
