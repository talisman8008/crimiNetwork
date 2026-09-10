import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cases, entities } from "../data/mockData";
import { EntityIcon, entityTypeLabel } from "./ui";
import { IconSearch } from "./icons";

interface Result {
  kind: "entity" | "case";
  id: string;
  label: string;
  sub: string;
  go: () => void;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const entityResults: Result[] = entities
      .filter((e) => !q || e.label.toLowerCase().includes(q))
      .slice(0, 8)
      .map((e) => ({
        kind: "entity",
        id: e.id,
        label: e.label,
        sub: entityTypeLabel[e.type],
        go: () => navigate(`/network?case=${e.caseIds[0] ?? "all"}&entity=${e.id}`),
      }));
    const caseResults: Result[] = cases
      .filter((c) => !q || c.title.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
      .slice(0, 4)
      .map((c) => ({
        kind: "case",
        id: c.id,
        label: c.title,
        sub: c.code,
        go: () => navigate(`/network?case=${c.id}`),
      }));
    return [...caseResults, ...entityResults];
  }, [query, navigate]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  function select(r: Result) {
    r.go();
    setOpen(false);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 32, 54, 0.45)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
      }}
      onClick={() => setOpen(false)}
    >
      <div
        className="card"
        style={{ width: 560, maxHeight: "60vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <IconSearch className="palette-search-icon" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to a case or entity..."
            style={{ border: "none", outline: "none", fontSize: 15, flex: 1, fontFamily: "inherit", background: "transparent" }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && results[activeIndex]) {
                select(results[activeIndex]);
              }
            }}
          />
          <span className="tag mono">Esc</span>
        </div>
        <div style={{ overflowY: "auto" }}>
          {results.length === 0 && <div className="empty-state">No matches.</div>}
          {results.map((r, i) => (
            <button
              key={`${r.kind}-${r.id}`}
              onClick={() => select(r)}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                textAlign: "left",
                padding: "9px 16px",
                border: "none",
                borderBottom: "1px solid var(--border)",
                background: i === activeIndex ? "var(--surface-sunken)" : "transparent",
                cursor: "pointer",
              }}
            >
              {r.kind === "entity" ? (
                <EntityIcon type={entities.find((e) => e.id === r.id)!.type} />
              ) : (
                <span className="entity-icon" style={{ background: "var(--navy-700)", color: "#fff", fontSize: 11 }}>
                  CASE
                </span>
              )}
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{r.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{r.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
