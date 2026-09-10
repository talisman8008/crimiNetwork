import { useEffect, useRef, useState } from "react";

// Fills the viewport with a wallpaper-like grid of tiny eyes whose pupils track the cursor.
// A quiet nod to what "Netra" means (eye) — used only on the login page background.

const COL_SPACING = 118;
const ROW_SPACING = 92;
const EYE_WIDTH = 72;
const EYE_HEIGHT = EYE_WIDTH * 0.42;

interface EyeSpot {
  x: number;
  y: number;
}

function buildGrid(width: number, height: number): EyeSpot[] {
  const spots: EyeSpot[] = [];
  const cols = Math.ceil(width / COL_SPACING) + 1;
  const rows = Math.ceil(height / ROW_SPACING) + 1;
  for (let row = 0; row < rows; row++) {
    // stagger alternating rows brick-style so the grid reads as organic, not a spreadsheet
    const offset = row % 2 === 0 ? 0 : COL_SPACING / 2;
    for (let col = 0; col < cols; col++) {
      spots.push({ x: col * COL_SPACING + offset, y: row * ROW_SPACING });
    }
  }
  return spots;
}

export default function BackgroundEyes() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [spots, setSpots] = useState<EyeSpot[]>([]);

  useEffect(() => {
    function recompute() {
      setSpots(buildGrid(window.innerWidth, window.innerHeight));
    }
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, []);

  useEffect(() => {
    let animationFrameId: number;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;

    // small smoothing factor so pupils trail the cursor rather than snapping to it
    const handleMouseMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
    };

    const updateEyes = () => {
      if (containerRef.current) {
        const eyes = containerRef.current.querySelectorAll<HTMLElement>(".eye-container");
        eyes.forEach((eyeElement) => {
          const pupil = eyeElement.querySelector<HTMLElement>(".eye-pupil");
          if (!pupil) return;

          const rect = eyeElement.getBoundingClientRect();
          const eyeCenterX = rect.left + rect.width / 2;
          const eyeCenterY = rect.top + rect.height / 2;

          const deltaX = targetX - eyeCenterX;
          const deltaY = targetY - eyeCenterY;
          const angle = Math.atan2(deltaY, deltaX);

          // pupil travel capped to a fraction of the eye's own width
          const maxMove = rect.width * 0.24;
          const rawDistance = Math.hypot(deltaX, deltaY);
          const distance = Math.min(maxMove, rawDistance * 0.12);

          const moveX = Math.cos(angle) * distance;
          const moveY = Math.sin(angle) * distance;
          pupil.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;
        });
      }
      animationFrameId = requestAnimationFrame(updateEyes);
    };

    window.addEventListener("mousemove", handleMouseMove);
    animationFrameId = requestAnimationFrame(updateEyes);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
      }}
    >
      {spots.map((spot, i) => (
        <div
          key={i}
          className="eye-container"
          style={{
            position: "absolute",
            top: spot.y,
            left: spot.x,
            width: EYE_WIDTH,
            height: EYE_HEIGHT,
            borderRadius: "50%",
            border: "1.5px solid rgba(27, 79, 138, 0.13)",
            transform: "translate(-50%, -50%)",
            boxShadow: "inset 0 0 8px rgba(27, 79, 138, 0.05)",
          }}
        >
          <div
            className="eye-pupil"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: EYE_WIDTH * 0.22,
              height: EYE_WIDTH * 0.22,
              borderRadius: "50%",
              background: "rgba(37, 99, 235, 0.22)",
              transform: "translate(-50%, -50%)",
              transition: "transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)",
            }}
          />
        </div>
      ))}
    </div>
  );
}
