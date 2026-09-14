// frontend/src/components/CaseAssistantWidget.tsx
import { useState } from "react";
import { askQuestion, suggestedPrompts } from "../lib/caseAssistant";
import type { CopilotAnswer } from "../lib/caseAssistant";

export default function CaseAssistantWidget({ caseId }: { caseId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CopilotAnswer | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || !caseId) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const answer = await askQuestion(caseId, trimmed);
      setResult(answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get answer from Copilot");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        className="assistant-fab"
        onClick={() => setOpen(true)}
        aria-label="Open Case Assistant"
        title="Case Assistant"
      >
        {/* chat icon */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="case-assistant-widget">
      <div className="assistant-header">
        <h3>Case Assistant</h3>
        <button className="assistant-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
      </div>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about this case..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !query.trim()}>
          {loading ? "…" : "Ask"}
        </button>
      </form>

      <div className="suggested-prompts">
        {suggestedPrompts.map((p) => (
          <button key={p} onClick={() => setQuery(p)} disabled={loading}>
            {p}
          </button>
        ))}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {result && (
        <div className="copilot-result">
          <p>{result.answer}</p>
          {result.sources.length > 0 && (
            <div className="sources">
              <strong>Sources:</strong>
              <ul>
                {result.sources.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}