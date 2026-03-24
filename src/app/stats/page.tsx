import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getStats() {
  const db = await getDb();

  const overview = await db.execute(`
    SELECT
      COUNT(*) as total_sessions,
      SUM(CASE WHEN status IN ('guessed', 'timeout') THEN 1 ELSE 0 END) as completed_games,
      SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN correct = 0 AND status = 'guessed' THEN 1 ELSE 0 END) as losses,
      ROUND(AVG(CASE WHEN status IN ('guessed', 'timeout') THEN question_count END), 1) as avg_questions
    FROM sessions
  `);

  const today = await db.execute(`
    SELECT
      COUNT(*) as games_today,
      SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) as wins_today
    FROM sessions
    WHERE started_at > ${Date.now() - 24 * 60 * 60 * 1000}
  `);

  const topGuessed = await db.execute(`
    SELECT json_extract(card_json, '$.name') as card_name,
           COUNT(*) as times_played,
           SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) as times_won
    FROM sessions
    WHERE status IN ('guessed', 'timeout')
    GROUP BY card_name
    ORDER BY times_played DESC
    LIMIT 10
  `);

  const hardest = await db.execute(`
    SELECT json_extract(card_json, '$.name') as card_name,
           COUNT(*) as times_played,
           SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) as times_won,
           ROUND(AVG(question_count), 1) as avg_qs
    FROM sessions
    WHERE status IN ('guessed', 'timeout')
    GROUP BY card_name
    HAVING times_played >= 2
    ORDER BY CAST(times_won AS FLOAT) / times_played ASC
    LIMIT 10
  `);

  const recentGames = await db.execute(`
    SELECT json_extract(card_json, '$.name') as card_name,
           question_count,
           correct,
           status,
           started_at
    FROM sessions
    WHERE status IN ('guessed', 'timeout')
    ORDER BY started_at DESC
    LIMIT 15
  `);

  const votes = await db.execute(`
    SELECT card_name,
           SUM(CASE WHEN vote = 'fun' THEN 1 ELSE 0 END) as good,
           SUM(CASE WHEN vote = 'not_fun' THEN 1 ELSE 0 END) as obscure
    FROM votes
    GROUP BY card_name
    ORDER BY obscure DESC
    LIMIT 10
  `);

  const challenges = await db.execute(
    "SELECT COUNT(*) as total FROM challenges"
  );

  return {
    overview: overview.rows[0],
    today: today.rows[0],
    topGuessed: topGuessed.rows,
    hardest: hardest.rows,
    recentGames: recentGames.rows,
    votes: votes.rows,
    challenges: challenges.rows[0],
  };
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function StatsPage() {
  const stats = await getStats();
  const o = stats.overview;
  const t = stats.today;

  return (
    <main className="min-h-screen p-6 pt-12 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Game Stats</h1>
      <a
        href="/"
        className="text-sm text-[var(--accent)] hover:underline mb-8 block"
      >
        &larr; Back to game
      </a>

      {/* Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)]">
          <div className="text-2xl font-bold">{o.total_sessions as number}</div>
          <div className="text-sm text-[var(--text-secondary)]">
            Total Sessions
          </div>
        </div>
        <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)]">
          <div className="text-2xl font-bold">{o.completed_games as number}</div>
          <div className="text-sm text-[var(--text-secondary)]">
            Completed Games
          </div>
        </div>
        <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)]">
          <div className="text-2xl font-bold">
            {o.completed_games
              ? `${Math.round(((o.wins as number) / (o.completed_games as number)) * 100)}%`
              : "—"}
          </div>
          <div className="text-sm text-[var(--text-secondary)]">Win Rate</div>
        </div>
        <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)]">
          <div className="text-2xl font-bold">{String(o.avg_questions ?? "—")}</div>
          <div className="text-sm text-[var(--text-secondary)]">
            Avg Questions
          </div>
        </div>
      </div>

      {/* Today */}
      <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)] mb-8">
        <h2 className="text-lg font-semibold mb-2">Last 24 Hours</h2>
        <div className="text-[var(--text-secondary)]">
          {t.games_today as number} games,{" "}
          {t.wins_today as number} wins,{" "}
          {stats.challenges.total as number} challenges created total
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-8">
        {/* Most Played Cards */}
        <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)]">
          <h2 className="text-lg font-semibold mb-3">Most Played</h2>
          <div className="space-y-2">
            {stats.topGuessed.map((row, i) => (
              <div
                key={i}
                className="flex justify-between text-sm"
              >
                <span>{row.card_name as string}</span>
                <span className="text-[var(--text-secondary)]">
                  {row.times_won as number}/{row.times_played as number} won
                </span>
              </div>
            ))}
            {stats.topGuessed.length === 0 && (
              <div className="text-[var(--text-secondary)] text-sm">
                No data yet
              </div>
            )}
          </div>
        </div>

        {/* Hardest Cards */}
        <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)]">
          <h2 className="text-lg font-semibold mb-3">Hardest Cards</h2>
          <div className="space-y-2">
            {stats.hardest.map((row, i) => (
              <div
                key={i}
                className="flex justify-between text-sm"
              >
                <span>{row.card_name as string}</span>
                <span className="text-[var(--text-secondary)]">
                  {row.times_won as number}/{row.times_played as number} won, ~{row.avg_qs as number} Qs
                </span>
              </div>
            ))}
            {stats.hardest.length === 0 && (
              <div className="text-[var(--text-secondary)] text-sm">
                Need more games
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Votes */}
      {stats.votes.length > 0 && (
        <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)] mb-8">
          <h2 className="text-lg font-semibold mb-3">Most Voted &quot;Too Obscure&quot;</h2>
          <div className="space-y-2">
            {stats.votes.map((row, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{row.card_name as string}</span>
                <span className="text-[var(--text-secondary)]">
                  {row.good as number} good / {row.obscure as number} obscure
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Games */}
      <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)]">
        <h2 className="text-lg font-semibold mb-3">Recent Games</h2>
        <div className="space-y-2">
          {stats.recentGames.map((row, i) => (
            <div
              key={i}
              className="flex justify-between text-sm"
            >
              <span>
                {row.correct === 1 ? "✅" : "❌"}{" "}
                {row.card_name as string}
              </span>
              <span className="text-[var(--text-secondary)]">
                {row.question_count as number} Qs &bull;{" "}
                {timeAgo(row.started_at as number)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
