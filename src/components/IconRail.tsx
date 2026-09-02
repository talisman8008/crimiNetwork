import { NavLink } from "react-router-dom";
import {
  IconAlertTriangle,
  IconCamera,
  IconDatabase,
  IconFolder,
  IconLock,
  IconMapPin,
  IconScale,
  IconUsers,
} from "./icons";

/** Slim vertical rail of the secondary workspaces. The top navbar carries the three primary
 *  views; everything else lives here so no page is more than one click away. */
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
  return (
    <nav className="icon-rail" aria-label="Secondary navigation">
      {railItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `icon-rail-btn ${isActive ? "active" : ""}`}
          aria-label={label}
        >
          <Icon />
          <span className="icon-rail-tip">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
