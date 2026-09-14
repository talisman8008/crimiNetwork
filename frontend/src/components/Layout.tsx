import { Outlet } from "react-router-dom";
import CommandPalette from "./CommandPalette";
import NotificationsPanel from "./NotificationsPanel";
import CaseAssistantWidget from "./CaseAssistantWidget";
import { useActiveCase } from "../lib/activeCase";
import Sidebar from "./Sidebar";
import GuidedTour from "./GuidedTour";

export default function Layout() {
  const { activeCaseId } = useActiveCase();
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <div className="app-topline">
          <span className="tricolor-dot" aria-hidden="true" />
          Government of India &middot; Ministry of Home Affairs &middot; National Crime Records Bureau
          <NotificationsPanel />
        </div>
        <main className="main-col">
          <Outlet />
        </main>
      </div>
      <CommandPalette />

      <GuidedTour />
      {activeCaseId && <CaseAssistantWidget caseId={activeCaseId} />}
    </div>
  );
}
