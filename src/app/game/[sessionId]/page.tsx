"use client";

import { use, useState, useEffect } from "react";
import GameBoard from "@/components/GameBoard";
import { useSearchParams } from "next/navigation";

export default function GamePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const searchParams = useSearchParams();
  const timeLimit = Number(searchParams.get("t")) || 180;
  const maxQuestions = Number(searchParams.get("q")) || 999;
  const cardId = searchParams.get("c") || undefined;
  const [cardNames, setCardNames] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("cardNames");
      if (stored) {
        setCardNames(JSON.parse(stored));
      }
    } catch {
      // sessionStorage unavailable
    }
  }, []);

  return (
    <main style={{ height: "100dvh", overflow: "hidden" }}>
      <div className="w-full h-full">
        <GameBoard
          sessionId={sessionId}
          timeLimitSeconds={timeLimit}
          maxQuestions={maxQuestions}
          cardId={cardId}
          cardNames={cardNames}
        />
      </div>
    </main>
  );
}
