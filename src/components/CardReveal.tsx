"use client";

import { useState } from "react";

interface CardData {
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
}

interface QuestionAnswer {
  question: string;
  answer: string;
}

interface CardRevealProps {
  correct: boolean;
  card: CardData;
  questionsAsked: number;
  gaveUp?: boolean;
  usedHint?: boolean;
  onPlayAgain: () => void;
  onVote: (vote: "fun" | "not_fun") => void;
  questions: QuestionAnswer[];
  cardId?: string;
  sessionId: string;
}

function buildShareText(
  questions: QuestionAnswer[],
  correct: boolean,
  gaveUp: boolean | undefined,
  questionsAsked: number,
  usedHint: boolean,
  challengeUrl?: string
): string {
  const result = correct
    ? `Got it in ${questionsAsked} Qs! ✅`
    : gaveUp
      ? `Gave up after ${questionsAsked} Qs ❌`
      : `Missed it after ${questionsAsked} Qs ❌`;

  const hintText = usedHint ? " (used a hint)" : "";
  let text = `MTG Guess the Card\n${result}${hintText}`;

  if (challengeUrl) {
    text += `\nCan you beat me? ${challengeUrl}`;
  }

  return text;
}

function buildTranscriptText(
  questions: QuestionAnswer[],
  correct: boolean,
  gaveUp: boolean | undefined,
  questionsAsked: number,
  usedHint: boolean
): string {
  const lines = questions.map((qa, i) => {
    const prefix = qa.question === "[Hint requested]" ? "Hint" : `Q${i + 1}`;
    return `${prefix}: ${qa.question === "[Hint requested]" ? qa.answer : `${qa.question} → ${qa.answer}`}`;
  });

  const result = correct
    ? `Got it in ${questionsAsked} Qs! ✅`
    : gaveUp
      ? `Gave up after ${questionsAsked} Qs ❌`
      : `Missed it after ${questionsAsked} Qs ❌`;

  const hintText = usedHint ? " (used a hint)" : "";

  return `MTG Guess the Card\n${lines.join("\n")}\n${result}${hintText}`;
}

export default function CardReveal({
  correct,
  card,
  questionsAsked,
  gaveUp,
  usedHint,
  onPlayAgain,
  onVote,
  questions,
  cardId,
  sessionId,
}: CardRevealProps) {
  const [voted, setVoted] = useState<"fun" | "not_fun" | null>(null);
  const [shareState, setShareState] = useState<
    "idle" | "loading" | "copied" | "shown"
  >("idle");
  const [shareText, setShareText] = useState("");
  const [transcriptCopied, setTranscriptCopied] = useState(false);

  const heading = correct
    ? "You got it!"
    : gaveUp
      ? "Better luck next time!"
      : "Not quite!";

  const headingColor = correct
    ? "text-[var(--success)]"
    : "text-[var(--error)]";

  function handleVote(vote: "fun" | "not_fun") {
    setVoted(vote);
    onVote(vote);
  }

  async function handleShare() {
    setShareState("loading");

    try {
      let challengeUrl: string | undefined;

      if (cardId) {
        // Create a challenge so friends can play the same card
        const res = await fetch("/api/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cardId,
            creatorSessionId: sessionId,
            creatorQuestions: questionsAsked,
            creatorCorrect: correct,
          }),
        });

        const data = await res.json();
        if (data.challengeId) {
          challengeUrl = `${window.location.origin}/play/${data.challengeId}`;
        }
      }

      const text = buildShareText(
        questions,
        correct,
        gaveUp,
        questionsAsked,
        !!usedHint,
        challengeUrl
      );

      // Always show the text, and try to copy automatically
      setShareText(text);
      setShareState("shown");
      try {
        await navigator.clipboard.writeText(text);
        setShareState("copied");
        setTimeout(() => setShareState("shown"), 3000);
      } catch {
        // Clipboard failed — user can copy manually
      }
    } catch {
      setShareState("idle");
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 animate-[fadeIn_0.5s_ease-in]">
      <div className={`text-3xl font-bold ${headingColor}`}>{heading}</div>

      <div className="text-center">
        <div className="text-xl font-semibold">{card.name}</div>
        <div className="text-[var(--text-secondary)] text-sm mt-1">
          {card.type_line} &bull; {card.set_name}
        </div>
        {questionsAsked > 0 && (
          <div className="text-[var(--text-secondary)] text-sm mt-1">
            {correct
              ? `Guessed in ${questionsAsked} question${questionsAsked !== 1 ? "s" : ""}`
              : `${questionsAsked} question${questionsAsked !== 1 ? "s" : ""} asked`}
          </div>
        )}
      </div>

      {card.image_uri_normal && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card.image_uri_normal}
            alt={card.name}
            className="rounded-xl shadow-2xl max-w-[300px] w-full"
          />
          <div className="text-xs text-[var(--text-secondary)] mt-2 text-center">
            Art by {card.artist}
          </div>
        </div>
      )}

      {/* Share */}
      {!shareText ? (
        <div className="flex gap-3">
          <button
            onClick={handleShare}
            className="bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text-primary)] font-medium py-2.5 px-6 rounded-xl transition-colors cursor-pointer"
          >
            {shareState === "loading" ? "Creating link..." : "Challenge a Friend"}
          </button>
          <button
            onClick={async () => {
              const text = buildTranscriptText(questions, correct, gaveUp, questionsAsked, !!usedHint);
              try {
                await navigator.clipboard.writeText(text);
                setTranscriptCopied(true);
                setTimeout(() => setTranscriptCopied(false), 3000);
              } catch {
                setShareText(text);
                setShareState("shown");
              }
            }}
            className="bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text-primary)] font-medium py-2.5 px-6 rounded-xl transition-colors cursor-pointer"
          >
            {transcriptCopied ? "Copied!" : "Share my Q&A"}
          </button>
        </div>
      ) : (
        <div className="w-full max-w-md space-y-2">
          <textarea
            readOnly
            value={shareText}
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-3 text-sm text-[var(--text-primary)] font-mono resize-none"
            rows={6}
          />
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareText);
                setShareState("copied");
                setTimeout(() => setShareState("idle"), 3000);
              } catch {
                // Select the text as fallback
                const textarea = document.querySelector("textarea");
                textarea?.select();
              }
            }}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium py-2 px-4 rounded-lg transition-colors cursor-pointer text-sm"
          >
            {shareState === "copied" ? "Copied!" : "Copy to Clipboard"}
          </button>
        </div>
      )}

      {/* Vote */}
      <div className="flex flex-col items-center gap-2">
        <div className="text-sm text-[var(--text-secondary)]">
          Was this card a good pick?
        </div>
        {voted ? (
          <div className="text-sm text-[var(--text-secondary)]">
            Thanks for the feedback!
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => handleVote("fun")}
              className="px-4 py-2 rounded-lg border border-[var(--border)] hover:border-[var(--success)] hover:text-[var(--success)] text-[var(--text-secondary)] transition-colors text-sm cursor-pointer"
            >
              Good card
            </button>
            <button
              onClick={() => handleVote("not_fun")}
              className="px-4 py-2 rounded-lg border border-[var(--border)] hover:border-[var(--error)] hover:text-[var(--error)] text-[var(--text-secondary)] transition-colors text-sm cursor-pointer"
            >
              Too obscure
            </button>
          </div>
        )}
      </div>

      <button
        onClick={onPlayAgain}
        className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-3 px-8 rounded-xl transition-colors text-lg cursor-pointer"
      >
        Play Again
      </button>
    </div>
  );
}
