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
  const [guessLoading, setGuessLoading] = useState(false);
  const [reveal, setReveal] = useState<RevealData | null>(null);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [startedAt] = useState(Date.now());
  const qaEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    qaEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [questions]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, requestSummary: true }),
      });
      const data = await res.json();
      if (data.summary) {
        setSummary(data.summary);
      } else {
        console.error("Summary response missing summary field:", data);
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
    setError("");

    try {
      const res = await fetch("/api/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, question }),
      });

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

      if (data.questionsRemaining === 0) {
        transitionToGuessing();
      }
    } catch (err) {
      console.error("Question fetch error:", err);
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setQuestionLoading(false);
    }
  }

  async function handleHint() {
    setQuestionLoading(true);
    try {
      const res = await fetch("/api/question", {
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
        body: JSON.stringify({ sessionId, cardName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to submit guess");
        return;
      }

      setReveal(data);
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
        body: JSON.stringify({ sessionId, giveUp: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to give up");
        return;
      }
      setReveal({ ...data, gaveUp: true });
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

  function handlePlayAgain() {
    window.location.href = "/";
  }

  if (phase === "revealed" && reveal) {
    return (
      <CardReveal
        correct={reveal.correct}
        card={reveal.card}
        questionsAsked={reveal.questionsAsked}
        gaveUp={reveal.gaveUp}
        usedHint={!!hint}
        onPlayAgain={handlePlayAgain}
        onVote={handleVote}
        questions={questions}
        cardId={cardId}
        sessionId={sessionId}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto">
      {/* Header: Timer + Stats */}
      <div className="flex items-center justify-between bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)]">
        <Timer
          startedAt={startedAt}
          timeLimitSeconds={timeLimitSeconds}
          onExpire={handleExpire}
        />
        <div className="text-right">
          <div className="text-sm text-[var(--text-secondary)]">
            Questions: {questions.length}
          </div>
          {phase === "asking" && (
            <button
              onClick={transitionToGuessing}
              className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] mt-1 cursor-pointer"
            >
              Ready to guess &rarr;
            </button>
          )}
        </div>
      </div>

      {/* Q&A History */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
        {questions.length === 0 ? (
          <div className="text-[var(--text-secondary)] text-center py-8">
            <p className="text-lg mb-2">A mystery card has been chosen!</p>
            <p className="text-sm">
              Ask yes/no questions to narrow it down. Try starting with:
              &ldquo;Is it a creature?&rdquo; or &ldquo;Is it monocolor?&rdquo;
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((qa, i) => (
              <div key={i} className="space-y-1">
                <div className="flex gap-2">
                  <span className="text-[var(--accent)] font-medium shrink-0">
                    Q{i + 1}:
                  </span>
                  <span>{qa.question}</span>
                </div>
                <div className="flex gap-2 pl-2">
                  <span className="text-[var(--text-secondary)] shrink-0">
                    &rarr;
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    {qa.answer}
                  </span>
                </div>
                {/* Nudge after the last answer if it was a "Yes" */}
                {phase === "asking" && i === questions.length - 1 && qa.answer.trim().toLowerCase().startsWith("yes") && (
                  <button
                    onClick={transitionToGuessing}
                    className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] pl-6 cursor-pointer"
                  >
                    Think you know it? Make your guess &rarr;
                  </button>
                )}
              </div>
            ))}
            <div ref={qaEndRef} />
          </div>
        )}
      </div>

      {/* Hint */}
      {hint && (
        <div className="bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--warning)] text-sm">
          <span className="text-[var(--warning)] font-medium">Hint: </span>
          {hint}
        </div>
      )}

      {/* Input area */}
      {phase === "asking" && (
        <div className="space-y-2">
          <QuestionInput
            onAsk={handleAsk}
            disabled={false}
            loading={questionLoading}
          />
          <div className="flex gap-2 justify-between">
            <div>
              {questions.length >= 5 && (
                <button
                  onClick={handleHint}
                  disabled={questionLoading}
                  className="text-sm text-[var(--warning)] hover:opacity-80 disabled:opacity-50 cursor-pointer"
                >
                  Need a hint?
                </button>
              )}
            </div>
            <button
              onClick={handleGiveUp}
              disabled={guessLoading}
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--error)] disabled:opacity-50 cursor-pointer"
            >
              Give up
            </button>
          </div>
        </div>
      )}

      {phase === "guessing" && (
        <div className="space-y-3">
          <div className="text-center text-[var(--warning)] font-medium">
            Time to guess!
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
            className="w-full text-sm text-[var(--text-secondary)] hover:text-[var(--error)] disabled:opacity-50 cursor-pointer py-1"
          >
            Give up — show me the card
          </button>

          {/* Summary of what you know — loads below input so no layout shift */}
          {summary ? (
            <div className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border)]">
              <div className="text-sm font-medium text-[var(--accent)] mb-2">
                What you know:
              </div>
              <div className="text-sm text-[var(--text-secondary)] whitespace-pre-line">
                {summary}
              </div>
            </div>
          ) : questions.length > 0 ? (
            <div className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border)] text-sm text-[var(--text-secondary)] text-center">
              Generating summary...
            </div>
          ) : null}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-[var(--error)] text-sm text-center">{error}</p>
      )}
    </div>
  );
}
