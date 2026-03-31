"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const POPULARITY_TIERS = [
  { value: "popular", label: "Well-Known Cards (1,000)" },
  { value: "all", label: "All Cards — Expert (33,000+)" },
];

const TIME_LIMITS = [
  { value: 120, label: "2 minutes" },
  { value: 180, label: "3 minutes" },
  { value: 300, label: "5 minutes" },
  { value: 600, label: "10 minutes" },
  { value: 1200, label: "20 minutes" },
  { value: 0, label: "No limit" },
];

export default function BetaHome() {
  const router = useRouter();
  const [popularityTier, setPopularityTier] = useState("popular");
  const [timeLimit, setTimeLimit] = useState(300);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startGame() {
    setLoading(true);
    setError("");

    try {
      const excludeNames = (() => {
        try {
          const stored = localStorage.getItem("recentCardNames");
          return stored ? JSON.parse(stored) : [];
        } catch { return []; }
      })();

      const res = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          popularityTier,
          timeLimitSeconds: timeLimit || undefined,
          excludeNames: excludeNames.length > 0 ? excludeNames : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start game");
        return;
      }

      if (data.cardName) {
        try {
          const recent = excludeNames;
          if (!recent.includes(data.cardName)) recent.unshift(data.cardName);
          localStorage.setItem("recentCardNames", JSON.stringify(recent.slice(0, 50)));
        } catch {}
      }

      try {
        sessionStorage.setItem("gameSettings", JSON.stringify({
          popularityTier,
          timeLimitSeconds: timeLimit || undefined,
        }));
        if (data.cardNames) {
          sessionStorage.setItem("cardNames", JSON.stringify(data.cardNames));
        }
      } catch {}

      router.push(`/beta/${data.sessionId}?t=${timeLimit}&q=${data.maxQuestions}&c=${data.cardId}`);
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-4xl font-bold tracking-tight">
              Guess the Card
            </h1>
            <span className="text-xs bg-[var(--accent)] text-white px-2 py-0.5 rounded-full font-medium">
              BETA
            </span>
          </div>
          <p className="text-[var(--text-secondary)]">
            Watch the card fill in as you discover its attributes!
          </p>
        </div>

        <div className="space-y-4 bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--border)]">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--text-secondary)]">
              Difficulty
            </label>
            <select
              value={popularityTier}
              onChange={(e) => setPopularityTier(e.target.value)}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            >
              {POPULARITY_TIERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--text-secondary)]">
              Time Limit
            </label>
            <select
              value={timeLimit}
              onChange={(e) => setTimeLimit(Number(e.target.value))}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            >
              {TIME_LIMITS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className="text-[var(--error)] text-sm text-center">{error}</p>
        )}

        <button
          onClick={startGame}
          disabled={loading}
          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-xl transition-colors text-lg cursor-pointer"
        >
          {loading ? "Starting..." : "Start Game"}
        </button>

        <a
          href="/"
          className="block text-center text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
        >
          &larr; Back to classic mode
        </a>
        <div className="text-center text-xs text-[var(--text-secondary)] pt-2 opacity-60">
          v0.42-beta
        </div>
      </div>
    </main>
  );
}
