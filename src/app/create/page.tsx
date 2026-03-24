"use client";

import { useState, useRef } from "react";

interface CardResult {
  id: string;
  name: string;
  typeLine: string;
  setName: string;
  imageUrl: string;
}

export default function CreateChallenge() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CardResult[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardResult | null>(null);
  const [challengeUrl, setChallengeUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  function handleSearch(value: string) {
    setQuery(value);
    setSelectedCard(null);
    setChallengeUrl("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setResults(data.cards || []);
      } catch {
        setResults([]);
      }
    }, 200);
  }

  function handleSelect(card: CardResult) {
    setSelectedCard(card);
    setQuery(card.name);
    setResults([]);
  }

  async function handleCreate() {
    if (!selectedCard) return;
    setCreating(true);

    try {
      const res = await fetch("/api/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: selectedCard.id }),
      });
      const data = await res.json();
      if (data.challengeId) {
        setChallengeUrl(
          `${window.location.origin}/play/${data.challengeId}`
        );
      }
    } catch {
      // Failed
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(challengeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const input = document.querySelector<HTMLInputElement>("#challenge-url");
      input?.select();
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-6 pt-16">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Create a Challenge</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            Pick a card and send the link to a friend. Can they guess it?
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search for a card..."
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
          />
          {results.length > 0 && !selectedCard && (
            <ul className="absolute z-10 w-full mt-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg overflow-hidden shadow-lg max-h-80 overflow-y-auto">
              {results.map((card) => (
                <li
                  key={card.id}
                  onClick={() => handleSelect(card)}
                  className="px-4 py-3 cursor-pointer hover:bg-[var(--bg-secondary)] border-b border-[var(--border)] last:border-b-0"
                >
                  <div className="text-sm font-medium text-[var(--text-primary)]">
                    {card.name}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {card.typeLine} &bull; {card.setName}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Selected card preview */}
        {selectedCard && !challengeUrl && (
          <div className="flex flex-col items-center gap-4">
            {selectedCard.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedCard.imageUrl}
                alt={selectedCard.name}
                className="rounded-xl shadow-lg max-w-[250px] w-full"
              />
            )}
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-xl transition-colors cursor-pointer"
            >
              {creating ? "Creating..." : "Create Challenge"}
            </button>
          </div>
        )}

        {/* Challenge URL */}
        {challengeUrl && (
          <div className="space-y-3">
            <div className="text-center text-[var(--success)] font-medium">
              Challenge created!
            </div>
            {selectedCard?.imageUrl && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedCard.imageUrl}
                  alt={selectedCard?.name || ""}
                  className="rounded-xl shadow-lg max-w-[200px] w-full opacity-50"
                />
              </div>
            )}
            <p className="text-sm text-[var(--text-secondary)] text-center">
              Send this link — your friend won&apos;t see the card!
            </p>
            <div className="flex gap-2">
              <input
                id="challenge-url"
                type="text"
                readOnly
                value={challengeUrl}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] font-mono"
              />
              <button
                onClick={handleCopy}
                className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium px-4 py-2.5 rounded-lg transition-colors cursor-pointer text-sm"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => {
                  setSelectedCard(null);
                  setQuery("");
                  setChallengeUrl("");
                }}
                className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] cursor-pointer"
              >
                Create another
              </button>
              <a
                href="/"
                className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Back to game
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
