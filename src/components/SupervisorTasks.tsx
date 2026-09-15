import { useState } from "react";
import { useLocalStorage } from "../lib/useLocalStorage";
import { officers } from "../data/officersData";
import { cases } from "../data/mockData";
import { IconX } from "./icons";

/** A supervisor's pending assignments: a line of work handed to a named officer against a case.
 *  Kept in local storage, since the backend has no task endpoint. Human-in-the-loop for the
 *  people who run the investigation, not just the graph. */
interface Task {
  id: string;
  text: string;
  officerId: string;
  caseId: string;
  done: boolean;
}

export default function SupervisorTasks() {
  const [tasks, setTasks] = useLocalStorage<Task[]>("netra-super-tasks", []);
  const [text, setText] = useState("");
  const [officerId, setOfficerId] = useState(officers[0]?.id ?? "");
  const [caseId, setCaseId] = useState(cases[0]?.id ?? "");

  function add() {
    if (!text.trim()) return;
    setTasks((prev) => [
      { id: Math.random().toString(36).slice(2), text: text.trim(), officerId, caseId, done: false },
      ...prev,
    ]);
    setText("");
  }

  const officerName = (id: string) => officers.find((o) => o.id === id)?.name ?? "Unassigned";
  const caseCode = (id: string) => cases.find((c) => c.id === id)?.code ?? id;

  const pending = tasks.filter((t) => !t.done);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <h2>Assign pending tasks</h2>
        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }} className="mono">
          {pending.length} open
        </span>
      </div>
      <div className="card-body">
        <div className="task-form">
          <input
            className="task-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Task — e.g. Re-interview the depot watchman"
          />
          <select className="select" value={officerId} onChange={(e) => setOfficerId(e.target.value)}>
            {officers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select className="select" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={add}>
            Assign
          </button>
        </div>

        <div className="task-list">
          {tasks.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 10 }}>
              No tasks assigned yet.
            </p>
          )}
          {tasks.map((t) => (
            <div key={t.id} className={`task-row ${t.done ? "done" : ""}`}>
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}
              />
              <div className="task-body">
                <div className="task-text">{t.text}</div>
                <div className="task-meta">
                  {officerName(t.officerId)} &middot; <span className="mono">{caseCode(t.caseId)}</span>
                </div>
              </div>
              <button
                className="task-remove"
                onClick={() => setTasks((prev) => prev.filter((x) => x.id !== t.id))}
                aria-label="Remove task"
              >
                <IconX />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
