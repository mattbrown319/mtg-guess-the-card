import Anthropic from "@anthropic-ai/sdk";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { CLASSIFICATION_PROMPT } from "./classification-prompt";
import { validateSemantics } from "./validate-semantics";

const DB_PATH = path.join(__dirname, "..", "data", "cards.db");
const OUTPUT_DIR = path.join(__dirname, "..", "data", "semantics");
const PROGRESS_FILE = path.join(OUTPUT_DIR, "progress.json");
const ERRORS_FILE = path.join(OUTPUT_DIR, "errors.json");

const CONCURRENCY = 5;
const client = new Anthropic();

// Parse --limit N flag
const limitArg = process.argv.find(a => a.startsWith("--limit"));
const LIMIT = limitArg ? parseInt(process.argv[process.argv.indexOf(limitArg) + 1], 10) : Infinity;

function buildCardContext(row: Record<string, unknown>): string {
  const parts: string[] = [
    `Name: ${row.name}`,
    `Mana Cost: ${row.mana_cost || "None"}`,
    `Type Line: ${row.type_line}`,
  ];
  if (row.oracle_text) parts.push(`Oracle Text: ${row.oracle_text}`);
  const keywords = JSON.parse((row.keywords as string) || "[]");
  if (keywords.length > 0) parts.push(`Keywords: ${keywords.join(", ")}`);
  const cardFaces = row.card_faces ? JSON.parse(row.card_faces as string) : null;
  if (cardFaces) {
    for (const face of cardFaces) {
      parts.push(`\n--- Face: ${face.name} ---`);
      if (face.mana_cost) parts.push(`  Mana Cost: ${face.mana_cost}`);
      if (face.type_line) parts.push(`  Type: ${face.type_line}`);
      if (face.oracle_text) parts.push(`  Oracle Text: ${face.oracle_text}`);
    }
  }
  return parts.join("\n");
}

async function classifyCard(cardContext: string): Promise<{
  result: Record<string, unknown> | null;
  inputTokens: number;
  outputTokens: number;
  rawOutput: string;
}> {
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2000,
      system: CLASSIFICATION_PROMPT,
      messages: [{ role: "user", content: `Analyze this Magic card:\n\n${cardContext}` }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const raw = textBlock?.text || "";

    let jsonStr = raw.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

    const result = JSON.parse(jsonStr);
    return {
      result,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      rawOutput: raw,
    };
  } catch (e) {
    return {
      result: null,
      inputTokens: 0,
      outputTokens: 0,
      rawOutput: e instanceof Error ? e.message : String(e),
    };
  }
}

