import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import NetworkGraph from "./pages/NetworkGraph";
import Entities from "./pages/Entities";
import Cases from "./pages/Cases";
import Alerts from "./pages/Alerts";
import DataSources from "./pages/DataSources";
import MapView from "./pages/MapView";
import CctvFootagePage from "./pages/CctvFootagePage";
import CourtDates from "./pages/CourtDates";
import AccessLog from "./pages/AccessLog";
import PersonProfile from "./pages/PersonProfile";
import SupervisorConsole from "./pages/SupervisorConsole";
import CaseWorkspace from "./pages/CaseWorkspace";
import EntityResolution from "./pages/EntityResolution";
import CaseDossier from "./pages/CaseDossier";
import Login from "./pages/Login";
import RequireAuth from "./components/RequireAuth";
import { AuthProvider } from "./lib/auth";
import { RedactionProvider } from "./lib/redaction";
import { WatchlistProvider } from "./lib/watchlist";
import { ActiveCaseProvider } from "./lib/activeCase";
import { AnnotationsProvider } from "./lib/annotations";
import { OnboardingProvider } from "./lib/onboarding";

export default function App() {
  return (
    <AuthProvider>
      <RedactionProvider>
        <WatchlistProvider>
          <ActiveCaseProvider>
          <AnnotationsProvider>
          <OnboardingProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<RequireAuth />}>
                <Route path="/" element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="network" element={<NetworkGraph />} />
                  <Route path="entities" element={<Entities />} />
                  <Route path="cases" element={<Cases />} />
                  <Route path="court-dates" element={<CourtDates />} />
                  <Route path="map" element={<MapView />} />
                  <Route path="cctv" element={<CctvFootagePage />} />
                  <Route path="alerts" element={<Alerts />} />
                  <Route path="sources" element={<DataSources />} />
                  <Route path="access-log" element={<AccessLog />} />
                  <Route path="profile/:entityId" element={<PersonProfile />} />
                  <Route path="workspace" element={<CaseWorkspace />} />
                  <Route path="supervisor" element={<SupervisorConsole />} />
                  <Route path="resolution" element={<EntityResolution />} />
                </Route>
                <Route path="dossier/:caseId" element={<CaseDossier />} />
              </Route>
            </Routes>
          </BrowserRouter>
          </OnboardingProvider>
          </AnnotationsProvider>
          </ActiveCaseProvider>
        </WatchlistProvider>
      </RedactionProvider>
    </AuthProvider>
  );
}
