import { createClient } from "@libsql/client";
import Database from "better-sqlite3";
import path from "path";

const LOCAL_DB = path.join(__dirname, "..", "data", "cards.db");
const TURSO_URL = "libsql://mtg-guess-the-card-invisiblelemur.aws-us-east-1.turso.io";
const TURSO_TOKEN = process.argv[2];

async function main() {
  const local = new Database(LOCAL_DB, { readonly: true });
  const remote = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  // Add column
  try {
    await remote.execute("ALTER TABLE cards ADD COLUMN is_iconic INTEGER DEFAULT 0");
    console.log("Added is_iconic column");
  } catch {
    console.log("Column already exists, resetting...");
    await remote.execute("UPDATE cards SET is_iconic = 0");
  }

  // Get iconic card names from local
  const iconicCards = local.prepare("SELECT name FROM cards WHERE is_iconic = 1").all() as { name: string }[];
  console.log(`Syncing ${iconicCards.length} iconic cards...`);

  // Batch update in groups of 50
  for (let i = 0; i < iconicCards.length; i += 50) {
    const batch = iconicCards.slice(i, i + 50);
    const placeholders = batch.map(() => "?").join(",");
    await remote.execute({
      sql: `UPDATE cards SET is_iconic = 1 WHERE name IN (${placeholders})`,
      args: batch.map(c => c.name),
    });
    process.stdout.write(`\r${Math.min(i + 50, iconicCards.length)}/${iconicCards.length}`);
  }

  // Verify
  const count = await remote.execute("SELECT COUNT(*) as c FROM cards WHERE is_iconic = 1");
  console.log(`\nRemote iconic count: ${count.rows[0].c}`);

  local.close();
}

main().catch(console.error);
