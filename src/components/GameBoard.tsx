"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Timer from "./Timer";
import QuestionInput from "./QuestionInput";
import GuessInput from "./GuessInput";
import CardReveal from "./CardReveal";

interface QuestionAnswer {
  question: string;
  answer: string;
}

interface RevealData {
  correct: boolean;
  card: {
    name: string;
    mana_cost: string | null;
    type_line: string;
    oracle_text: string | null;
    rarity: string;
    set_name: string;
    artist: string;
    image_uri_normal: string | null;
    colors: string[];
    keywords: string[];
    power: string | null;
    toughness: string | null;
  };
  questionsAsked: number;
  gaveUp?: boolean;
  elapsedSeconds?: number;
}

type Phase = "asking" | "guessing" | "revealed";

interface GameBoardProps {
  sessionId: string;
  timeLimitSeconds: number;
  maxQuestions: number;
  cardId?: string;
  cardNames?: string[];
}

export default function GameBoard({
  sessionId,
  timeLimitSeconds,
  cardId,
  cardNames,
}: GameBoardProps) {
  const [phase, setPhase] = useState<Phase>("asking");
  const [questions, setQuestions] = useState<QuestionAnswer[]>([]);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [thinkingMessage, setThinkingMessage] = useState("");
  const [guessLoading, setGuessLoading] = useState(false);
  const [reveal, setReveal] = useState<RevealData | null>(null);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [startedAt] = useState(Date.now());
  const qaContainerRef = useRef<HTMLDivElement>(null);

  // Scroll Q&A to bottom when new content arrives
  useEffect(() => {
    if (qaContainerRef.current) {
      qaContainerRef.current.scrollTop = qaContainerRef.current.scrollHeight;
    }
  }, [questions, hint]);

  // Re-scroll when keyboard opens/closes (viewport resize)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => {
      if (qaContainerRef.current) {
        qaContainerRef.current.scrollTop = qaContainerRef.current.scrollHeight;
      }
    };
    vv.addEventListener("resize", handleResize);
    return () => vv.removeEventListener("resize", handleResize);
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/question-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, requestSummary: true }),
      });
      const data = await res.json();
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err) {
      console.error("Failed to fetch summary:", err);
    }
  }, [sessionId]);

  const transitionToGuessing = useCallback(() => {
    setPhase("guessing");
    fetchSummary();
  }, [fetchSummary]);

  const handleExpire = useCallback(() => {
    if (phase === "asking") {
      transitionToGuessing();
    }
  }, [phase, transitionToGuessing]);

  async function handleAsk(question: string) {
    setQuestionLoading(true);
    setThinkingMessage("");
    setError("");

    // Show escalating thinking messages
    const thinkingTimer = setTimeout(() => setThinkingMessage("Hmm... that's a hard question..."), 5000);
    const timeoutTimer = setTimeout(() => {
      setThinkingMessage("");
      setQuestionLoading(false);
      setQuestions((prev) => [
        ...prev,
        { question, answer: "Wait, what was the question again? Try asking again." },
      ]);
    }, 20000);

    try {
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 19000);

      const res = await fetch("/api/question-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, question, elapsedSeconds: Math.round((Date.now() - startedAt) / 1000) }),
        signal: controller.signal,
      });

      clearTimeout(fetchTimeout);
      clearTimeout(thinkingTimer);
      clearTimeout(timeoutTimer);
      setThinkingMessage("");

      const data = await res.json();

      if (!res.ok) {
        if (data.expired) {
          setPhase("guessing");
        } else {
          setError(data.error || "Failed to ask question");
        }
        return;
      }

      setQuestions((prev) => [
        ...prev,
        { question, answer: data.answer },
      ]);

      if (data.correctGuess) {
        setReveal({
          correct: true,
          card: data.card,
          questionsAsked: data.questionNumber,
          elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
        });
        setPhase("revealed");
        return;
      }

      if (data.questionsRemaining === 0) {
        transitionToGuessing();
      }
    } catch (err) {
      clearTimeout(thinkingTimer);
      clearTimeout(timeoutTimer);
      setThinkingMessage("");
      if (err instanceof DOMException && err.name === "AbortError") {
        // Timeout already handled above
        return;
      }
      console.error("Question fetch error:", err);
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setQuestionLoading(false);
    }
  }

  async function handleHint() {
    setQuestionLoading(true);
    try {
      const res = await fetch("/api/question-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, requestHint: true }),
      });
      const data = await res.json();
      if (data.hint) {
        setHint(data.hint);
      }
    } catch {
      // Silently fail on hint request
    } finally {
      setQuestionLoading(false);
    }
  }

  async function handleGuess(cardName: string) {
    setGuessLoading(true);
    setError("");

    try {
      const res = await fetch("/api/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, cardName, elapsedSeconds: Math.round((Date.now() - startedAt) / 1000) }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to submit guess");
        return;
      }

      setReveal({ ...data, elapsedSeconds: Math.round((Date.now() - startedAt) / 1000) });
      setPhase("revealed");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setGuessLoading(false);
    }
  }

  async function handleGiveUp() {
    setGuessLoading(true);
    setError("");
    try {
      const res = await fetch("/api/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, giveUp: true, elapsedSeconds: Math.round((Date.now() - startedAt) / 1000) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to give up");
        return;
      }
      setReveal({ ...data, gaveUp: true, elapsedSeconds: Math.round((Date.now() - startedAt) / 1000) });
      setPhase("revealed");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setGuessLoading(false);
    }
  }

  async function handleVote(vote: "fun" | "not_fun") {
    try {
      await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, vote }),
      });
    } catch {
      // Best effort
    }
  }

  async function handlePlayAgain() {
    try {
      const stored = sessionStorage.getItem("gameSettings");
      if (!stored) {
        window.location.href = "/";
        return;
      }
      const settings = JSON.parse(stored);
      const excludeNames = JSON.parse(localStorage.getItem("recentCardNames") || "[]");

      const res = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, excludeNames: excludeNames.length > 0 ? excludeNames : undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        window.location.href = "/";
        return;
      }

      if (data.cardName) {
        const recent = excludeNames;
        if (!recent.includes(data.cardName)) recent.unshift(data.cardName);
        localStorage.setItem("recentCardNames", JSON.stringify(recent.slice(0, 50)));
      }
      if (data.cardNames) {
        sessionStorage.setItem("cardNames", JSON.stringify(data.cardNames));
      }

      window.location.href = `/game/${data.sessionId}?t=${settings.timeLimitSeconds ?? 300}&q=${data.maxQuestions}&c=${data.cardId}`;
    } catch {
      window.location.href = "/";
    }
  }

  function handleChangeSettings() {
    window.location.href = "/";
  }

  if (phase === "revealed" && reveal) {
    return (
      <div className="p-4 max-w-2xl mx-auto overflow-y-auto" style={{ height: "100dvh" }}>
        <CardReveal
          correct={reveal.correct}
          card={reveal.card}
          questionsAsked={reveal.questionsAsked}
          gaveUp={reveal.gaveUp}
          usedHint={!!hint}
          elapsedSeconds={reveal.elapsedSeconds}
          onPlayAgain={handlePlayAgain}
          onChangeSettings={handleChangeSettings}
          onVote={handleVote}
          questions={questions}
          cardId={cardId}
          sessionId={sessionId}
          timeLimitSeconds={timeLimitSeconds}
        />
      </div>
    );
  }

  // Everything in one flex column, no fixed positioning
  return (
    <div
      className="flex flex-col max-w-2xl mx-auto"
      style={{ height: "100dvh" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] shrink-0">
        <Timer
          startedAt={startedAt}
          timeLimitSeconds={timeLimitSeconds}
          paused={questionLoading}
          onExpire={handleExpire}
        />
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--text-secondary)]">
            Qs: {questions.length}
          </span>
          <button
            onClick={handleGiveUp}
            disabled={guessLoading}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--error)] disabled:opacity-50 cursor-pointer"
          >
            Give up
          </button>
        </div>
      </div>

      {/* Q&A area — grows to fill available space, scrolls internally */}
      <div ref={qaContainerRef} className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
        {questions.length === 0 && (
          <div className="text-[var(--text-secondary)] text-center py-3">
            <p className="text-base mb-1">A mystery card has been chosen!</p>
            <p className="text-sm">Ask yes/no questions to narrow it down.</p>
            <p className="text-sm mt-1">When you know it, ask &ldquo;Is it [card name]?&rdquo;</p>
          </div>
        )}

        {questions.length > 0 && (
          <div className="space-y-3">
            {questions.map((qa, i) => (
              <div key={i} className="space-y-1">
                <div className="flex gap-2">
                  <span className="text-[var(--accent)] font-medium shrink-0 text-sm">Q{i + 1}:</span>
                  <span className="text-sm">{qa.question}</span>
                </div>
                <div className="flex gap-2 pl-2">
                  <span className="text-[var(--text-secondary)] shrink-0 text-sm">&rarr;</span>
                  <span className="text-[var(--text-secondary)] text-sm">{qa.answer}</span>
                </div>
              </div>
            ))}

            {thinkingMessage && (
              <div className="text-sm text-[var(--text-secondary)] italic animate-pulse">
                {thinkingMessage}
              </div>
            )}

            {hint && (
              <div className="pl-2 text-sm">
                <span className="text-[var(--warning)] font-medium">Hint: </span>
                <span className="text-[var(--text-secondary)]">{hint}</span>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-[var(--error)] text-sm text-center mt-2">{error}</p>
        )}
      </div>

      {/* Input area — always at bottom, never fixed, part of the flex flow */}
      <div className="border-t border-[var(--border)] px-4 py-3 shrink-0">
        {phase === "asking" && (
          <div className="space-y-2">
            <QuestionInput
              onAsk={handleAsk}
              disabled={false}
              loading={questionLoading}
            />
            {questions.length >= 5 && (
              <div className="flex justify-center">
                <button
                  onClick={handleHint}
                  disabled={questionLoading}
                  className="text-xs text-[var(--warning)] hover:opacity-80 disabled:opacity-50 cursor-pointer py-1"
                >
                  Hint
                </button>
              </div>
            )}
          </div>
        )}

        {phase === "guessing" && (
          <div className="space-y-2">
            <div className="text-center text-[var(--warning)] font-medium text-sm">
              Time&apos;s up! Make your guess
            </div>
            <GuessInput
              onGuess={handleGuess}
              disabled={false}
              loading={guessLoading}
              cardNames={cardNames}
            />
            <button
              onClick={handleGiveUp}
              disabled={guessLoading}
              className="w-full text-xs text-[var(--text-secondary)] hover:text-[var(--error)] disabled:opacity-50 cursor-pointer py-1"
            >
              Give up — show me the card
            </button>

            {summary ? (
              <div className="bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--border)]">
                <div className="text-xs font-medium text-[var(--accent)] mb-1">What you know:</div>
                <div className="text-xs text-[var(--text-secondary)] whitespace-pre-line">{summary}</div>
              </div>
            ) : questions.length > 0 ? (
              <div className="text-xs text-[var(--text-secondary)] text-center">Generating summary...</div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
