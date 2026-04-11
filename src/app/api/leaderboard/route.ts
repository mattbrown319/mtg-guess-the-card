import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// Server-side cache — avoid hitting Turso on every page load
let cache: { data: Record<string, unknown>; expiry: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  if (cache && Date.now() < cache.expiry) {
    return NextResponse.json(cache.data);
  }

  const db = await getDb();
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

  const leaderboardQuery = `
    SELECT player_initials as name, player_id,
           COUNT(DISTINCT CASE WHEN correct = 1 AND questions_json NOT LIKE '%Hint requested%' THEN json_extract(card_json, '$.name') END) as unique_wins,
           COUNT(CASE WHEN correct = 1 THEN 1 END) as total_wins,
           COUNT(CASE WHEN status IN ('guessed','timeout') THEN 1 END) as total_games,
           ROUND(AVG(CASE WHEN correct = 1 AND questions_json NOT LIKE '%Hint requested%' THEN question_count END), 1) as avg_qs,
           MIN(CASE WHEN correct = 1 AND questions_json NOT LIKE '%Hint requested%' THEN elapsed_seconds END) as fastest
    FROM sessions
    WHERE player_initials IS NOT NULL
    AND status IN ('guessed', 'timeout')
  `;

  const [allTime, daily] = await Promise.all([
    db.execute({
      sql: `${leaderboardQuery} GROUP BY player_id HAVING unique_wins >= 1 ORDER BY unique_wins DESC LIMIT 10`,
      args: [],
    }),
    db.execute({
      sql: `${leaderboardQuery} AND started_at > ? GROUP BY player_id HAVING unique_wins >= 1 ORDER BY unique_wins DESC LIMIT 10`,
      args: [dayAgo],
    }),
  ]);

  const mapRows = (rows: typeof allTime.rows) => rows.map((r) => ({
    name: r.name,
    playerId: r.player_id,
    uniqueWins: r.unique_wins,
    totalGames: r.total_games,
    avgQs: r.avg_qs,
    fastest: r.fastest,
  }));

  const data = {
    allTime: mapRows(allTime.rows),
    daily: mapRows(daily.rows),
  };

  cache = { data, expiry: Date.now() + CACHE_TTL_MS };
  return NextResponse.json(data);
}
