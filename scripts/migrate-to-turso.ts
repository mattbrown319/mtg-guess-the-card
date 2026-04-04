import { createClient } from "@libsql/client";
import Database from "better-sqlite3";
import path from "path";

const LOCAL_DB_PATH = path.join(__dirname, "..", "data", "cards.db");
const TURSO_URL = "libsql://mtg-guess-the-card-invisiblelemur.aws-us-east-1.turso.io";
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || process.argv[2];

if (!TURSO_TOKEN) {
  console.error("Usage: tsx scripts/migrate-to-turso.ts <auth-token>");
  process.exit(1);
}

async function main() {
  const local = new Database(LOCAL_DB_PATH, { readonly: true });
  const remote = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  // Get the CREATE TABLE statement
  const schema = local
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='cards'")
    .get() as { sql: string };

  console.log("Creating table...");
  await remote.execute("DROP TABLE IF EXISTS cards");
  await remote.execute(schema.sql);

  // Create indexes
  const indexes = local
    .prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='cards' AND sql IS NOT NULL")
    .all() as { sql: string }[];
  for (const idx of indexes) {
    await remote.execute(idx.sql);
  }
  console.log(`Created ${indexes.length} indexes`);

  // Migrate data in batches
  const count = (local.prepare("SELECT COUNT(*) as c FROM cards").get() as { c: number }).c;
  console.log(`Migrating ${count} cards...`);

  const batchSize = 50;
  let offset = 0;

  while (offset < count) {
    const rows = local
      .prepare(`SELECT * FROM cards LIMIT ${batchSize} OFFSET ${offset}`)
      .all() as Record<string, unknown>[];

    const statements = rows.map((row) => ({
      sql: `INSERT INTO cards (id, oracle_id, name, layout, mana_cost, cmc, type_line, oracle_text,
            colors, color_identity, keywords, power, toughness, loyalty, rarity, set_code, set_name,
            released_at, artist, edhrec_rank, penny_rank, num_printings, popularity_score,
            all_sets, all_years, is_iconic,
            flavor_text, image_uri_normal, image_uri_art_crop, legalities, card_faces, produced_mana)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        row.id, row.oracle_id, row.name, row.layout, row.mana_cost, row.cmc,
        row.type_line, row.oracle_text, row.colors, row.color_identity, row.keywords,
        row.power, row.toughness, row.loyalty, row.rarity, row.set_code, row.set_name,
        row.released_at, row.artist, row.edhrec_rank, row.penny_rank, row.num_printings,
        row.popularity_score, row.all_sets, row.all_years, row.is_iconic,
        row.flavor_text, row.image_uri_normal, row.image_uri_art_crop,
        row.legalities, row.card_faces, row.produced_mana,
      ] as unknown[],
    }));

    await remote.batch(statements);
    offset += batchSize;
    process.stdout.write(`\r${offset}/${count}`);
  }

  console.log("\nVerifying...");
  const remoteCount = await remote.execute("SELECT COUNT(*) as c FROM cards");
  console.log(`Remote has ${remoteCount.rows[0].c} cards`);

  local.close();
  console.log("Done!");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
