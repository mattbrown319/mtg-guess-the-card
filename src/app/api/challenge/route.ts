import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { cardId, creatorSessionId, creatorQuestions, creatorCorrect, timeLimit } = body;

  if (!cardId) {
    return NextResponse.json({ error: "Missing cardId" }, { status: 400 });
  }

  const db = await getDb();
  const challengeId = uuidv4().slice(0, 8);

  await db.execute({
    sql: `INSERT INTO challenges (challenge_id, card_id, created_at, creator_session_id, creator_questions, creator_correct, time_limit)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      challengeId,
      cardId,
      Date.now(),
      creatorSessionId || null,
      creatorQuestions || null,
      creatorCorrect ? 1 : 0,
      timeLimit ?? 300,
    ],
  });

  return NextResponse.json({ challengeId });
}

export async function GET(request: NextRequest) {
  const challengeId = request.nextUrl.searchParams.get("id");
  if (!challengeId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT * FROM challenges WHERE challenge_id = ?",
    args: [challengeId],
  });

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }

  const row = result.rows[0];
  return NextResponse.json({
    challengeId: row.challenge_id,
    cardId: row.card_id,
    creatorQuestions: row.creator_questions,
    creatorCorrect: row.creator_correct === 1,
    timeLimit: row.time_limit ?? 300,
  });
}
