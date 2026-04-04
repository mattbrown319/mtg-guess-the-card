import { createClient } from "@libsql/client";
import Database from "better-sqlite3";
import path from "path";

const LOCAL_DB = path.join(__dirname, "..", "data", "cards.db");
const TURSO_URL = "libsql://mtg-guess-the-card-invisiblelemur.aws-us-east-1.turso.io";
const TURSO_TOKEN = process.argv[2];

if (!TURSO_TOKEN) {
  console.error("Usage: tsx scripts/sync-sets-iconic.ts <auth-token>");
  process.exit(1);
}

async function main() {
  const local = new Database(LOCAL_DB, { readonly: true });
  const remote = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  const rows = local
    .prepare("SELECT name, all_sets, all_years, is_iconic FROM cards")
    .all() as { name: string; all_sets: string | null; all_years: string | null; is_iconic: number }[];

  console.log(`Syncing ${rows.length} cards...`);

  const batchSize = 50;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const statements = batch.map((row) => ({
      sql: "UPDATE cards SET all_sets = ?, all_years = ?, is_iconic = ? WHERE name = ?",
      args: [row.all_sets || "[]", row.all_years || "[]", row.is_iconic || 0, row.name],
    }));
    await remote.batch(statements);
    if ((i + batchSize) % 1000 < batchSize) {
      process.stdout.write(`\r${Math.min(i + batchSize, rows.length)}/${rows.length}`);
    }
  }

  // Verify
  const iconic = await remote.execute("SELECT COUNT(*) as c FROM cards WHERE is_iconic = 1");
  const withSets = await remote.execute("SELECT COUNT(*) as c FROM cards WHERE all_sets IS NOT NULL AND all_sets != '[]'");
  console.log(`\nIconic: ${iconic.rows[0].c}, With sets: ${withSets.rows[0].c}`);

  local.close();
}

main().catch(console.error);
