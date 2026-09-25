import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { askQuestion, suggestedPrompts, type CopilotAnswer } from "../lib/caseAssistant";
import { ArrowDown, RotateCcw, SendHorizontal, X } from "lucide-react";
import { getEntityById } from "../data/mockData";

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; answer: CopilotAnswer };

function MessageContent({ message }: { message: ChatMessage }) {
  if (message.role === "user") return <div className="case-chat-message case-chat-message-user">{message.text}</div>;
  return <div className="case-chat-message case-chat-message-assistant">
    <p>{message.answer.answer}</p>
    {message.answer.referenced_entities.length > 0 && <div className="case-chat-entities">
      {[...new Set(message.answer.referenced_entities)].map((entityId) => {
        const entity = getEntityById(entityId);
        return <Link key={entityId} to={`/profile/${entityId}`}>{entity?.label ?? "Open referenced record"}</Link>;
      })}
    </div>}
    {message.answer.sources.length > 0 && <details className="case-chat-sources">
      <summary>Sources used ({message.answer.sources.length})</summary>
      <ul>{message.answer.sources.map((source, index) => <li key={`${source}-${index}`}>{source}</li>)}</ul>
    </details>}
  </div>;
}

export default function CaseAssistantWidget({ caseId }: { caseId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const threadRef = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const resetChat = () => {
    setMessages([]);
    setQuery("");
    setError(null);
    followingRef.current = true;
    setShowJumpToLatest(false);
  };

  const jumpToLatest = () => {
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTo({ top: thread.scrollHeight, behavior: "smooth" });
    followingRef.current = true;
    setShowJumpToLatest(false);
  };

  const updateFollowing = () => {
    const thread = threadRef.current;
    if (!thread) return;
    const following = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 28;
    followingRef.current = following;
    setShowJumpToLatest(!following && messages.length > 0);
  };

  useEffect(() => {
    if (!followingRef.current) return;
    const frame = requestAnimationFrame(() => {
      const thread = threadRef.current;
      if (thread) thread.scrollTop = thread.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, loading]);

  const submit = async (prompt?: string) => {
    const trimmed = (prompt ?? query).trim();
    if (!trimmed || loading) return;
    followingRef.current = true;
    setShowJumpToLatest(false);
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: "user", text: trimmed }]);
    setQuery("");
    setLoading(true);
    setError(null);
    try {
      const answer = await askQuestion(caseId, trimmed);
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: "assistant", answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The case assistant could not answer that question.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return <button className="assistant-fab" onClick={() => setOpen(true)} aria-label="Open Case Assistant" title="Case Assistant">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
  </button>;

  return <section className="case-chat-panel" aria-label="Case assistant">
    <header className="case-chat-header">
      <div><span className="case-chat-eyebrow">Case intelligence</span><h2>Case Assistant</h2><p>Grounded in the open investigation.</p></div>
      <div className="case-chat-header-actions">
        <button type="button" onClick={resetChat} aria-label="Start a new chat" title="New chat"><RotateCcw aria-hidden="true" /></button>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close case assistant"><X aria-hidden="true" /></button>
      </div>
    </header>

    <div className="case-chat-scroller">
    <div className="case-chat-thread" ref={threadRef} onScroll={updateFollowing} aria-live="polite">
      {messages.length === 0 ? <div className="case-chat-empty">
        <span className="case-chat-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg></span>
        <h3>Start an investigation chat</h3>
        <p>Ask about evidence, entities, links, or patterns. Answers stay grounded in the current case.</p>
        <div className="case-chat-prompt-list">{suggestedPrompts.slice(0, 3).map((prompt) => <button key={prompt} type="button" onClick={() => void submit(prompt)}>{prompt}</button>)}</div>
      </div> : messages.map((message) => <MessageContent key={message.id} message={message} />)}
      {loading && <div className="case-chat-message case-chat-message-assistant case-chat-thinking">Reviewing case records<span>…</span></div>}
      {error && <div className="case-chat-error">{error}</div>}
    </div>
    {showJumpToLatest && <button className="case-chat-jump" type="button" onClick={jumpToLatest}><ArrowDown aria-hidden="true" /> Jump to latest</button>}
    </div>

    <form className="case-chat-composer" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask about this case…" disabled={loading} aria-label="Ask the case assistant" />
      <button type="submit" disabled={loading || !query.trim()} aria-label="Send question"><SendHorizontal aria-hidden="true" /></button>
    </form>
  </section>;
}
