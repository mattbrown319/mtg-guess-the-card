import { NextRequest, NextResponse } from "next/server";
import { getRandomCard, getCardCount, getCardById, getAllCardNames } from "@/lib/cards";
import { createGame } from "@/lib/game-store";
import { checkRateLimit } from "@/lib/rate-limit";
import { v4 as uuidv4 } from "uuid";

function getOrCreatePlayerId(request: NextRequest): { playerId: string; isNew: boolean } {
  const existing = request.cookies.get("player_id")?.value;
  if (existing) return { playerId: existing, isNew: false };
  return { playerId: uuidv4(), isNew: true };
}

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

  const { playerId, isNew } = getOrCreatePlayerId(request);
  const playerInitials = request.cookies.get("player_initials")?.value;
  const body = await request.json();
  const { format, popularityTier, cardType, timeLimitSeconds, cardId, excludeNames } = body;

  if (cardId) {
    const card = await getCardById(cardId);
    if (!card) {
      return NextResponse.json({ error: "Card not found." }, { status: 404 });
    }
    const game = await createGame(card, timeLimitSeconds, playerId, playerInitials);
    const res = NextResponse.json({
      sessionId: game.sessionId,
      timeLimitSeconds: game.timeLimitSeconds,
      maxQuestions: game.maxQuestions,
      cardId: card.id,
    });
    if (isNew) {
      res.cookies.set("player_id", playerId, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return res;
  }

  const t0 = Date.now();
  const filters = { format, popularityTier, cardType, excludeNames };

  const count = await getCardCount(filters);
  const t1 = Date.now();
  console.log(`[GAME] getCardCount: ${t1 - t0}ms`);
  if (count === 0) {
    return NextResponse.json(
      { error: "No cards match those filters. Try different settings." },
      { status: 400 }
    );
  }

  const card = await getRandomCard(filters);
  const t2 = Date.now();
  console.log(`[GAME] getRandomCard: ${t2 - t1}ms`);
  if (!card) {
    return NextResponse.json(
      { error: "Could not find a card. Try again." },
      { status: 500 }
    );
  }

  const game = await createGame(card, timeLimitSeconds, playerId, playerInitials);
  const t3 = Date.now();
  console.log(`[GAME] createGame: ${t3 - t2}ms`);

  // Preload card names for client-side autocomplete (skip for huge pools)
  const cardNames = count <= 10000 ? await getAllCardNames(filters) : undefined;
  const t4 = Date.now();
  console.log(`[GAME] getAllCardNames: ${t4 - t3}ms (${cardNames?.length ?? 0} names)`);
  console.log(`[GAME] Total: ${t4 - t0}ms`);

  const res = NextResponse.json({
    sessionId: game.sessionId,
    timeLimitSeconds: game.timeLimitSeconds,
    maxQuestions: game.maxQuestions,
    cardPool: count,
    cardId: card.id,
    cardName: card.name,
    cardNames,
  });
  if (isNew) {
    res.cookies.set("player_id", playerId, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
  } catch (err) {
    console.error("Game API error:", err);
    return NextResponse.json(
      { error: String(err), stack: err instanceof Error ? err.stack : undefined },
      { status: 500 }
    );
  }
}
