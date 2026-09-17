import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  IconAlertTriangle,
  IconCamera,
  IconDatabase,
  IconFolder,
  IconGrid,
  IconHelp,
  IconLock,
  IconMapPin,
  IconNetwork,
  IconScale,
  IconSearch,
  IconShield,
  IconUsers,
  IconX,
} from "./icons";
import { useAuth } from "../lib/auth";
import { useActiveCase } from "../lib/activeCase";
import { useOnboarding } from "../lib/onboarding";
import { cases as seededCases } from "../data/mockData";
import { useCases } from "../hooks/useCaseData";

type NavItem = { to: string; label: string; icon: typeof IconGrid; end?: boolean; supervisorOnly?: boolean };

/** Tools that only make sense after an investigator opens one case. */
const caseItems: NavItem[] = [
  { to: "/workspace", label: "Case workspace", icon: IconFolder },
  { to: "/network", label: "Network analysis", icon: IconNetwork },
  { to: "/map", label: "Location Map", icon: IconMapPin },
  { to: "/alerts", label: "Alerts", icon: IconAlertTriangle },
  { to: "/resolution", label: "Merge Review", icon: IconUsers },
  { to: "/court-dates", label: "Court dates", icon: IconScale },
];

/** Cross-case tools shown before an investigation has been opened. */
const globalItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: IconGrid, end: true },
  { to: "/cases", label: "Cases", icon: IconFolder },
  { to: "/cctv", label: "CCTV Footage", icon: IconCamera },
  { to: "/entities", label: "Entity Registry", icon: IconSearch },
];

/** Infrastructure, compliance, and supervisor tools. */
const administrationItems: NavItem[] = [
  { to: "/supervisor", label: "Supervisor Console", icon: IconShield, supervisorOnly: true },
  { to: "/sources", label: "Data Sources", icon: IconDatabase },
  { to: "/access-log", label: "Access Log", icon: IconLock },
];

function NavGroup({
  label,
  items,
  role,
}: {
  label: string;
  items: NavItem[];
  role: string;
}) {
  const visible = items.filter((i) => !i.supervisorOnly || role === "supervisor");
  if (visible.length === 0) return null;
  return (
    <div className="sidebar-group">
      <div className="sidebar-group-label">{label}</div>
      {visible.map(({ to, label: linkLabel, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
        >
          <Icon />
          <span>{linkLabel}</span>
        </NavLink>
      ))}
    </div>
  );
}

export default function Sidebar() {
  const { role, logout } = useAuth();
  const { activeCaseId, openCase, closeCase } = useActiveCase();
  const { cases: loadedCases } = useCases();
  const { startTour } = useOnboarding();
  const navigate = useNavigate();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  // Prefer the live registry so recovered Neo4j investigations display their
  // real label; keep the local seed only while the registry is loading.
  const availableCases = loadedCases.length > 0 ? loadedCases : seededCases;
  const activeCase = activeCaseId ? availableCases.find((caseItem) => caseItem.id === activeCaseId) : undefined;
  const otherCases = availableCases.filter((caseItem) => caseItem.id !== activeCaseId);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="/netra-logo.png" alt="" />
        <div>
          <strong>NETRA</strong>
          <span>AI-POWERED CRIMINAL<br/>NETWORK ANALYSIS</span>
          <span style={{ marginTop: '4px', fontSize: '8px', opacity: 0.8 }}>NCRB | MINISTRY OF HOME AFFAIRS</span>
        </div>
      </div>

      <button className="sidebar-search" onClick={() => navigate("/entities")}>
        <IconSearch />
        <span>Search entities</span>
      </button>

      {activeCaseId && (
        <button
          className="sidebar-case-exit"
          onClick={() => {
            closeCase();
            setSwitcherOpen(false);
            navigate("/cases");
          }}
          aria-label="Exit current case"
          title="Exit current case"
        >
          <IconX />
          <span>Exit case</span>
        </button>
      )}

      {activeCase && (
        <div className="sidebar-case">
          <div className="sidebar-case-label">Working on</div>
          <button
            className="sidebar-case-code mono"
            onClick={() => navigate("/workspace")}
            title="Go to workspace"
          >
            {activeCase.code}
          </button>
          <div className="sidebar-case-title">{activeCase.title}</div>
          <div className="sidebar-case-actions">
            <button
              className="sidebar-case-action"
              onClick={() => setSwitcherOpen(!switcherOpen)}
              aria-expanded={switcherOpen}
              aria-label="Switch case"
            >
              ⇄ Switch
            </button>
            <button
              className="sidebar-case-action sidebar-case-action--close"
              onClick={() => {
                closeCase();
                setSwitcherOpen(false);
                navigate("/");
              }}
              aria-label="Close case and return to dashboard"
            >
              Exit case
            </button>
          </div>

          {switcherOpen && otherCases.length > 0 && (
            <div className="sidebar-case-switcher">
              <div className="sidebar-case-switcher-label">Switch to</div>
              {otherCases.map((c) => (
                <button
                  key={c.id}
                  className="sidebar-case-switcher-item"
                  onClick={() => {
                    openCase(c.id);
                    setSwitcherOpen(false);
                    navigate("/workspace");
                  }}
                >
                  <span className="mono sidebar-case-switcher-code">{c.code}</span>
                  <span className="sidebar-case-switcher-title">{c.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <nav className="sidebar-nav" aria-label="Main navigation">
        {activeCaseId ? (
          <>
            <NavGroup label="Open case" items={caseItems} role={role} />
            <NavGroup label="Global views" items={globalItems} role={role} />
          </>
        ) : (
          <NavGroup label="Command Center" items={globalItems} role={role} />
        )}

        {/* ── Administration: infra & compliance ── */}
        <NavGroup label="Administration" items={administrationItems} role={role} />
      </nav>

      <div className="sidebar-foot">
        <button className="sidebar-help" onClick={startTour}>
          <IconHelp />
          <span>Show me around</span>
        </button>
        <div className="sidebar-user">
          <span className="sidebar-avatar">{role === "supervisor" ? "SUP" : "INV"}</span>
          <div className="sidebar-user-text">
            <strong>INS-4471</strong>
            <span>{role}</span>
          </div>
          <button
            className="sidebar-logout"
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </aside>
  );
}

