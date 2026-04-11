// Apply manual overrides to semantic data after a Sonnet sweep.
// Run: npx tsx scripts/apply-overrides.ts
//
// Reads overrides from data/semantics/overrides.json and applies them
// to the corresponding card JSON files. Safe to run multiple times.

import fs from "fs";
import path from "path";

const SEMANTICS_DIR = path.join(__dirname, "..", "data", "semantics");
const OVERRIDES_FILE = path.join(SEMANTICS_DIR, "overrides.json");

interface Override {
  card: string;
  field: string; // dot-separated path like "structure.hasAlternativeCost"
  value: unknown;
  reason: string;
}

function setNestedField(obj: Record<string, unknown>, fieldPath: string, value: unknown): void {
  const parts = fieldPath.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof current[parts[i]] !== "object" || current[parts[i]] === null) {
      throw new Error(`Path ${fieldPath}: ${parts[i]} is not an object`);
    }
    current = current[parts[i]] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function getNestedField(obj: Record<string, unknown>, fieldPath: string): unknown {
  const parts = fieldPath.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function main() {
  if (!fs.existsSync(OVERRIDES_FILE)) {
    console.log("No overrides file found at", OVERRIDES_FILE);
    return;
  }

  const overridesData = JSON.parse(fs.readFileSync(OVERRIDES_FILE, "utf-8"));
  const overrides: Override[] = overridesData.overrides;

  console.log(`Applying ${overrides.length} overrides...\n`);

  let applied = 0;
  let skipped = 0;
  let notFound = 0;

  for (const override of overrides) {
    const safeName = override.card.replace(/[/\\?%*:|"<>]/g, "_");
    const filePath = path.join(SEMANTICS_DIR, `${safeName}.json`);

    if (!fs.existsSync(filePath)) {
      console.log(`  ⚠️  ${override.card}: file not found (card may not be in pool)`);
      notFound++;
      continue;
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const currentValue = getNestedField(data, override.field);

    if (JSON.stringify(currentValue) === JSON.stringify(override.value)) {
      skipped++;
      continue;
    }

    console.log(`  ✅ ${override.card}: ${override.field} = ${JSON.stringify(currentValue)} → ${JSON.stringify(override.value)}`);
    console.log(`     Reason: ${override.reason}`);

    setNestedField(data, override.field, override.value);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    applied++;
  }

  console.log(`\nDone: ${applied} applied, ${skipped} already correct, ${notFound} not found`);
}

main();
