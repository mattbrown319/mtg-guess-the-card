import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = await getDb();
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

  const daily = await db.execute({
    sql: `
      SELECT player_initials as name, player_id,
             COUNT(DISTINCT CASE WHEN correct = 1 AND questions_json NOT LIKE '%Hint requested%' THEN json_extract(card_json, '$.name') END) as unique_wins,
             COUNT(CASE WHEN correct = 1 THEN 1 END) as total_wins,
             COUNT(CASE WHEN status IN ('guessed','timeout') THEN 1 END) as total_games,
             ROUND(AVG(CASE WHEN correct = 1 AND questions_json NOT LIKE '%Hint requested%' THEN question_count END), 1) as avg_qs,
             MIN(CASE WHEN correct = 1 AND questions_json NOT LIKE '%Hint requested%' THEN elapsed_seconds END) as fastest
      FROM sessions
      WHERE player_initials IS NOT NULL
      AND status IN ('guessed', 'timeout')
      AND started_at > ?
      GROUP BY player_id
      HAVING unique_wins >= 1
      ORDER BY unique_wins DESC
      LIMIT 10
    `,
    args: [dayAgo],
  });

  return NextResponse.json({
    daily: daily.rows.map((r) => ({
      name: r.name,
      playerId: r.player_id,
      uniqueWins: r.unique_wins,
      totalGames: r.total_games,
      avgQs: r.avg_qs,
      fastest: r.fastest,
    })),
  });
}
