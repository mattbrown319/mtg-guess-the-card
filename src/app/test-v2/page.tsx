"use client";

import { useState, useEffect } from "react";

export default function TestV2() {
  const [sessionId, setSessionId] = useState("");
  const [question, setQuestion] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [cardName, setCardName] = useState("???");
  const [engineVersion, setEngineVersion] = useState("loading...");

  useEffect(() => {
    fetch("/api/version").then(r => r.json()).then(d => setEngineVersion(d.engineVersion)).catch(() => setEngineVersion("unknown"));
  }, []);

  async function startGame() {
    setLoading(true);
    try {
      const res = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ popularityTier: "popular" }),
      });
      const data = await res.json();
      setSessionId(data.sessionId);
      setCardName("(hidden)");
      setLog(prev => [...prev, `--- New game started (session: ${data.sessionId.slice(0, 8)}...) ---`]);
    } catch (e) {
      setLog(prev => [...prev, `ERROR starting game: ${e}`]);
    } finally {
      setLoading(false);
    }
  }

  async function askQuestion() {
    if (!sessionId || !question.trim()) return;
    setLoading(true);
    const q = question.trim();
    setQuestion("");

    try {
      const res = await fetch("/api/question-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, question: q }),
      });
      const data = await res.json();

      if (data.engineVersion && !engineVersion) setEngineVersion(data.engineVersion);

      if (data.error) {
        setLog(prev => [...prev, `Q: "${q}" → ERROR: ${data.error}`]);
      } else if (data.notCounted) {
        setLog(prev => [...prev, `Q: "${q}" → REFUND: ${data.answer} (reason: ${data.reasonCode || "?"})`]);
      } else if (data.correctGuess) {
        setCardName(data.card.name);
        setLog(prev => [...prev, `Q: "${q}" → ${data.answer} 🎉 CORRECT! Card was: ${data.card.name}`]);
      } else {
        setLog(prev => [...prev, `Q: "${q}" → ${data.answer}`]);
      }
    } catch (e) {
      setLog(prev => [...prev, `Q: "${q}" → FETCH ERROR: ${e}`]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Query Engine v2 Test</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        This page uses /api/question-v2 (structured query engine) instead of /api/question (direct LLM).
        <br />Card: <strong>{cardName}</strong>
        {<> | Engine: <strong>v{engineVersion}</strong></>}
      </p>

      {!sessionId ? (
        <button
          onClick={startGame}
          disabled={loading}
          className="bg-[var(--accent)] text-white px-4 py-2 rounded-lg cursor-pointer disabled:opacity-50"
        >
          {loading ? "Starting..." : "Start Game"}
        </button>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); askQuestion(); }} className="flex gap-2 mb-4">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a yes/no question..."
            autoComplete="off"
            autoCorrect="off"
            className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="bg-[var(--accent)] text-white px-4 py-2 rounded-lg cursor-pointer disabled:opacity-50 text-sm"
          >
            {loading ? "..." : "Ask"}
          </button>
        </form>
      )}

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 mt-4 max-h-[600px] overflow-y-auto">
        {log.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Start a game to test the v2 query engine.</p>
        ) : (
          <div className="space-y-1 font-mono text-xs">
            {log.map((line, i) => (
              <div key={i} className={
                line.includes("ERROR") ? "text-[var(--error)]" :
                line.includes("REFUND") ? "text-[var(--warning)]" :
                line.includes("CORRECT") ? "text-[var(--success)]" :
                line.startsWith("---") ? "text-[var(--text-secondary)]" :
                "text-[var(--text-primary)]"
              }>
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
