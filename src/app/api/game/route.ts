import { NextRequest, NextResponse } from "next/server";
import { getRandomCard, getCardCount, getCardById, getAllCardNames } from "@/lib/cards";
import { createGame } from "@/lib/game-store";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const { allowed } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const { format, popularityTier, cardType, timeLimitSeconds, cardId, excludeIds } = body;

  if (cardId) {
    const card = await getCardById(cardId);
    if (!card) {
      return NextResponse.json({ error: "Card not found." }, { status: 404 });
    }
    const game = await createGame(card, timeLimitSeconds);
    return NextResponse.json({
      sessionId: game.sessionId,
      timeLimitSeconds: game.timeLimitSeconds,
      maxQuestions: game.maxQuestions,
      cardId: card.id,
    });
  }

  const filters = { format, popularityTier, cardType, excludeIds };

  const count = await getCardCount(filters);
  if (count === 0) {
    return NextResponse.json(
      { error: "No cards match those filters. Try different settings." },
      { status: 400 }
    );
  }

  const card = await getRandomCard(filters);
  if (!card) {
    return NextResponse.json(
      { error: "Could not find a card. Try again." },
      { status: 500 }
    );
  }

  const game = await createGame(card, timeLimitSeconds);

  // Preload card names for client-side autocomplete (skip for huge pools)
  const cardNames = count <= 10000 ? await getAllCardNames(filters) : undefined;

  return NextResponse.json({
    sessionId: game.sessionId,
    timeLimitSeconds: game.timeLimitSeconds,
    maxQuestions: game.maxQuestions,
    cardPool: count,
    cardId: card.id,
    cardNames,
  });
  } catch (err) {
    console.error("Game API error:", err);
    return NextResponse.json(
      { error: String(err), stack: err instanceof Error ? err.stack : undefined },
      { status: 500 }
    );
  }
}
