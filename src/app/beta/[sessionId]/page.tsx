"use client";

import { use, useState, useEffect } from "react";
import BetaGameBoard from "@/components/BetaGameBoard";
import { useSearchParams } from "next/navigation";

export default function BetaGamePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const searchParams = useSearchParams();
  const timeLimit = searchParams.get("t") !== null ? Number(searchParams.get("t")) : 300;
  const maxQuestions = Number(searchParams.get("q")) || 999;
  const cardId = searchParams.get("c") || undefined;
  const [cardNames, setCardNames] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("cardNames");
      if (stored) setCardNames(JSON.parse(stored));
    } catch {}
  }, []);

  return (
    <main style={{ height: "100dvh", overflow: "hidden" }}>
      <div className="w-full h-full">
        <BetaGameBoard
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
