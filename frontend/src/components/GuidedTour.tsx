import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useOnboarding } from "../lib/onboarding";

interface TourStep {
  /** Anchor in the live DOM. A step whose anchor is not on screen is skipped rather than
   *  pointing at nothing, so the tour survives layout and role differences. */
  selector: string;
  title: string;
  body: string;
  /** Route this step lives on when a tour needs to navigate before highlighting it. */
  route?: string;
}

const steps: TourStep[] = [
  {
    route: "/",
    selector: ".sidebar-nav",
    title: "Everything lives on this rail",
    body: "Analysis is where you work: the dashboard, the case you have open, the graph and the full entity database. Below it sit casework, the evidence sources behind every link, and the oversight trail.",
  },
  {
    route: "/",
    selector: ".dashboard-case-rail",
    title: "Your investigation casebook",
    body: "Use this rail to switch between active investigations. Select a case to update the dashboard, or start a new one from the Add case tile below.",
  },
  {
    route: "/",
    selector: ".dashboard-add-case-tile",
    title: "Create a case from source files",
    body: "Add the case details, upload one or more FIRs alongside CDR and financial records, then let NETRA assemble the investigation workspace.",
  },
  {
    route: "/",
    selector: ".dashboard-main-grid",
    title: "Review the intelligence snapshot",
    body: "The selected case shows its investigator, observed links, mapped locations and open-alert count before you enter the full workspace.",
  },
  {
    selector: ".notif-bell",
    title: "Hearings and alerts",
    body: "Upcoming court dates, cross-case entity matches and anything flagged since you were last in. The count is what still needs a decision.",
  },
];

const CARD_WIDTH = 340;
const GAP = 14;
const MARGIN = 16;

/** An anchor counts only if it is actually on screen. Several of these are hidden by responsive
 *  rules at narrow widths, and a step that rings a collapsed sliver teaches nothing. */
function anchorVisible(selector: string): boolean {
  const el = document.querySelector(selector);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width >= 8 && r.height >= 8;
}

/** A step on another route cannot be measured from here, so it is taken on trust and checked
 *  once we arrive. Only steps belonging to the current page are skipped up front. */
function stepAvailable(step: TourStep, pathname: string): boolean {
  if (step.route && step.route !== pathname) return true;
  return anchorVisible(step.selector);
}

function nextAvailable(from: number, dir: 1 | -1, pathname: string): number {
  for (let i = from; i >= 0 && i < steps.length; i += dir) {
    if (stepAvailable(steps[i], pathname)) return i;
  }
  return dir === 1 ? steps.length : -1;
}

interface Placement {
  cardTop: number;
  cardLeft: number;
  ring: { top: number; left: number; width: number; height: number };
}

