import { NextRequest, NextResponse } from "next/server";
import { getRandomCard, getStarterCard } from "@/lib/cards";

// Lightweight endpoint: pick a card without creating a session.
// Used by the landing page prefetch to warm the DB and pre-select a card.
// The actual session is created when the player clicks "Start Game".

export async function POST(request: NextRequest) {
  const isNew = !request.cookies.get("player_id")?.value;
  const body = await request.json();
  const { popularityTier, excludeNames } = body;

  const useStarter = isNew && popularityTier === "popular";
  const card = useStarter
    ? await getStarterCard(excludeNames)
    : await getRandomCard({ popularityTier, excludeNames });

  if (!card) {
    return NextResponse.json({ error: "No cards found" }, { status: 400 });
  }

  return NextResponse.json({ cardId: card.id });
}
