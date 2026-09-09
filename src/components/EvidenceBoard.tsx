import { useEffect, useMemo, useRef, useState } from "react";
import type { Entity } from "../data/types";
import { useLocalStorage } from "../lib/useLocalStorage";
import { entitySubLabel } from "./ui";

type PinType = "person" | "photo" | "clipping" | "note";
type StringColor = "red" | "yellow" | "green" | "blue";

interface Pin {
  id: string;
  type: PinType;
  x: number;
  y: number;
  rotation: number;
  name?: string;
  role?: string;
  photo?: string;
  caption?: string;
  headline?: string;
  body?: string;
  text?: string;
}

interface StringLink {
  id: string;
  from: string;
  to: string;
  color: StringColor;
}

interface BoardState {
  pins: Pin[];
  strings: StringLink[];
}

const colorHex: Record<StringColor, string> = {
  red: "#c0392b",
  yellow: "#c99a1f",
  green: "#2f7a4f",
  blue: "#2a5fa8",
};

const colors: StringColor[] = ["red", "yellow", "green", "blue"];

function newId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function nextPosition(count: number) {
  const col = count % 6;
  const row = Math.floor(count / 6);
  return { x: 40 + col * 178, y: 30 + row * 195 };
}

function pinLabel(pin: Pin): string {
  if (pin.type === "person") return pin.name || "Unnamed subject";
  if (pin.type === "clipping") return pin.headline || "Clipping";
  if (pin.type === "note") return (pin.text || "Note").slice(0, 24);
  return pin.caption || "Photo";
}

interface EvidenceBoardProps {
  caseId: string;
  entities: Entity[];
}

