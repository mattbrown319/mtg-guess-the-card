"use client";

import { useState, useRef, useEffect } from "react";

interface GuessInputProps {
  onGuess: (cardName: string) => Promise<void>;
  disabled: boolean;
  loading: boolean;
  cardNames?: string[];
}

export default function GuessInput({
  onGuess,
  disabled,
  loading,
  cardNames,
}: GuessInputProps) {
  const [guess, setGuess] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!disabled && !loading) {
      inputRef.current?.focus();
    }
  }, [disabled, loading]);

  function filterLocal(query: string) {
    if (query.length < 2 || !cardNames) {
      setSuggestions([]);
      return;
    }
    const lower = query.toLowerCase();
    const matches = cardNames
      .filter((name) => name.toLowerCase().includes(lower))
      .slice(0, 10);
    setSuggestions(matches);
    setShowSuggestions(true);
    setSelectedIndex(-1);
  }

  async function fetchSuggestions(query: string) {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/autocomplete?q=${encodeURIComponent(query)}`
      );
      const data = await res.json();
      setSuggestions(data.names || []);
      setShowSuggestions(true);
      setSelectedIndex(-1);
    } catch {
      setSuggestions([]);
    }
  }

  function handleChange(value: string) {
    setGuess(value);
    if (cardNames) {
      // Client-side filtering — instant
      filterLocal(value);
    } else {
      // Fallback to server-side
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchSuggestions(value), 200);
    }
  }

  function handleSelect(name: string) {
    setGuess(name);
    setShowSuggestions(false);
    setSuggestions([]);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guess.trim() || disabled || loading) return;
    setShowSuggestions(false);
    await onGuess(guess.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={guess}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Type your guess..."
            disabled={disabled || loading}
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-10 w-full mt-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg overflow-hidden shadow-lg max-h-60 overflow-y-auto">
              {suggestions.map((name, i) => (
                <li
                  key={name}
                  onMouseDown={() => handleSelect(name)}
                  className={`px-4 py-2 cursor-pointer text-sm ${
                    i === selectedIndex
                      ? "bg-[var(--accent)] text-white"
                      : "hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                  }`}
                >
                  {name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="submit"
          disabled={!guess.trim() || disabled || loading}
          className="bg-[var(--success)] hover:opacity-90 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors cursor-pointer"
        >
          {loading ? "..." : "Guess!"}
        </button>
      </div>
    </form>
  );
}
