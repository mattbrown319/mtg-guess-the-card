// Sync is_iconic flags from local DB to Turso.
// Run: npx tsx scripts/sync-iconic-to-turso.ts
//
// Reads local cards.db and updates Turso to match.
// Safe to run multiple times — only changes rows that differ.

import Database from "better-sqlite3";
import path from "path";
import { execSync } from "child_process";

const DB_PATH = path.join(__dirname, "..", "data", "cards.db");

function main() {
  const db = new Database(DB_PATH, { readonly: true });

  const iconic = db.prepare("SELECT name FROM cards WHERE is_iconic = 1 ORDER BY name").all() as { name: string }[];
  const notIconic = db.prepare("SELECT name FROM cards WHERE is_iconic = 0 OR is_iconic IS NULL ORDER BY name").all() as { name: string }[];

  console.log(`Local DB: ${iconic.length} iconic, ${notIconic.length} not iconic`);

  // Build SQL to sync
  const iconicNames = iconic.map(r => `'${r.name.replace(/'/g, "''")}'`).join(",");

  console.log("\nSyncing to Turso...");

  // Set all matching names to iconic
  const setIconicSQL = `UPDATE cards SET is_iconic = 1 WHERE name IN (${iconicNames}) AND (is_iconic != 1 OR is_iconic IS NULL)`;
  const setNotIconicSQL = `UPDATE cards SET is_iconic = 0 WHERE name NOT IN (${iconicNames}) AND is_iconic = 1`;

  try {
    const result1 = execSync(`turso db shell mtg-guess-the-card "${setIconicSQL}; SELECT changes();"`, { encoding: "utf-8" });
    console.log(`  Set iconic: ${result1.trim()}`);

    const result2 = execSync(`turso db shell mtg-guess-the-card "${setNotIconicSQL}; SELECT changes();"`, { encoding: "utf-8" });
    console.log(`  Cleared non-iconic: ${result2.trim()}`);
  } catch (e) {
    console.error("Failed to sync to Turso:", e);
    console.log("\nMake sure you're logged in: turso auth login");
  }

  // Verify
  try {
    const verify = execSync(`turso db shell mtg-guess-the-card "SELECT COUNT(*) FROM cards WHERE is_iconic = 1"`, { encoding: "utf-8" });
    console.log(`\nTurso iconic count: ${verify.trim()}`);
  } catch {}

  db.close();
}

main();
