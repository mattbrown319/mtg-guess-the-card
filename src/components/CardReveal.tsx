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
  onChangeSettings: () => void;
  onVote: (vote: "fun" | "not_fun") => void;
  questions: QuestionAnswer[];
  cardId?: string;
  sessionId: string;
  timeLimitSeconds?: number;
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

  const hintCount = questions.filter(qa => qa.question === "[Hint requested]").length;
  const hintText = hintCount > 1 ? ` (used ${hintCount} hints)` : hintCount === 1 ? " (used a hint)" : "";
  let text = `MTG Guess the Card\n${result}${hintText}`;

  if (challengeUrl) {
    text += `\nCan you beat me? ${challengeUrl}`;
  }

  return text;
}

function buildSummaryShareText(
  shareSummary: string,
  correct: boolean,
  gaveUp: boolean | undefined,
  questionsAsked: number,
  questions: QuestionAnswer[]
): string {
  const result = correct
    ? `Got it in ${questionsAsked} Qs! ✅`
    : gaveUp
      ? `Gave up after ${questionsAsked} Qs ❌`
      : `Missed it after ${questionsAsked} Qs ❌`;

  const hintCount = questions.filter(qa => qa.question === "[Hint requested]").length;
  const hintText = hintCount > 1 ? ` (used ${hintCount} hints)` : hintCount === 1 ? " (used a hint)" : "";

  return `MTG Guess the Card\n${result}${hintText}\nNarrowed to: ${shareSummary}`;
}

export default function CardReveal({
  correct,
  card,
  questionsAsked,
  gaveUp,
  usedHint,
  onPlayAgain,
  onChangeSettings,
  onVote,
  questions,
  cardId,
  sessionId,
  timeLimitSeconds,
}: CardRevealProps) {
  const [voted, setVoted] = useState<"fun" | "not_fun" | null>(null);
  const [initials, setInitials] = useState(() => {
    if (typeof document !== "undefined") {
      const cookie = document.cookie.split(";").find(c => c.trim().startsWith("player_initials="));
      return cookie ? cookie.split("=")[1].trim() : "";
    }
    return "";
  });
  const [initialsInput, setInitialsInput] = useState("");
  const [initialsSaved, setInitialsSaved] = useState(!!initials);
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
            timeLimit: timeLimitSeconds ?? 300,
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
    <div className="flex flex-col items-center gap-3 py-4">
      {/* Result + question count */}
      <div className="text-center">
        <div className={`text-2xl font-bold ${headingColor}`}>{heading}</div>
        {questionsAsked > 0 && (
          <div className="text-[var(--text-secondary)] text-sm mt-1">
            {correct
              ? `${questionsAsked} question${questionsAsked !== 1 ? "s" : ""}`
              : `${questionsAsked} question${questionsAsked !== 1 ? "s" : ""} asked`}
          </div>
        )}
      </div>

      {/* Initials prompt — only on wins, only if not already set */}
      {correct && !initialsSaved && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)]">Enter initials for leaderboard:</span>
          <input
            type="text"
            value={initialsInput}
            onChange={(e) => setInitialsInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
            placeholder="ABC"
            maxLength={4}
            className="w-16 bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1 text-center text-sm text-[var(--text-primary)] uppercase"
          />
          <button
            onClick={async () => {
              if (!initialsInput) return;
              try {
                await fetch("/api/initials", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ initials: initialsInput }),
                });
                setInitials(initialsInput);
                setInitialsSaved(true);
              } catch {}
            }}
            disabled={!initialsInput}
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-xs px-3 py-1 rounded cursor-pointer"
          >
            Save
          </button>
        </div>
      )}
      {correct && initialsSaved && initials && (
        <div className="text-xs text-[var(--text-secondary)]">
          Playing as <span className="font-bold text-[var(--accent)]">{initials}</span> &bull;{" "}
          <a href="/leaderboard" className="underline hover:text-[var(--accent)]">Leaderboard</a>
        </div>
      )}

      {/* Card image — the image contains name, type, set, artist */}
      {card.image_uri_normal && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.image_uri_normal}
          alt={card.name}
          className="rounded-xl shadow-2xl max-w-[250px] w-full"
        />
      )}

      {/* Action buttons — all visible without scrolling */}
      <div className="flex gap-2 w-full max-w-sm">
        <button
          onClick={onPlayAgain}
          className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-2.5 rounded-xl transition-colors cursor-pointer text-sm"
        >
          Play Again
        </button>
        <button
          onClick={handleShare}
          className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text-primary)] font-medium py-2.5 rounded-xl transition-colors cursor-pointer text-sm"
        >
          {shareState === "loading" ? "..." : "Challenge a Friend"}
        </button>
      </div>
      <button
        onClick={onChangeSettings}
        className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer"
      >
        Change settings
      </button>

      {/* Share text area (appears after clicking Challenge) */}
      {shareText && (
        <div className="w-full max-w-sm space-y-2">
          <textarea
            readOnly
            value={shareText}
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-3 text-xs text-[var(--text-primary)] font-mono resize-none"
            rows={4}
          />
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareText);
                setShareState("copied");
                setTimeout(() => setShareState("shown"), 3000);
              } catch {
                const textarea = document.querySelector("textarea");
                textarea?.select();
              }
            }}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium py-2 rounded-lg transition-colors cursor-pointer text-sm"
          >
            {shareState === "copied" ? "Copied!" : "Copy to Clipboard"}
          </button>
        </div>
      )}

      {/* Vote — compact inline */}
      {!voted ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)]">How was this card?</span>
          <button
            onClick={() => handleVote("fun")}
            className="px-3 py-1 rounded-lg border border-[var(--border)] hover:border-[var(--success)] hover:text-[var(--success)] text-[var(--text-secondary)] transition-colors text-xs cursor-pointer"
          >
            Good
          </button>
          <button
            onClick={() => handleVote("not_fun")}
            className="px-3 py-1 rounded-lg border border-[var(--border)] hover:border-[var(--error)] hover:text-[var(--error)] text-[var(--text-secondary)] transition-colors text-xs cursor-pointer"
          >
            Obscure
          </button>
        </div>
      ) : (
        <div className="text-xs text-[var(--text-secondary)]">Thanks!</div>
      )}

      {/* Feedback & Support */}
      <div className="flex gap-4">
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSfMW2_KF_votq1XMjx2aDvw1HrtpnLTSzoTycskg4rwhwVrmA/viewform"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
        >
          Feedback
        </a>
        <a
          href="https://buymeacoffee.com/mtgguessr"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
        >
          Support the game
        </a>
      </div>
    </div>
  );
}
