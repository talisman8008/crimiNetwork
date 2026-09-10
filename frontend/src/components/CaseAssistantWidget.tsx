import { useEffect, useRef, useState } from "react";
import { cases, getCaseById } from "../data/mockData";
import { answerQuestion, suggestedPrompts } from "../lib/caseAssistant";
import { useAuth } from "../lib/auth";
import { IconChat, IconX } from "./icons";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

function welcomeMessage(caseCode: string, caseTitle: string): ChatMessage {
  return {
    id: "welcome",
    role: "assistant",
    text: `CONFIDENTIAL BRIEFING INITIATED: ${caseCode} — ${caseTitle}.\n\nYou are accessing restricted case files. You may query this terminal regarding suspects, risk assessments, structural connections, pattern alerts, and judicial proceedings. All queries are logged and responses are strictly derived from certified case records.`,
  };
}

/** The case assistant chat, mounted once in Layout so it persists across page navigation as a
 *  floating panel rather than a dedicated route. */
export default function CaseAssistantWidget() {
  const { officerId } = useAuth();
  const [open, setOpen] = useState(false);
  const [caseId, setCaseId] = useState(cases[0]?.id ?? "");
  const activeCase = getCaseById(caseId);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    activeCase ? [welcomeMessage(activeCase.code, activeCase.title)] : [],
  );
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking, open]);

  function switchCase(id: string) {
    setCaseId(id);
    const c = getCaseById(id);
    setMessages(c ? [welcomeMessage(c.code, c.title)] : []);
  }

  function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || !caseId) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setThinking(true);
    setTimeout(() => {
      const answer = answerQuestion(caseId, trimmed);
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", text: answer }]);
      setThinking(false);
    }, 500);
  }

  if (!open) {
    return (
      <button className="assistant-fab" onClick={() => setOpen(true)}>
        <IconChat />
        Case Assistant
      </button>
    );
  }

  return (
    <div className="assistant-panel">
      <div className="assistant-panel-header">
        <div>
          <div className="assistant-panel-title">Case Assistant</div>
          <div className="assistant-panel-sub">Signed in as {officerId} &middot; grounded in case records only</div>
        </div>
        <button className="btn" onClick={() => setOpen(false)} aria-label="Close case assistant">
          <IconX />
        </button>
      </div>

      <div className="assistant-panel-case">
        <select className="select" value={caseId} onChange={(e) => switchCase(e.target.value)}>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}: {c.title}
            </option>
          ))}
        </select>
      </div>

      <div ref={scrollRef} className="assistant-thread assistant-thread-panel">
        {messages.map((m) => (
          <div key={m.id} className={`assistant-bubble ${m.role}`}>
            {m.text}
          </div>
        ))}
        {thinking && (
          <div className="assistant-bubble assistant">
            <span className="assistant-typing">
              <span />
              <span />
              <span />
            </span>
          </div>
        )}
      </div>

      <div className="assistant-prompts">
        {suggestedPrompts.map((p) => (
          <button key={p} className="chip-toggle" onClick={() => send(p)} disabled={thinking}>
            {p}
          </button>
        ))}
      </div>

      <form
        className="assistant-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask a question about this case..."
          className="assistant-input"
        />
        <button type="submit" className="btn btn-primary" disabled={!draft.trim() || thinking}>
          Send
        </button>
      </form>
    </div>
  );
}
