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
import { getCaseById } from "../data/mockData";
import { alerts } from "../data/mockData";

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
      { to: "/", label: "Dashboard", icon: IconGrid, end: true },
      { to: "/workspace", label: "Workspace", icon: IconFolder },
      { to: "/network", label: "Network", icon: IconNetwork },
      { to: "/entities", label: "Database", icon: IconDatabase },
    ],
  },
  {
    label: "Casework",
    items: [
      { to: "/cases", label: "Cases", icon: IconFolder },
      { to: "/court-dates", label: "Court Dates", icon: IconScale },
      { to: "/resolution", label: "Merge Review", icon: IconUsers },
      { to: "/supervisor", label: "Oversight", icon: IconShield, supervisorOnly: true },
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
    label: "Oversight",
    items: [
      { to: "/alerts", label: "Alerts", icon: IconAlertTriangle },
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
  const openAlerts = alerts.filter((a) => a.status !== "dismissed").length;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="/netra-logo.svg" alt="" />
        <div>
          <strong>NETRA</strong>
          <span>Ministry of Home Affairs</span>
        </div>
      </div>

      <button className="sidebar-search" onClick={() => navigate("/entities")}>
        <IconSearch />
        Search entities
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
                  {to === "/alerts" && openAlerts > 0 && (
                    <span className="sidebar-badge">{openAlerts}</span>
                  )}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        <button className="sidebar-help" onClick={startTour}>
          <IconHelp />
          Show me around
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
