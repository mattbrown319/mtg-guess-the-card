"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const FORMATS = [
  { value: "", label: "Any Format" },
  { value: "commander", label: "Commander / EDH" },
  { value: "modern", label: "Modern" },
  { value: "standard", label: "Standard" },
  { value: "pioneer", label: "Pioneer" },
  { value: "legacy", label: "Legacy" },
  { value: "vintage", label: "Vintage" },
  { value: "pauper", label: "Pauper" },
];

const POPULARITY_TIERS = [
  { value: "popular", label: "Well-Known Cards (844)" },
  { value: "all", label: "All Cards — Expert (33,000+)" },
];

const CARD_TYPES = [
  { value: "", label: "Any Type" },
  { value: "Creature", label: "Creature" },
  { value: "Instant", label: "Instant" },
  { value: "Sorcery", label: "Sorcery" },
  { value: "Enchantment", label: "Enchantment" },
  { value: "Artifact", label: "Artifact" },
  { value: "Planeswalker", label: "Planeswalker" },
  { value: "Land", label: "Land" },
];

const TIME_LIMITS = [
  { value: 120, label: "2 minutes" },
  { value: 180, label: "3 minutes" },
  { value: 300, label: "5 minutes" },
  { value: 600, label: "10 minutes" },
  { value: 1200, label: "20 minutes" },
  { value: 0, label: "No limit" },
];

export default function Home() {
  const router = useRouter();
  const [format, setFormat] = useState("");
  const [popularityTier, setPopularityTier] = useState("popular");
  const [cardType, setCardType] = useState("");
  const [timeLimit, setTimeLimit] = useState(300);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function getRecentCardNames(): string[] {
    try {
      const stored = localStorage.getItem("recentCardNames");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  function addRecentCardName(name: string) {
    try {
      const recent = getRecentCardNames();
      if (!recent.includes(name)) {
        recent.unshift(name);
      }
      localStorage.setItem("recentCardNames", JSON.stringify(recent.slice(0, 50)));
    } catch {
      // localStorage unavailable
    }
  }

  async function startGame() {
    setLoading(true);
    setError("");

    try {
      const excludeNames = getRecentCardNames();

      const res = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: format || undefined,
          popularityTier: popularityTier || undefined,
          cardType: cardType || undefined,
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
        addRecentCardName(data.cardName);
      }

      // Store game settings for "Play Again"
      try {
        sessionStorage.setItem("gameSettings", JSON.stringify({
          format: format || undefined,
          popularityTier: popularityTier || undefined,
          cardType: cardType || undefined,
          timeLimitSeconds: timeLimit || undefined,
        }));
      } catch {}

      // Store card names in sessionStorage for client-side autocomplete
      if (data.cardNames) {
        try {
          sessionStorage.setItem("cardNames", JSON.stringify(data.cardNames));
        } catch {
          // Storage full or unavailable
        }
      }

      router.push(`/game/${data.sessionId}?t=${timeLimit}&q=${data.maxQuestions}&c=${data.cardId}`);
    } catch {
      setError("Something went wrong. Is the card database imported?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">
            Guess the Card
          </h1>
          <p className="text-[var(--text-secondary)]">
            Ask yes/no questions to identify the mystery Magic: The Gathering
            card
          </p>
        </div>

        <div className="space-y-4 bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--border)]">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--text-secondary)]">
              Format
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            >
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

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
              Card Type
            </label>
            <select
              value={cardType}
              onChange={(e) => setCardType(e.target.value)}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            >
              {CARD_TYPES.map((t) => (
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
          href="/create"
          className="w-full block text-center bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text-primary)] font-medium py-3 px-6 rounded-xl transition-colors"
        >
          Challenge a Friend with a Specific Card
        </a>
        <div className="text-center text-xs text-[var(--text-secondary)] pt-4 opacity-60">
          Card data from <a href="https://scryfall.com" className="underline" target="_blank" rel="noopener noreferrer">Scryfall</a>. Popularity data from <a href="https://cubecobra.com" className="underline" target="_blank" rel="noopener noreferrer">CubeCobra</a>. Not affiliated with Wizards of the Coast. &bull; v0.33
        </div>
      </div>
    </main>
  );
}
