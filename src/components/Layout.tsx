import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  IconDatabase,
  IconGrid,
  IconNetwork,
  IconFolder,
  IconShield,
  IconX,
} from "./icons";
import { useAuth } from "../lib/auth";
import { useActiveCase } from "../lib/activeCase";
import { getCaseById } from "../data/mockData";
import CommandPalette from "./CommandPalette";
import NotificationsPanel from "./NotificationsPanel";
import CaseAssistantWidget from "./CaseAssistantWidget";
import IconRail from "./IconRail";

const baseNavItems = [
  { to: "/", label: "Dashboard", icon: IconGrid, end: true },
  { to: "/workspace", label: "Workspace", icon: IconFolder },
  { to: "/network", label: "Network", icon: IconNetwork },
  { to: "/entities", label: "Database", icon: IconDatabase },
];

const supervisorNavItem = { to: "/supervisor", label: "Oversight", icon: IconShield, end: false };

export default function Layout() {
  const { logout, role } = useAuth();
  const { activeCaseId, closeCase } = useActiveCase();
  const activeCase = activeCaseId ? getCaseById(activeCaseId) : undefined;
  const navigate = useNavigate();

  const navItems = role === "supervisor" ? [...baseNavItems, supervisorNavItem] : baseNavItems;

  // Use a hardcoded, formal officer ID for demo purposes instead of "bht"
  const formalOfficerId = "INS-4471";

  return (
    <div className="app-shell">
      <div className="sarkari-top-strip">
        <div className="tricolor" />
        <div>Government of India | Ministry of Home Affairs</div>
        <div style={{ display: "flex", gap: 16 }}>
          <span>A- A A+</span>
          <span>English</span>
        </div>
      </div>
      <header className="top-navbar">
        <div className="top-navbar-brand">
          <img src="/favicon.svg" alt="NETRA Logo" />
          <div className="top-navbar-brand-text">
            <strong>NETRA</strong>
            <span>Fragmented evidence. Clear intelligence.</span>
          </div>
        </div>
        
        <nav className="top-navbar-nav">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "active" : "")}>
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
        
        <div className="top-navbar-right">
          {activeCase && (
            <span className="active-case-chip" title={activeCase.title}>
              <span className="active-case-chip-label">Working on</span>
              <span className="active-case-chip-code">{activeCase.code}</span>
              <button
                className="active-case-close"
                onClick={() => {
                  closeCase();
                  navigate("/");
                }}
                aria-label="Close case and return to caseload"
              >
                <IconX />
              </button>
            </span>
          )}
          <NotificationsPanel />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.25, borderRight: "1px solid rgba(255,255,255,0.2)", paddingRight: 16 }}>
            <span style={{ fontSize: 13, color: "var(--text-on-dark-dim)", fontWeight: 500 }}>{formalOfficerId}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {role}
            </span>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
            style={{ 
              padding: "6px 12px", border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", cursor: "pointer",
              fontSize: 12, color: "#fff", fontWeight: 500, borderRadius: 2,
              fontFamily: "inherit", textTransform: "uppercase"
            }}
          >
            Logout
          </button>
        </div>
      </header>
      
      <div className="app-body">
        <IconRail />
        <main className="main-col">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
      <CaseAssistantWidget />
    </div>
  );
}