async function main() {
  const db = new Database(DB_PATH, { readonly: true });
  const cards = db.prepare(
    "SELECT name, mana_cost, type_line, oracle_text, keywords, card_faces FROM cards WHERE is_iconic = 1 ORDER BY name"
  ).all() as Record<string, unknown>[];

  console.log(`Found ${cards.length} iconic cards to classify`);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let progress: Record<string, boolean> = {};
  if (fs.existsSync(PROGRESS_FILE)) progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));

  let errors: Record<string, { parseError?: string; validationIssues?: unknown[] }> = {};
  if (fs.existsSync(ERRORS_FILE)) errors = JSON.parse(fs.readFileSync(ERRORS_FILE, "utf-8"));

  const alreadyDone = Object.keys(progress).length;
  console.log(`Already classified: ${alreadyDone}`);
  console.log(`Remaining: ${cards.length - alreadyDone}\n`);

  let classified = 0;
  let failed = 0;
  let warnings = 0;
  let totalInput = 0;
  let totalOutput = 0;
  const startTime = Date.now();

  // Filter to remaining cards and apply limit
  const remaining = cards.filter(c => !progress[c.name as string]);
  const toProcess = remaining.slice(0, LIMIT);

  if (LIMIT < Infinity) {
    console.log(`Limit: processing ${toProcess.length} cards (--limit ${LIMIT})\n`);
  }

  // Process in batches of CONCURRENCY
  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const batch = toProcess.slice(i, i + CONCURRENCY);

    const results = await Promise.all(
      batch.map(async (card) => {
        const name = card.name as string;
        const context = buildCardContext(card);
        const res = await classifyCard(context);
        return { name, card, ...res };
      })
    );

    // Process results sequentially for clean output
    for (const { name, result, inputTokens, outputTokens, rawOutput } of results) {
      const idx = alreadyDone + classified + failed + 1;
      process.stdout.write(`  ${idx}/${cards.length} ${name}...`);

      totalInput += inputTokens;
      totalOutput += outputTokens;

      if (!result) {
        failed++;
        errors[name] = { parseError: rawOutput.slice(0, 500) };
        console.log(` ❌ parse error`);
      } else {
        const issues = validateSemantics(result, name);
        const errorIssues = issues.filter(i => i.severity === "error");
        const warningIssues = issues.filter(i => i.severity === "warning");

        if (errorIssues.length > 0) {
          console.log(` ⚠️  ${errorIssues.length} errors:`);
          for (const issue of errorIssues) {
            console.log(`      ${issue.field}: ${issue.message}`);
          }
          errors[name] = { validationIssues: errorIssues };
          warnings += warningIssues.length;
        } else {
          if (warningIssues.length > 0) {
            console.log(` ✅ (${warningIssues.length} warnings)`);
            warnings += warningIssues.length;
          } else {
            console.log(` ✅`);
          }
        }

        const safeName = name.replace(/[/\\?%*:|"<>]/g, "_");
        fs.writeFileSync(path.join(OUTPUT_DIR, `${safeName}.json`), JSON.stringify(result, null, 2));
        progress[name] = true;
        classified++;
      }
    }

    // Save progress after each batch
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress));
    fs.writeFileSync(ERRORS_FILE, JSON.stringify(errors, null, 2));

    // Print progress every 50 cards
    const done = classified + failed;
    if (done > 0 && done % 50 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = done / elapsed;
      const remainingCards = toProcess.length - done;
      const eta = remainingCards / rate;
      const costSoFar = (totalInput / 1_000_000 * 3) + (totalOutput / 1_000_000 * 15);
      console.log(`\n  --- ${done} done in ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s | ${rate.toFixed(2)} cards/sec | ETA ${Math.floor(eta / 60)}m ${Math.floor(eta % 60)}s | $${costSoFar.toFixed(2)} spent ---\n`);
    }
  }

  // Final save
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress));
  fs.writeFileSync(ERRORS_FILE, JSON.stringify(errors, null, 2));

  const inputCost = totalInput / 1_000_000 * 3;
  const outputCost = totalOutput / 1_000_000 * 15;

  const elapsed = (Date.now() - startTime) / 1000;
  const cardsPerSec = (classified + failed) / elapsed;
  const remainingAfter = cards.length - Object.keys(progress).length;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`RESULTS`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Classified: ${classified}`);
  console.log(`Failed: ${failed}`);
  console.log(`Validation warnings: ${warnings}`);
  console.log(`Validation errors: ${Object.keys(errors).length}`);
  console.log(`Total completed: ${Object.keys(progress).length}/${cards.length}`);
  console.log(`\nTime: ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s (${cardsPerSec.toFixed(2)} cards/sec)`);
  if (remainingAfter > 0) {
    const etaSeconds = remainingAfter / cardsPerSec;
    console.log(`ETA for remaining ${remainingAfter}: ${Math.floor(etaSeconds / 60)}m ${Math.floor(etaSeconds % 60)}s`);
  }
  console.log(`\nCost: $${(inputCost + outputCost).toFixed(2)} (${totalInput.toLocaleString()} in, ${totalOutput.toLocaleString()} out)`);
  if (remainingAfter > 0) {
    const costPerCard = (inputCost + outputCost) / (classified + failed);
    console.log(`Projected remaining cost: $${(costPerCard * remainingAfter).toFixed(2)}`);
  }

  db.close();
}

main().catch(console.error);
