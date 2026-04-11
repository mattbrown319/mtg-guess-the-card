// Apply schema migrations to all semantic JSON files after a sweep.
// Run: npx tsx scripts/apply-schema-migrations.ts
//
// Use this for field renames, additions with defaults, or removals
// that apply to ALL cards.

import fs from "fs";
import path from "path";

const SEMANTICS_DIR = path.join(__dirname, "..", "data", "semantics");

interface Migration {
  description: string;
  apply: (data: Record<string, unknown>) => boolean; // returns true if modified
}

// Add migrations here. Each runs on every card's JSON.
// They should be idempotent — safe to run multiple times.
const MIGRATIONS: Migration[] = [
  {
    description: "Rename targetsOnCastOrActivation → hasTargeting",
    apply: (data) => {
      const targeting = data.targeting as Record<string, unknown> | undefined;
      if (!targeting) return false;
      if ("targetsOnCastOrActivation" in targeting) {
        targeting.hasTargeting = targeting.targetsOnCastOrActivation;
        delete targeting.targetsOnCastOrActivation;
        return true;
      }
      return false;
    },
  },
  // Add future migrations here:
  // {
  //   description: "Add new field foo with default",
  //   apply: (data) => {
  //     if (!data.actions.foo) { data.actions.foo = false; return true; }
  //     return false;
  //   }
  // }
];

function main() {
  const files = fs.readdirSync(SEMANTICS_DIR)
    .filter(f => f.endsWith(".json") && !["progress.json", "errors.json", "overrides.json"].includes(f));

  console.log(`Running ${MIGRATIONS.length} migrations on ${files.length} files...\n`);

  for (const migration of MIGRATIONS) {
    let modified = 0;
    for (const file of files) {
      const filePath = path.join(SEMANTICS_DIR, file);
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (migration.apply(data)) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        modified++;
      }
    }
    console.log(`  ${migration.description}: ${modified} files modified`);
  }

  console.log("\nDone.");
}

main();