export default function GuidedTour() {
  const { tourOpen, endTour } = useOnboarding();
  const navigate = useNavigate();
  const location = useLocation();
  const [index, setIndex] = useState(0);
  const [place, setPlace] = useState<Placement | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // The first dashboard step describes the rail itself, so keep it expanded until the visitor
  // advances. After that, it returns to its normal compact behaviour.
  useEffect(() => {
    const holdSidebarOpen = tourOpen && index === 0 && location.pathname === "/";
    document.documentElement.classList.toggle("tour-sidebar-open", holdSidebarOpen);
    return () => document.documentElement.classList.remove("tour-sidebar-open");
  }, [tourOpen, index, location.pathname]);

  // The tour is dashboard-led, including when it is launched from elsewhere.
  useEffect(() => {
    if (!tourOpen) return;
    const workspaceStart = steps.findIndex((candidate) => candidate.route === "/workspace");
    const startsInWorkspace = location.pathname === "/workspace" && workspaceStart >= 0;
    const route = startsInWorkspace ? "/workspace" : "/";
    if (location.pathname !== route) navigate(route);
    // Let the destination paint before deciding which anchors are actually on screen.
    const t = window.setTimeout(() => setIndex(nextAvailable(startsInWorkspace ? workspaceStart : 0, 1, route)), 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourOpen]);

  const step = steps[index];

  const measure = useCallback(() => {
    if (!tourOpen || !step) return;
    const el = document.querySelector(step.selector);
    if (!el) {
      setPlace(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardH = cardRef.current?.offsetHeight ?? 190;

    // Prefer sitting to the right of the anchor, then below it, then above.
    let cardLeft: number;
    let cardTop: number;
    if (r.right + GAP + CARD_WIDTH + MARGIN <= vw) {
      cardLeft = r.right + GAP;
      cardTop = r.top;
    } else if (r.bottom + GAP + cardH + MARGIN <= vh) {
      cardLeft = r.left;
      cardTop = r.bottom + GAP;
    } else {
      cardLeft = r.left;
      cardTop = r.top - GAP - cardH;
    }

    setPlace({
      cardLeft: Math.min(Math.max(MARGIN, cardLeft), vw - CARD_WIDTH - MARGIN),
      cardTop: Math.min(Math.max(MARGIN, cardTop), vh - cardH - MARGIN),
      ring: { top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 },
    });
  }, [tourOpen, step]);

  // Walk past any step whose anchor is not rendered in this role or at this width.
  const next = useCallback(
    () => setIndex((i) => nextAvailable(i + 1, 1, location.pathname)),
    [location.pathname],
  );

  const back = useCallback(() => {
    setIndex((i) => {
      const prev = nextAvailable(i - 1, -1, location.pathname);
      return prev < 0 ? i : prev;
    });
  }, [location.pathname]);

  useLayoutEffect(() => {
    if (!tourOpen || !step) return;

    // Send the tour to the page this step is about; the effect re-runs once we land.
    if (step.route && step.route !== location.pathname) {
      navigate(step.route);
      return;
    }

    const el = document.querySelector(step.selector);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    measure();

    // Re-measure once the smooth scroll and any page transition have settled. If the anchor
    // still is not there, the step has nothing to point at, so move on rather than stall.
    const t = window.setTimeout(() => {
      if (anchorVisible(step.selector)) measure();
      else next();
    }, 420);

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [tourOpen, step, measure, next, navigate, location.pathname]);

  useEffect(() => {
    if (tourOpen && index >= steps.length) endTour();
  }, [tourOpen, index, endTour]);

  useEffect(() => {
    if (!tourOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") endTour();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tourOpen, endTour, next, back]);

  if (!tourOpen || !step || index >= steps.length) return null;

  // Count only the steps this screen actually shows, so skipping one does not make the
  // counter jump from "2 of 5" to "4 of 5".
  const shownTotal = steps.filter((s) => stepAvailable(s, location.pathname)).length;
  const shownIndex = steps.filter((s, i) => i <= index && stepAvailable(s, location.pathname)).length;
  const isLast = nextAvailable(index + 1, 1, location.pathname) >= steps.length;

  return (
    <div className="tour-layer">
      {place ? (
        <div
          className="tour-ring"
          style={{
            top: place.ring.top,
            left: place.ring.left,
            width: place.ring.width,
            height: place.ring.height,
          }}
        />
      ) : (
        <div className="tour-dim" />
      )}

      <div
        ref={cardRef}
        className={`tour-card ${place ? "" : "centered"}`}
        style={place ? { top: place.cardTop, left: place.cardLeft } : undefined}
        role="dialog"
        aria-live="polite"
      >
        <div className="tour-count mono">
          {shownIndex} of {shownTotal}
        </div>
        <div className="tour-card-title">{step.title}</div>
        <p className="tour-card-body">{step.body}</p>
        <div className="tour-card-foot">
          <button type="button" className="tour-skip" onClick={endTour}>
            Skip
          </button>
          <div className="tour-nav">
            {index > 0 && (
              <button type="button" className="ftue-btn" onClick={back}>
                Back
              </button>
            )}
            <button
              type="button"
              className="ftue-btn ftue-btn-primary"
              onClick={isLast ? endTour : next}
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
