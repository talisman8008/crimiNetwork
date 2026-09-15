import { NavLink, useNavigate } from "react-router-dom";
import {
  IconCamera,
  IconDatabase,
  IconFolder,
  IconGrid,
  IconHome,
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
import { getCaseById } from "../data/mockData";

/** Every destination in one rail. Thirteen flat items would be a wall, so they are grouped by
 *  the question an officer is asking: where am I working, whose case is it, what is the evidence,
 *  and who touched the system. */
const groups: {
  label: string;
  items: { to: string; label: string; icon: typeof IconGrid; end?: boolean; supervisorOnly?: boolean }[];
}[] = [
  {
    label: "Analysis",
    items: [
      { to: "/", label: "Home", icon: IconHome, end: true },
      { to: "/workspace", label: "Workspace", icon: IconFolder },
      { to: "/network", label: "Network", icon: IconNetwork },
      { to: "/dashboard", label: "Dashboard", icon: IconGrid },
      { to: "/entities", label: "Database", icon: IconDatabase },
    ],
  },
  {
    label: "Casework",
    items: [
      { to: "/cases", label: "Cases", icon: IconFolder },
      { to: "/court-dates", label: "Court Dates", icon: IconScale },
    ],
  },
  {
    label: "Evidence",
    items: [
      { to: "/map", label: "Location Map", icon: IconMapPin },
      { to: "/cctv", label: "CCTV Footage", icon: IconCamera },
      { to: "/sources", label: "Data Sources", icon: IconDatabase },
    ],
  },
  {
    // Human-in-the-loop: everywhere an officer's judgement overrides the machine. Identity
    // Resolution is where merges are approved; the Supervisor Console is where cases are
    // assigned and reviewed; the Access Log is the accountability trail.
    // (Alerts is deliberately absent — it lives on the notification bell where its count sits.)
    label: "Oversight",
    items: [
      { to: "/resolution", label: "Identity Resolution", icon: IconUsers },
      { to: "/supervisor", label: "Supervisor Console", icon: IconShield, supervisorOnly: true },
      { to: "/access-log", label: "Access Log", icon: IconLock },
    ],
  },
];

export default function Sidebar() {
  const { role, logout } = useAuth();
  const { activeCaseId, closeCase } = useActiveCase();
  const { startTour } = useOnboarding();
  const navigate = useNavigate();

  const activeCase = activeCaseId ? getCaseById(activeCaseId) : undefined;

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

      <button className="sidebar-search" onClick={() => window.dispatchEvent(new Event("netra:open-search"))}>
        <IconSearch />
        <span>Search entities</span>
      </button>

      {activeCase && (
        <div className="sidebar-case">
          <div className="sidebar-case-label">Working on</div>
          <div className="sidebar-case-code mono">{activeCase.code}</div>
          <button
            className="sidebar-case-close"
            onClick={() => {
              closeCase();
              navigate("/");
            }}
            aria-label="Close case and return to caseload"
          >
            <IconX />
          </button>
        </div>
      )}

      <nav className="sidebar-nav" aria-label="Main navigation">
        {groups.map((group) => {
          const items = group.items.filter((i) => !i.supervisorOnly || role === "supervisor");
          if (items.length === 0) return null;
          return (
            <div key={group.label} className="sidebar-group">
              <div className="sidebar-group-label">{group.label}</div>
              {items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
                >
                  <Icon />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          );
        })}
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
