import { NextRequest, NextResponse } from "next/server";
import { getGame, submitGuess } from "@/lib/game-store";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const { allowed } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const { sessionId, cardName, giveUp, elapsedSeconds } = body;

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing sessionId." },
      { status: 400 }
    );
  }

  if (!giveUp && !cardName) {
    return NextResponse.json(
      { error: "Missing cardName." },
      { status: 400 }
    );
  }

  const game = await getGame(sessionId);
  if (!game) {
    return NextResponse.json(
      { error: "Game not found." },
      { status: 404 }
    );
  }

  const result = await submitGuess(sessionId, giveUp ? "" : cardName);
  if (!result) {
    return NextResponse.json(
      { error: "Game is no longer active." },
      { status: 400 }
    );
  }

  // Store elapsed time if provided
  if (elapsedSeconds !== undefined) {
    const db = await import("@/lib/db").then(m => m.getDb());
    await db.execute({
      sql: "UPDATE sessions SET elapsed_seconds = ? WHERE session_id = ?",
      args: [Math.round(elapsedSeconds), sessionId],
    });
  }

  return NextResponse.json({
    correct: result.correct,
    card: {
      name: result.card.name,
      mana_cost: result.card.mana_cost,
      type_line: result.card.type_line,
      oracle_text: result.card.oracle_text,
      rarity: result.card.rarity,
      set_name: result.card.set_name,
      artist: result.card.artist,
      image_uri_normal: result.card.image_uri_normal,
      image_uri_art_crop: result.card.image_uri_art_crop,
      colors: result.card.colors,
      keywords: result.card.keywords,
      power: result.card.power,
      toughness: result.card.toughness,
    },
    questionsAsked: game.questionCount,
  });
}
