// Compare two semantic data directories to find regressions and changes.
// Usage: npx tsx scripts/diff-sweeps.ts [old-dir] [new-dir]
// Default: data/semantics-v1 vs data/semantics

import fs from "fs";
import path from "path";

const OLD_DIR = process.argv[2] || path.join(__dirname, "..", "data", "semantics-v1");
const NEW_DIR = process.argv[3] || path.join(__dirname, "..", "data", "semantics");

interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

function getNestedValue(obj: unknown, fieldPath: string): unknown {
  const parts = fieldPath.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function compareObjects(oldObj: unknown, newObj: unknown, prefix: string = ""): FieldChange[] {
  const changes: FieldChange[] = [];

  if (typeof oldObj !== "object" || oldObj === null || typeof newObj !== "object" || newObj === null) {
    if (JSON.stringify(oldObj) !== JSON.stringify(newObj)) {
      changes.push({ field: prefix || "(root)", oldValue: oldObj, newValue: newObj });
    }
    return changes;
  }

  const oldRec = oldObj as Record<string, unknown>;
  const newRec = newObj as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(oldRec), ...Object.keys(newRec)]);

  for (const key of allKeys) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;

    // Skip audit section — rationale text changes are expected
    if (key === "audit" && !prefix) continue;
    // Skip schemaVersion
    if (key === "schemaVersion" && !prefix) continue;

    if (!(key in oldRec)) {
      // New field — expected for v2 additions, don't report
      continue;
    }
    if (!(key in newRec)) {
      changes.push({ field: fieldPath, oldValue: oldRec[key], newValue: "(REMOVED)" });
      continue;
    }

    const oldVal = oldRec[key];
    const newVal = newRec[key];

    if (Array.isArray(oldVal) && Array.isArray(newVal)) {
      if (JSON.stringify(oldVal.sort()) !== JSON.stringify(newVal.sort())) {
        changes.push({ field: fieldPath, oldValue: oldVal, newValue: newVal });
      }
    } else if (typeof oldVal === "object" && typeof newVal === "object" && oldVal !== null && newVal !== null) {
      changes.push(...compareObjects(oldVal, newVal, fieldPath));
    } else if (oldVal !== newVal) {
      changes.push({ field: fieldPath, oldValue: oldVal, newValue: newVal });
    }
  }

  return changes;
}

function main() {
  const oldFiles = fs.readdirSync(OLD_DIR).filter(f => f.endsWith(".json") && !["progress.json", "errors.json", "overrides.json"].includes(f));
  const newFiles = fs.readdirSync(NEW_DIR).filter(f => f.endsWith(".json") && !["progress.json", "errors.json", "overrides.json"].includes(f));

  const oldSet = new Set(oldFiles);
  const newSet = new Set(newFiles);

  const newCards = newFiles.filter(f => !oldSet.has(f));
  const removedCards = oldFiles.filter(f => !newSet.has(f));
  const commonCards = oldFiles.filter(f => newSet.has(f));

  console.log(`Comparing ${OLD_DIR} → ${NEW_DIR}`);
  console.log(`  Old cards: ${oldFiles.length}`);
  console.log(`  New cards: ${newFiles.length}`);
  console.log(`  Added: ${newCards.length}`);
  console.log(`  Removed: ${removedCards.length}`);
  console.log(`  Common: ${commonCards.length}`);
  console.log();

  // Track changes by field for summary
  const fieldChangeCounts: Record<string, number> = {};
  const regressions: { card: string; changes: FieldChange[] }[] = [];
  let totalChanged = 0;
  let unchanged = 0;

  for (const file of commonCards) {
    const oldData = JSON.parse(fs.readFileSync(path.join(OLD_DIR, file), "utf-8"));
    const newData = JSON.parse(fs.readFileSync(path.join(NEW_DIR, file), "utf-8"));

    const changes = compareObjects(oldData, newData);

    if (changes.length === 0) {
      unchanged++;
      continue;
    }

    totalChanged++;
    const cardName = file.replace(".json", "");
    regressions.push({ card: cardName, changes });

    for (const change of changes) {
      fieldChangeCounts[change.field] = (fieldChangeCounts[change.field] || 0) + 1;
    }
  }

  console.log(`=== SUMMARY ===`);
  console.log(`  Unchanged cards: ${unchanged}`);
  console.log(`  Changed cards: ${totalChanged}`);
  console.log();

  // Most frequently changed fields
  const sortedFields = Object.entries(fieldChangeCounts).sort((a, b) => b[1] - a[1]);
  console.log(`=== MOST CHANGED FIELDS (top 20) ===`);
  for (const [field, count] of sortedFields.slice(0, 20)) {
    console.log(`  ${count.toString().padStart(4)} cards  ${field}`);
  }
  console.log();

  // Show boolean flips (potential regressions)
  const trueToFalse: { card: string; field: string }[] = [];
  const falseToTrue: { card: string; field: string }[] = [];

  for (const { card, changes } of regressions) {
    for (const change of changes) {
      if (change.oldValue === true && change.newValue === false) {
        trueToFalse.push({ card, field: change.field });
      } else if (change.oldValue === false && change.newValue === true) {
        falseToTrue.push({ card, field: change.field });
      }
    }
  }

  console.log(`=== BOOLEAN FLIPS ===`);
  console.log(`  true → false: ${trueToFalse.length} (potential regressions)`);
  console.log(`  false → true: ${falseToTrue.length} (potential improvements)`);
  console.log();

  if (trueToFalse.length > 0) {
    console.log(`=== TRUE → FALSE (review these for regressions) ===`);
    // Group by field
    const byField: Record<string, string[]> = {};
    for (const { card, field } of trueToFalse) {
      if (!byField[field]) byField[field] = [];
      byField[field].push(card);
    }
    for (const [field, cards] of Object.entries(byField).sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  ${field} (${cards.length} cards):`);
      for (const card of cards.slice(0, 5)) {
        console.log(`    - ${card}`);
      }
      if (cards.length > 5) console.log(`    ... and ${cards.length - 5} more`);
    }
  }
}

main();
