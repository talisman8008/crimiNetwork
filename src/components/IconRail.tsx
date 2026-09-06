import { NavLink } from "react-router-dom";
import {
  IconAlertTriangle,
  IconCamera,
  IconChevronLeft,
  IconChevronRight,
  IconDatabase,
  IconFolder,
  IconLock,
  IconMapPin,
  IconScale,
  IconUsers,
} from "./icons";
import { useLocalStorage } from "../lib/useLocalStorage";

/** Rail of the secondary workspaces. The top navbar carries the primary views; everything else
 *  lives here so no page is more than one click away.
 *
 *  It starts labelled. Eight unlabelled circles with hover-only tooltips are unreadable to
 *  someone opening the console for the first time — the map in particular was effectively
 *  hidden — so the labels show until an officer chooses to collapse them, and that choice
 *  is remembered. */
const railItems = [
  { to: "/cases", label: "Cases", icon: IconFolder },
  { to: "/resolution", label: "Merge Review", icon: IconUsers },
  { to: "/court-dates", label: "Court Dates", icon: IconScale },
  { to: "/map", label: "Location Map", icon: IconMapPin },
  { to: "/cctv", label: "CCTV Footage", icon: IconCamera },
  { to: "/alerts", label: "Alerts", icon: IconAlertTriangle },
  { to: "/sources", label: "Data Sources", icon: IconDatabase },
  { to: "/access-log", label: "Access Log", icon: IconLock },
];

export default function IconRail() {
  const [collapsed, setCollapsed] = useLocalStorage("netra-rail-collapsed", false);

  return (
    <nav className={`icon-rail ${collapsed ? "collapsed" : ""}`} aria-label="Secondary navigation">
      {!collapsed && <div className="icon-rail-heading">Workspaces</div>}

      {railItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `icon-rail-btn ${isActive ? "active" : ""}`}
          aria-label={label}
          title={collapsed ? label : undefined}
        >
          <Icon />
          {collapsed ? (
            <span className="icon-rail-tip">{label}</span>
          ) : (
            <span className="icon-rail-label">{label}</span>
          )}
        </NavLink>
      ))}

      <button
        type="button"
        className="icon-rail-toggle"
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? "Expand navigation labels" : "Collapse navigation to icons"}
      >
        {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
        {!collapsed && <span>Collapse</span>}
      </button>
    </nav>
  );
}
