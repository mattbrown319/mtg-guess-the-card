import { getDb } from "./db";

export async function recordVote(
  sessionId: string,
  cardName: string,
  vote: "fun" | "not_fun"
): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: "INSERT INTO votes (session_id, card_name, vote, created_at) VALUES (?, ?, ?, ?)",
    args: [sessionId, cardName, vote, Date.now()],
  });
}
