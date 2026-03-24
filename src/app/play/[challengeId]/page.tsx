"use client";

import { use, useEffect, useState } from "react";
import GameBoard from "@/components/GameBoard";

export default function ChallengePage({
  params,
}: {
  params: Promise<{ challengeId: string }>;
}) {
  const { challengeId } = use(params);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(180);
  const [error, setError] = useState("");
  const [creatorInfo, setCreatorInfo] = useState<{
    questions: number;
    correct: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadChallenge() {
      try {
        // Look up the challenge to get the card ID
        const challengeRes = await fetch(
          `/api/challenge?id=${encodeURIComponent(challengeId)}`
        );
        const challengeData = await challengeRes.json();

        if (!challengeRes.ok) {
          setError(challengeData.error || "Challenge not found");
          setLoading(false);
          return;
        }

        setCreatorInfo({
          questions: challengeData.creatorQuestions,
          correct: challengeData.creatorCorrect,
        });

        // Start a game with that specific card
        const gameRes = await fetch("/api/game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cardId: challengeData.cardId,
            timeLimitSeconds: challengeData.timeLimit || 180,
          }),
        });

        const gameData = await gameRes.json();

        if (!gameRes.ok) {
          setError(gameData.error || "Failed to start challenge");
          setLoading(false);
          return;
        }

        setSessionId(gameData.sessionId);
        setTimeLimitSeconds(gameData.timeLimitSeconds);
      } catch {
        setError("Failed to load challenge");
      } finally {
        setLoading(false);
      }
    }

    loadChallenge();
  }, [challengeId]);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="text-[var(--text-secondary)]">
          Loading challenge...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="text-[var(--error)]">{error}</div>
        <a href="/" className="text-[var(--accent)] mt-4 hover:underline">
          Play a random card instead
        </a>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-6 pt-12">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-center mb-2">
          Guess the Card
        </h1>
        {creatorInfo && (
          <p className="text-center text-sm text-[var(--text-secondary)] mb-6">
            Challenge! Your friend {creatorInfo.correct ? `got it in ${creatorInfo.questions} questions` : `couldn't get it in ${creatorInfo.questions} questions`}. Can you do better?
          </p>
        )}
        {sessionId && (
          <GameBoard
            sessionId={sessionId}
            timeLimitSeconds={timeLimitSeconds}
            maxQuestions={999}
          />
        )}
      </div>
    </main>
  );
}
