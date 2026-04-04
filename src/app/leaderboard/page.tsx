import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getLeaderboardData() {
  const db = await getDb();
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  // Unique wins = count distinct card names won by each player
  const allTime = await db.execute(`
    SELECT player_initials as name,
           COUNT(DISTINCT CASE WHEN correct = 1 AND questions_json NOT LIKE '%Hint requested%' THEN json_extract(card_json, '$.name') END) as unique_wins,
           COUNT(CASE WHEN correct = 1 THEN 1 END) as total_wins,
           COUNT(CASE WHEN status IN ('guessed','timeout') THEN 1 END) as total_games,
           ROUND(AVG(CASE WHEN correct = 1 AND questions_json NOT LIKE '%Hint requested%' THEN question_count END), 1) as avg_qs
    FROM sessions
    WHERE player_initials IS NOT NULL
    AND status IN ('guessed', 'timeout')
    GROUP BY player_id
    HAVING unique_wins >= 1
    ORDER BY unique_wins DESC
    LIMIT 20
  `);

  const weekly = await db.execute({
    sql: `
      SELECT player_initials as name,
             COUNT(DISTINCT json_extract(card_json, '$.name')) as unique_wins,
             COUNT(CASE WHEN correct = 1 THEN 1 END) as total_wins,
             COUNT(CASE WHEN status IN ('guessed','timeout') THEN 1 END) as total_games,
             ROUND(AVG(CASE WHEN correct = 1 THEN question_count END), 1) as avg_qs
      FROM sessions
      WHERE player_initials IS NOT NULL
      AND status IN ('guessed', 'timeout')
      AND started_at > ?
      GROUP BY player_id
      HAVING unique_wins >= 1
      ORDER BY unique_wins DESC
      LIMIT 20
    `,
    args: [weekAgo],
  });

  const daily = await db.execute({
    sql: `
      SELECT player_initials as name,
             COUNT(DISTINCT json_extract(card_json, '$.name')) as unique_wins,
             COUNT(CASE WHEN correct = 1 THEN 1 END) as total_wins,
             COUNT(CASE WHEN status IN ('guessed','timeout') THEN 1 END) as total_games,
             ROUND(AVG(CASE WHEN correct = 1 THEN question_count END), 1) as avg_qs
      FROM sessions
      WHERE player_initials IS NOT NULL
      AND status IN ('guessed', 'timeout')
      AND started_at > ?
      GROUP BY player_id
      HAVING unique_wins >= 1
      ORDER BY unique_wins DESC
      LIMIT 20
    `,
    args: [dayAgo],
  });

  return {
    allTime: allTime.rows,
    weekly: weekly.rows,
    daily: daily.rows,
  };
}

function LeaderboardTable({
  rows,
  emptyMessage,
}: {
  rows: Record<string, unknown>[];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="text-sm text-[var(--text-secondary)] text-center py-4">
        {emptyMessage}
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[var(--text-secondary)] text-xs">
          <th className="text-left py-1 w-8">#</th>
          <th className="text-left py-1">Name</th>
          <th className="text-right py-1">Wins</th>
          <th className="text-right py-1">Games</th>
          <th className="text-right py-1">Win%</th>
          <th className="text-right py-1">Avg Qs</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const totalGames = row.total_games as number;
          const totalWins = row.total_wins as number;
          const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
          return (
            <tr
              key={i}
              className={`border-t border-[var(--border)] ${i < 3 ? "text-[var(--accent)]" : ""}`}
            >
              <td className="py-2 font-bold">{i + 1}</td>
              <td className="py-2 font-mono font-bold">{row.name as string}</td>
              <td className="py-2 text-right">{row.unique_wins as number}</td>
              <td className="py-2 text-right text-[var(--text-secondary)]">{totalGames}</td>
              <td className="py-2 text-right text-[var(--text-secondary)]">{winRate}%</td>
              <td className="py-2 text-right text-[var(--text-secondary)]">{String(row.avg_qs ?? "—")}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default async function LeaderboardPage() {
  const data = await getLeaderboardData();

  return (
    <main className="min-h-screen p-6 pt-12 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        Ranked by unique cards guessed correctly
      </p>
      <a
        href="/"
        className="text-sm text-[var(--accent)] hover:underline mb-8 block"
      >
        &larr; Play
      </a>

      <div className="space-y-8">
        {/* Today */}
        <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)]">
          <h2 className="text-lg font-semibold mb-3">Today</h2>
          <LeaderboardTable
            rows={data.daily}
            emptyMessage="No wins today yet — be the first!"
          />
        </div>

        {/* This Week */}
        <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)]">
          <h2 className="text-lg font-semibold mb-3">This Week</h2>
          <LeaderboardTable
            rows={data.weekly}
            emptyMessage="No wins this week yet"
          />
        </div>

        {/* All Time */}
        <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)]">
          <h2 className="text-lg font-semibold mb-3">All Time</h2>
          <LeaderboardTable
            rows={data.allTime}
            emptyMessage="No wins recorded yet"
          />
        </div>
      </div>
    </main>
  );
}
