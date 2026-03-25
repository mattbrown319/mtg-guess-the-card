"use client";

import { useState, useRef, useEffect } from "react";

interface QuestionInputProps {
  onAsk: (question: string) => Promise<void>;
  disabled: boolean;
  loading: boolean;
}

export default function QuestionInput({
  onAsk,
  disabled,
  loading,
}: QuestionInputProps) {
  const [question, setQuestion] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Only auto-focus on desktop — on mobile the keyboard pop-up disrupts the layout
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (!disabled && !loading && !isMobile) {
      inputRef.current?.focus();
    }
  }, [disabled, loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || disabled || loading) return;
    const q = question.trim();
    setQuestion("");
    await onAsk(q);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        ref={inputRef}
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask a yes/no question..."
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        disabled={disabled || loading}
        className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={!question.trim() || disabled || loading}
        className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
      >
        {loading ? "..." : "Ask"}
      </button>
    </form>
  );
}
