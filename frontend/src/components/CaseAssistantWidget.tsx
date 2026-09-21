import { useState } from "react";
import { Link } from "react-router-dom";
import { askQuestion, suggestedPrompts, type CopilotAnswer } from "../lib/caseAssistant";

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; answer: CopilotAnswer };

function MessageContent({ message }: { message: ChatMessage }) {
  if (message.role === "user") return <div className="case-chat-message case-chat-message-user">{message.text}</div>;
  return <div className="case-chat-message case-chat-message-assistant">
    <p>{message.answer.answer}</p>
    {message.answer.referenced_entities.length > 0 && <div className="case-chat-entities">
      {message.answer.referenced_entities.map((entityId) => <Link key={entityId} to={`/profile/${entityId}`}>View referenced entity</Link>)}
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

  const resetChat = () => {
    setMessages([]);
    setQuery("");
    setError(null);
  };

  const submit = async (prompt?: string) => {
    const trimmed = (prompt ?? query).trim();
    if (!trimmed || loading) return;
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
      <div><h2>Case Assistant</h2><p>How can I help with this case?</p></div>
      <div className="case-chat-header-actions">
        <button type="button" onClick={resetChat} aria-label="Start a new chat" title="New chat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 11a8 8 0 1 0 2 5.3" /><path d="M20 4v7h-7" /></svg></button>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close case assistant">×</button>
      </div>
    </header>

    <div className="case-chat-thread" aria-live="polite">
      {messages.length === 0 ? <div className="case-chat-empty">
        <span className="case-chat-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg></span>
        <h3>Start an investigation chat</h3>
        <p>Ask about evidence, entities, links, or patterns. Answers stay grounded in the current case.</p>
        <div className="case-chat-prompt-list">{suggestedPrompts.slice(0, 3).map((prompt) => <button key={prompt} type="button" onClick={() => void submit(prompt)}>{prompt}</button>)}</div>
      </div> : messages.map((message) => <MessageContent key={message.id} message={message} />)}
      {loading && <div className="case-chat-message case-chat-message-assistant case-chat-thinking">Reviewing case records<span>…</span></div>}
      {error && <div className="case-chat-error">{error}</div>}
    </div>

    <form className="case-chat-composer" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask about this case…" disabled={loading} aria-label="Ask the case assistant" />
      <button type="submit" disabled={loading || !query.trim()} aria-label="Send question"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12 14-7-4 14-3.5-5.5L5 12Z" /><path d="m11.5 13.5 3-3" /></svg></button>
    </form>
  </section>;
}
