// frontend/src/components/CaseAssistantWidget.tsx
import { useState } from "react";
import { answerQuestion, suggestedPrompts } from "../lib/caseAssistant";
import type { CopilotAnswer } from "../lib/caseAssistant";

export default function CaseAssistantWidget({ caseId }: { caseId: string }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CopilotAnswer | null>(null);

  // Make the handler async
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || !caseId) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Add 'await' here
      const answer = await answerQuestion(caseId, trimmed);
      setResult(answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get answer from Copilot");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="case-assistant-widget">
      <h3>Case Assistant</h3>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about this case..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !query.trim()}>
          {loading ? "Thinking..." : "Ask"}
        </button>
      </form>

      <div className="suggested-prompts">
        {suggestedPrompts.map((p) => (
          <button
            key={p}
            onClick={() => setQuery(p)}
            disabled={loading}
          >
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