export default function EvidenceBoard({ caseId, entities }: EvidenceBoardProps) {
  const [board, setBoard] = useLocalStorage<BoardState>(`netra-board-${caseId}`, { pins: [], strings: [] });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [connectColor, setConnectColor] = useState<StringColor | null>(null);
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const [photoTarget, setPhotoTarget] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragInfo = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);

  const pinById = useMemo(() => new Map(board.pins.map((p) => [p.id, p])), [board.pins]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setConnectColor(null);
        setPendingFrom(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function addPin(partial: Partial<Pin> & { type: PinType }) {
    const pin: Pin = {
      id: newId(),
      rotation: Math.random() * 8 - 4,
      ...nextPosition(board.pins.length),
      ...partial,
    };
    setBoard((prev) => ({ ...prev, pins: [...prev.pins, pin] }));
  }

  function updatePin(id: string, patch: Partial<Pin>) {
    setBoard((prev) => ({ ...prev, pins: prev.pins.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  }

  function removePin(id: string) {
    setBoard((prev) => ({
      pins: prev.pins.filter((p) => p.id !== id),
      strings: prev.strings.filter((s) => s.from !== id && s.to !== id),
    }));
  }

  function removeString(id: string) {
    setBoard((prev) => ({ ...prev, strings: prev.strings.filter((s) => s.id !== id) }));
  }

  function clearBoard() {
    if (window.confirm("Clear the entire evidence board? This cannot be undone.")) {
      setBoard({ pins: [], strings: [] });
    }
  }

  function handlePointerDown(e: React.PointerEvent, pin: Pin) {
    dragInfo.current = { id: pin.id, startX: e.clientX, startY: e.clientY, origX: pin.x, origY: pin.y, moved: false };
    if (!connectColor) {
      setDraggingId(pin.id);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const info = dragInfo.current;
    if (!info) return;
    const dx = e.clientX - info.startX;
    const dy = e.clientY - info.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) info.moved = true;
    if (info.moved && !connectColor) {
      updatePin(info.id, { x: Math.max(0, info.origX + dx), y: Math.max(0, info.origY + dy) });
    }
  }

  function handlePointerUp(pin: Pin) {
    const info = dragInfo.current;
    dragInfo.current = null;
    setDraggingId(null);
    if (info && !info.moved) {
      handlePinClick(pin.id);
    }
  }

  function handlePinClick(id: string) {
    if (!connectColor) return;
    if (!pendingFrom) {
      setPendingFrom(id);
    } else if (pendingFrom === id) {
      setPendingFrom(null);
    } else {
      setBoard((prev) => ({ ...prev, strings: [...prev.strings, { id: newId(), from: pendingFrom, to: id, color: connectColor }] }));
      setPendingFrom(null);
    }
  }

  function openPhotoPicker(targetPinId: string | null) {
    setPhotoTarget(targetPinId);
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (photoTarget) {
        updatePin(photoTarget, { photo: dataUrl });
      } else {
        addPin({ type: "photo", photo: dataUrl, caption: file.name.replace(/\.[^.]+$/, "") });
      }
      setPhotoTarget(null);
    };
    reader.readAsDataURL(file);
  }

  function anchor(pin: Pin) {
    return { x: pin.x + 74, y: pin.y };
  }

  return (
    <div className="tab-fade-in" style={{ flex: 1, display: "flex", minHeight: 0, flexDirection: "column" }}>
      <div className="board-toolbar">
        <div className="board-toolbar-group">
          <button className="btn" onClick={() => addPin({ type: "person", name: "New subject", role: "" })}>
            + Person
          </button>
          <button className="btn" onClick={() => openPhotoPicker(null)}>
            + Photo
          </button>
          <button className="btn" onClick={() => addPin({ type: "clipping", headline: "Headline", body: "Clipping text..." })}>
            + Clipping
          </button>
          <button className="btn" onClick={() => addPin({ type: "note", text: "New note" })}>
            + Note
          </button>
        </div>
        <div style={{ width: 1, height: 20, background: "var(--border)" }} />
        <div className="board-toolbar-group">
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Connect:</span>
          {colors.map((c) => (
            <button
              key={c}
              className={`board-color-btn ${connectColor === c ? "active" : ""}`}
              style={{ background: colorHex[c] }}
              title={`${c} string`}
              onClick={() => {
                setConnectColor((prev) => (prev === c ? null : c));
                setPendingFrom(null);
              }}
            />
          ))}
          {connectColor && (
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {pendingFrom ? "Click a second pin to link" : "Click a pin to start a string"}
            </span>
          )}
        </div>
        <button className="btn" style={{ marginLeft: "auto" }} onClick={clearBoard}>
          Clear board
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div className="board-canvas-wrap">
          <div className="board-canvas" style={{ cursor: connectColor ? "crosshair" : "default" }}>
            <svg width={2200} height={1400} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
              {board.strings.map((s) => {
                const a = pinById.get(s.from);
                const b = pinById.get(s.to);
                if (!a || !b) return null;
                const p1 = anchor(a);
                const p2 = anchor(b);
                return (
                  <line
                    key={s.id}
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={colorHex[s.color]}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    opacity={0.85}
                  />
                );
              })}
            </svg>

            {board.pins.map((pin) => (
              <div
                key={pin.id}
                className={`board-pin board-pin-${pin.type} ${draggingId === pin.id ? "dragging" : ""} ${pendingFrom === pin.id ? "pending" : ""}`}
                style={{ left: pin.x, top: pin.y, transform: `rotate(${pin.rotation}deg)` }}
                onPointerDown={(e) => handlePointerDown(e, pin)}
                onPointerMove={handlePointerMove}
                onPointerUp={() => handlePointerUp(pin)}
              >
                <span className="board-pin-head" />
                <button
                  className="board-pin-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePin(pin.id);
                  }}
                  aria-label="Remove pin"
                >
                  &times;
                </button>
                <div className="board-pin-body" style={{ pointerEvents: connectColor ? "none" : undefined }}>
                  {pin.type === "person" && (
                    <>
                      <button
                        type="button"
                        className={`board-pin-person-photo ${pin.photo ? "has-photo" : ""}`}
                        style={pin.photo ? { backgroundImage: `url(${pin.photo})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => openPhotoPicker(pin.id)}
                        aria-label={pin.photo ? "Replace photograph" : "Add a photograph"}
                      >
                        {!pin.photo && <span>Add photo</span>}
                      </button>
                      <input
                        value={pin.name ?? ""}
                        onChange={(e) => updatePin(pin.id, { name: e.target.value })}
                        onPointerDown={(e) => e.stopPropagation()}
                        placeholder="Name"
                      />
                      <select
                        className="role-input"
                        value=""
                        onPointerDown={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const ent = entities.find((x) => x.id === e.target.value);
                          if (ent) updatePin(pin.id, { name: ent.label, role: entitySubLabel(ent) });
                        }}
                        style={{ marginBottom: 3, fontSize: 11 }}
                      >
                        <option value="">Link to entity...</option>
                        {entities
                          .filter((x) => x.type === "person")
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.label}
                            </option>
                          ))}
                      </select>
                      <input
                        className="role-input"
                        value={pin.role ?? ""}
                        onChange={(e) => updatePin(pin.id, { role: e.target.value })}
                        onPointerDown={(e) => e.stopPropagation()}
                        placeholder="Role / notes"
                      />
                    </>
                  )}

                  {pin.type === "photo" && (
                    <>
                      {pin.photo && <img src={pin.photo} alt="" />}
                      <input
                        className="board-pin-photo-caption"
                        value={pin.caption ?? ""}
                        onChange={(e) => updatePin(pin.id, { caption: e.target.value })}
                        onPointerDown={(e) => e.stopPropagation()}
                        placeholder="Caption"
                        style={{ position: "absolute", bottom: 6, left: 6, right: 6 }}
                      />
                    </>
                  )}

                  {pin.type === "clipping" && (
                    <>
                      <input
                        value={pin.headline ?? ""}
                        onChange={(e) => updatePin(pin.id, { headline: e.target.value })}
                        onPointerDown={(e) => e.stopPropagation()}
                        placeholder="Headline"
                      />
                      <textarea
                        value={pin.body ?? ""}
                        onChange={(e) => updatePin(pin.id, { body: e.target.value })}
                        onPointerDown={(e) => e.stopPropagation()}
                        placeholder="Clipping text..."
                      />
                    </>
                  )}

                  {pin.type === "note" && (
                    <textarea
                      value={pin.text ?? ""}
                      onChange={(e) => updatePin(pin.id, { text: e.target.value })}
                      onPointerDown={(e) => e.stopPropagation()}
                      placeholder="Note"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="board-strings-panel">
          <div className="section-title">Connections ({board.strings.length})</div>
          {board.strings.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              Pick a color above, then click two pins on the board to link them.
            </div>
          )}
          {board.strings.map((s) => {
            const a = pinById.get(s.from);
            const b = pinById.get(s.to);
            return (
              <div key={s.id} className="board-string-row">
                <span className="board-string-swatch" style={{ background: colorHex[s.color] }} />
                <span>
                  {a ? pinLabel(a) : "?"} &harr; {b ? pinLabel(b) : "?"}
                </span>
                <button onClick={() => removeString(s.id)} aria-label="Remove connection">
                  &times;
                </button>
              </div>
            );
          })}

          <div className="divider" />
          <div className="section-title">Pins ({board.pins.length})</div>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
            Drag pins to arrange the board. Hover a pin to remove it. Notes and clippings are edited directly on the card.
          </p>
        </div>
      </div>
    </div>
  );
}
