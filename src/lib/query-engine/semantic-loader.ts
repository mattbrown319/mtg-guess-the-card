// Loads pre-classified oracle semantic summaries from JSON files
// These are generated at build time by scripts/classify-cards.ts

import fs from "fs";
import path from "path";
import type { OracleSemanticSummary } from "./oracle-semantics";

let cache: Map<string, OracleSemanticSummary> | null = null;

export function loadSemantics(): Map<string, OracleSemanticSummary> {
  if (cache) return cache;

  const dir = path.join(process.cwd(), "data", "semantics");
  const map = new Map<string, OracleSemanticSummary>();

  if (!fs.existsSync(dir)) {
    console.warn("[Semantics] No semantics directory found at", dir);
    return map;
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith(".json") && f !== "progress.json" && f !== "errors.json");

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8")) as OracleSemanticSummary;
      // File name is the card name (with special chars replaced by _)
      // But we need to match by card name from the DB, so store by audit info won't work.
      // The file name IS the card name. Reverse the sanitization isn't reliable,
      // so we'll index by file name and also provide a lookup-by-name function.
      const cardName = file.replace(/\.json$/, "");
      map.set(cardName, data);
    } catch {
      // Skip malformed files
    }
  }

  console.log(`[Semantics] Loaded ${map.size} semantic summaries`);
  cache = map;
  return map;
}

export function getSemanticsForCard(cardName: string): OracleSemanticSummary | undefined {
  const map = loadSemantics();
  // Try exact match first
  if (map.has(cardName)) return map.get(cardName);
  // Try sanitized name (same sanitization as classify-cards.ts)
  const safeName = cardName.replace(/[/\\?%*:|"<>]/g, "_");
  return map.get(safeName);
}
