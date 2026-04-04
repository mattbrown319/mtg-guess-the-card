import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { initials } = body;

  if (!initials || typeof initials !== "string" || initials.length < 1 || initials.length > 4) {
    return NextResponse.json({ error: "Invalid initials" }, { status: 400 });
  }

  const clean = initials.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  if (!clean) {
    return NextResponse.json({ error: "Invalid initials" }, { status: 400 });
  }

  const playerId = request.cookies.get("player_id")?.value;
  if (!playerId) {
    return NextResponse.json({ error: "No player ID" }, { status: 400 });
  }

  // Update all sessions for this player with these initials
  const db = await getDb();
  await db.execute({
    sql: "UPDATE sessions SET player_initials = ? WHERE player_id = ?",
    args: [clean, playerId],
  });

  const res = NextResponse.json({ ok: true, initials: clean });
  // Store in a cookie too so we don't ask again
  res.cookies.set("player_initials", clean, {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
