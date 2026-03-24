import { NextRequest, NextResponse } from "next/server";
import { getGame } from "@/lib/game-store";
import { recordVote } from "@/lib/votes";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { sessionId, vote } = body;

  if (!sessionId || !vote || !["fun", "not_fun"].includes(vote)) {
    return NextResponse.json({ error: "Invalid vote" }, { status: 400 });
  }

  const game = await getGame(sessionId);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  await recordVote(sessionId, game.card.name, vote);

  return NextResponse.json({ ok: true });
}
