import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;

export function getDb(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL || "file:data/cards.db";
    client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    // Create all tables — idempotent, runs on first connection
    // Sessions table
    client.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        card_json TEXT NOT NULL,
        questions_json TEXT NOT NULL DEFAULT '[]',
        started_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        guess TEXT,
        correct INTEGER,
        question_count INTEGER NOT NULL DEFAULT 0,
        max_questions INTEGER NOT NULL DEFAULT 999,
        time_limit_seconds INTEGER NOT NULL DEFAULT 180
      )
    `);

    // Votes table
    client.execute(`
      CREATE TABLE IF NOT EXISTS votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        card_name TEXT NOT NULL,
        vote TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
    client.execute(
      "CREATE INDEX IF NOT EXISTS idx_votes_card_name ON votes(card_name)"
    );

    // Challenges table
    client.execute(`
      CREATE TABLE IF NOT EXISTS challenges (
        challenge_id TEXT PRIMARY KEY,
        card_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        creator_session_id TEXT,
        creator_questions INTEGER,
        creator_correct INTEGER
      )
    `);
  }
  return client;
}
