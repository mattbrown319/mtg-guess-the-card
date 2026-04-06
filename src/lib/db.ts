import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;
let initialized: Promise<void> | null = null;

async function initTables(db: Client): Promise<void> {
  await db.execute(`
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
      time_limit_seconds INTEGER NOT NULL DEFAULT 180,
      player_id TEXT,
      player_initials TEXT
    )
  `);

  // Migration for existing DBs
  await db.execute(
    "ALTER TABLE sessions ADD COLUMN player_id TEXT"
  ).catch(() => {});

  await db.execute(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      card_name TEXT NOT NULL,
      vote TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_votes_card_name ON votes(card_name)"
  );

  await db.execute(`
    CREATE TABLE IF NOT EXISTS challenges (
      challenge_id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      creator_session_id TEXT,
      creator_questions INTEGER,
      creator_correct INTEGER,
      time_limit INTEGER DEFAULT 180
    )
  `);

  // Migrations for existing DBs
  await db.execute("ALTER TABLE challenges ADD COLUMN time_limit INTEGER DEFAULT 180").catch(() => {});
  await db.execute("ALTER TABLE sessions ADD COLUMN player_initials TEXT").catch(() => {});
  await db.execute("ALTER TABLE sessions ADD COLUMN elapsed_seconds INTEGER").catch(() => {});

  await db.execute(`
    CREATE TABLE IF NOT EXISTS query_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      card_name TEXT NOT NULL,
      question TEXT NOT NULL,
      translated_query TEXT,
      query_kind TEXT,
      validation_errors TEXT,
      outcome TEXT NOT NULL,
      reason_code TEXT,
      used_context INTEGER DEFAULT 0,
      translate_latency_ms INTEGER,
      total_latency_ms INTEGER,
      created_at INTEGER NOT NULL
    )
  `);
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_query_logs_session ON query_logs(session_id)"
  ).catch(() => {});
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_query_logs_outcome ON query_logs(outcome)"
  ).catch(() => {});
}

export async function getDb(): Promise<Client> {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL || "file:data/cards.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    initialized = initTables(client);
  }
  await initialized;
  return client;
}
