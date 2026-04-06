import Database from "better-sqlite3";
import path from "path";
import { translateQuestion } from "../src/lib/query-engine/translator";
import { validateEnvelope } from "../src/lib/query-engine/validator";
import { normalizeCard } from "../src/lib/query-engine/normalize";
import { evaluate } from "../src/lib/query-engine/evaluator";
import type { Card } from "../src/types";
import type { StructuredQueryEnvelope } from "../src/lib/query-engine/types";
import fs from "fs";

const DB_PATH = path.join(__dirname, "..", "data", "cards.db");

function loadCard(name: string): Card | null {
  const db = new Database(DB_PATH, { readonly: true });
  const row = db.prepare("SELECT * FROM cards WHERE name = ?").get(name) as Record<string, unknown> | undefined;
  db.close();
  if (!row) return null;
  return {
    ...row,
    colors: JSON.parse(row.colors as string),
    color_identity: JSON.parse(row.color_identity as string),
    keywords: JSON.parse(row.keywords as string),
    legalities: JSON.parse(row.legalities as string),
    card_faces: row.card_faces ? JSON.parse(row.card_faces as string) : null,
    produced_mana: JSON.parse((row.produced_mana as string) || "[]"),
    all_sets: row.all_sets ? JSON.parse(row.all_sets as string) : null,
    all_years: row.all_years ? JSON.parse(row.all_years as string) : null,
  } as Card;
}

// Load real questions from sessions DB
function loadRealQuestions(): { cardName: string; question: string; originalAnswer: string }[] {
  const rawPath = "/tmp/all_questions_raw.txt";
  if (!fs.existsSync(rawPath)) {
    console.error("Run the question export first (turso db shell query)");
    process.exit(1);
  }

  // We need card names too — load from a different source
  // For now, use a curated set of card+question pairs from the sessions DB
  const db = new Database(DB_PATH, { readonly: true });
  db.close();

  return [];
}

// Curated test cases: real questions mapped to expected query kinds
const TEST_CASES: {
  cardName: string;
  question: string;
  expectedKind?: string;
  expectedOutcome?: string;
  context?: { question: string; answer: string }[];
}[] = [
  // === TYPE QUESTIONS ===
  { cardName: "Lightning Bolt", question: "is it a permanent?", expectedKind: "is_permanent", expectedOutcome: "no" },
  { cardName: "Lightning Bolt", question: "creature?", expectedKind: "type_contains", expectedOutcome: "no" },
  { cardName: "Lightning Bolt", question: "is it a permament", expectedKind: "is_permanent", expectedOutcome: "no" },
  { cardName: "Sol Ring", question: "is it an artifact?", expectedKind: "type_contains", expectedOutcome: "yes" },
  { cardName: "Thassa, God of the Sea", question: "is it a creature?", expectedKind: "type_contains", expectedOutcome: "sometimes" },
  { cardName: "Counterspell", question: "instant?", expectedKind: "type_contains", expectedOutcome: "yes" },
  { cardName: "Wrath of God", question: "is it a sorcery", expectedKind: "type_contains", expectedOutcome: "yes" },

  // === COLOR QUESTIONS ===
  { cardName: "Lightning Bolt", question: "is it red?", expectedKind: "color_contains", expectedOutcome: "yes" },
  { cardName: "Lightning Bolt", question: "blue", expectedKind: "color_contains", expectedOutcome: "no" },
  { cardName: "Lightning Bolt", question: "is it monocolor", expectedKind: "color_count_compare", expectedOutcome: "yes" },
  { cardName: "Lightning Bolt", question: "multicolored?", expectedKind: "color_count_compare", expectedOutcome: "no" },
  { cardName: "Sol Ring", question: "is it colorless?", expectedKind: "color_count_compare", expectedOutcome: "yes" },
  { cardName: "Assassin's Trophy", question: "is it golgari?", expectedKind: "guild_equals", expectedOutcome: "yes" },

  // === CMC QUESTIONS ===
  { cardName: "Lightning Bolt", question: "cmc 1?", expectedKind: "cmc_compare", expectedOutcome: "yes" },
  { cardName: "Lightning Bolt", question: "is it cmc 3 or more?", expectedKind: "cmc_compare", expectedOutcome: "no" },
  { cardName: "Wrath of God", question: "4 mana?", expectedKind: "cmc_compare", expectedOutcome: "yes" },
  { cardName: "Wrath of God", question: "is it 5 or more mana?", expectedKind: "cmc_compare", expectedOutcome: "no" },
  { cardName: "Lightning Bolt", question: "does it cost one mana?", expectedKind: "cmc_compare", expectedOutcome: "yes" },

  // === MANA COST ===
  { cardName: "Counterspell", question: "UU?", expectedKind: "mana_cost_equals", expectedOutcome: "yes" },
  { cardName: "Chord of Calling", question: "is it XGGG?", expectedKind: "mana_cost_equals", expectedOutcome: "yes" },
  { cardName: "Thought-Knot Seer", question: "does it have X in the cost?", expectedKind: "mana_cost_contains_symbol", expectedOutcome: "no" },
  { cardName: "Thought-Knot Seer", question: "does it have colorless pips?", expectedKind: "mana_cost_contains_symbol", expectedOutcome: "yes" },
  { cardName: "Thought-Knot Seer", question: "does it have generic mana?", expectedKind: "mana_cost_has_generic", expectedOutcome: "yes" },

  // === P/T ===
  { cardName: "Thassa, God of the Sea", question: "power 5?", expectedKind: "power_compare", expectedOutcome: "yes" },
  { cardName: "Thassa, God of the Sea", question: "is toughness greater than power?", expectedKind: "power_vs_toughness" },
  { cardName: "Lightning Bolt", question: "does it have power?", expectedOutcome: "no" },

  // === KEYWORDS ===
  { cardName: "Thassa, God of the Sea", question: "does it have indestructible?", expectedKind: "keyword_contains", expectedOutcome: "yes" },
  { cardName: "Lightning Bolt", question: "any keywords?", expectedKind: "keyword_count_compare", expectedOutcome: "no" },
  { cardName: "Thassa, God of the Sea", question: "does it have flying?", expectedKind: "keyword_contains", expectedOutcome: "no" },

  // === RARITY ===
  { cardName: "Lightning Bolt", question: "rare?", expectedKind: "rarity_equals" },
  { cardName: "Lightning Bolt", question: "is it common?", expectedKind: "rarity_equals" },

  // === LEGALITY ===
  { cardName: "Lightning Bolt", question: "is it modern legal?", expectedKind: "legality_equals", expectedOutcome: "yes" },
  { cardName: "Lightning Bolt", question: "legal in standard?", expectedKind: "legality_equals", expectedOutcome: "no" },

  // === SET/YEAR ===
  { cardName: "Lightning Bolt", question: "was it printed in Alpha?", expectedKind: "printed_in_set", expectedOutcome: "yes" },
  { cardName: "Lightning Bolt", question: "printed before 2000?", expectedKind: "printed_in_year_compare", expectedOutcome: "yes" },

  // === NAME ===
  { cardName: "Lightning Bolt", question: "is it lightning bolt?", expectedKind: "name_equals", expectedOutcome: "yes" },
  { cardName: "Lightning Bolt", question: "is it counterspell?", expectedKind: "name_equals", expectedOutcome: "no" },
  { cardName: "Lightning Bolt", question: "does the name contain bolt?", expectedKind: "name_contains", expectedOutcome: "yes" },

  // === MANA PRODUCTION ===
  { cardName: "Sol Ring", question: "does it produce mana?", expectedKind: "produces_mana", expectedOutcome: "yes" },
  { cardName: "Lightning Bolt", question: "does it tap for mana?", expectedOutcome: "no" },

  // === DERIVED ===
  { cardName: "Sol Ring", question: "is it a permanent?", expectedKind: "is_permanent", expectedOutcome: "yes" },
  { cardName: "Lightning Bolt", question: "does it target?", expectedKind: "targets", expectedOutcome: "yes" },
  { cardName: "Thassa, God of the Sea", question: "does it have a triggered ability?", expectedKind: "triggered_ability", expectedOutcome: "yes" },
  { cardName: "Thassa, God of the Sea", question: "activated ability?", expectedKind: "activated_ability", expectedOutcome: "yes" },
  { cardName: "Maze of Ith", question: "does it have a mana ability?", expectedKind: "has_mana_ability", expectedOutcome: "no" },

  // === CONTEXT-DEPENDENT ===
  {
    cardName: "Lightning Bolt",
    question: "red?",
    context: [
      { question: "is it blue?", answer: "No." },
      { question: "is it white?", answer: "No." },
    ],
    expectedKind: "color_contains",
    expectedOutcome: "yes",
  },
  {
    cardName: "Wrath of God",
    question: "3 or less?",
    context: [
      { question: "is it cmc 5 or more?", answer: "No." },
    ],
    expectedKind: "cmc_compare",
    expectedOutcome: "no",
  },

  // === TYPOS ===
  { cardName: "Sol Ring", question: "is it a creatuer?", expectedKind: "type_contains", expectedOutcome: "no" },
  { cardName: "Lightning Bolt", question: "is it monocular?", expectedKind: "color_count_compare", expectedOutcome: "yes" },
  { cardName: "Sol Ring", question: "permanant?", expectedKind: "is_permanent", expectedOutcome: "yes" },

  // === SHOULD REFUND ===
  { cardName: "Lightning Bolt", question: "is it good?", expectedOutcome: "refund" },
  { cardName: "Lightning Bolt", question: "does the art show a person?", expectedOutcome: "refund" },
  { cardName: "Lightning Bolt", question: "does it see competitive play?", expectedOutcome: "refund" },

  // === LEGENDARY ===
  { cardName: "Thassa, God of the Sea", question: "legendary?", expectedKind: "supertype_contains", expectedOutcome: "yes" },
  { cardName: "Lightning Bolt", question: "is it legendary?", expectedKind: "supertype_contains", expectedOutcome: "no" },

  // === ENTERS TAPPED ===
  { cardName: "Maze of Ith", question: "does it enter tapped?", expectedKind: "enters_tapped", expectedOutcome: "no" },

  // === TOKENS ===
  { cardName: "Lightning Bolt", question: "does it make tokens?", expectedKind: "creates_tokens", expectedOutcome: "no" },
];

async function runTests() {
  console.log(`Running ${TEST_CASES.length} translation tests...\n`);

  let passed = 0;
  let failed = 0;
  let refundedCorrectly = 0;
  let refundedIncorrectly = 0;
  let translationFailed = 0;
  let validationFailed = 0;
  let wrongOutcome = 0;
  let wrongKind = 0;
  const kindCounts: Record<string, number> = {};

  for (const tc of TEST_CASES) {
    const card = loadCard(tc.cardName);
    if (!card) {
      console.log(`⚠️  Card not found: ${tc.cardName}`);
      continue;
    }

    const normalized = normalizeCard(card);
    const result = await translateQuestion(tc.question, tc.context || []);

    // Track translation failures
    if (!result.envelope) {
      translationFailed++;
      if (tc.expectedOutcome === "refund") {
        console.log(`✅ "${tc.question}" → translation failed (expected refund)`);
        refundedCorrectly++;
        passed++;
      } else {
        console.log(`❌ "${tc.question}" → translation failed: ${result.parseError}`);
        console.log(`   Raw: ${result.rawOutput.slice(0, 150)}`);
        failed++;
      }
      continue;
    }

    // Validate
    const validation = validateEnvelope(result.envelope);
    if (!validation.valid) {
      validationFailed++;
      if (tc.expectedOutcome === "refund") {
        console.log(`✅ "${tc.question}" → validation failed (expected refund)`);
        refundedCorrectly++;
        passed++;
      } else {
        console.log(`❌ "${tc.question}" → validation failed: ${validation.errors.join("; ")}`);
        console.log(`   Query: ${JSON.stringify(result.envelope.query)}`);
        failed++;
      }
      continue;
    }

    // Check unsupported
    if (result.envelope.query.kind === "unsupported" || !result.envelope.meta.supported) {
      if (tc.expectedOutcome === "refund") {
        console.log(`✅ "${tc.question}" → unsupported (expected refund)`);
        refundedCorrectly++;
        passed++;
      } else {
        console.log(`❌ "${tc.question}" → unsupported but expected ${tc.expectedOutcome}`);
        refundedIncorrectly++;
        failed++;
      }
      continue;
    }

    // Track query kind
    const actualKind = result.envelope.query.kind;
    kindCounts[actualKind] = (kindCounts[actualKind] || 0) + 1;

    // Check expected kind
    if (tc.expectedKind && actualKind !== tc.expectedKind) {
      // Could be a compound query wrapping the expected kind
      const isWrapped = JSON.stringify(result.envelope.query).includes(`"${tc.expectedKind}"`);
      if (!isWrapped) {
        console.log(`⚠️  "${tc.question}" → kind=${actualKind} (expected ${tc.expectedKind})`);
        wrongKind++;
      }
    }

    // Evaluate
    const truthValue = evaluate(result.envelope.query, normalized);

    if (truthValue === null) {
      if (tc.expectedOutcome === "refund") {
        console.log(`✅ "${tc.question}" → evaluator null (expected refund)`);
        refundedCorrectly++;
        passed++;
      } else {
        console.log(`❌ "${tc.question}" → evaluator returned null for kind=${actualKind}`);
        failed++;
      }
      continue;
    }

    // Check expected outcome
    if (tc.expectedOutcome && tc.expectedOutcome !== "refund") {
      if (truthValue === tc.expectedOutcome) {
        console.log(`✅ "${tc.question}" → ${truthValue} (kind=${actualKind})`);
        passed++;
      } else {
        console.log(`❌ "${tc.question}" → ${truthValue} (expected ${tc.expectedOutcome}, kind=${actualKind})`);
        console.log(`   Query: ${JSON.stringify(result.envelope.query)}`);
        wrongOutcome++;
        failed++;
      }
    } else if (!tc.expectedOutcome) {
      // No expected outcome — just check it ran
      console.log(`✅ "${tc.question}" → ${truthValue} (kind=${actualKind})`);
      passed++;
    } else {
      // Expected refund but got an answer
      console.log(`❌ "${tc.question}" → ${truthValue} (expected refund, kind=${actualKind})`);
      failed++;
    }

    // Small delay to respect rate limits
    await new Promise(r => setTimeout(r, 100));
  }

  console.log("\n" + "=".repeat(60));
  console.log(`RESULTS: ${passed}/${passed + failed} passed, ${failed} failed`);
  console.log(`  Translation failures: ${translationFailed}`);
  console.log(`  Validation failures: ${validationFailed}`);
  console.log(`  Wrong outcome: ${wrongOutcome}`);
  console.log(`  Wrong kind (warning): ${wrongKind}`);
  console.log(`  Correct refunds: ${refundedCorrectly}`);
  console.log(`  Incorrect refunds: ${refundedIncorrectly}`);
  console.log(`\nQuery kind distribution:`);
  for (const [kind, count] of Object.entries(kindCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${kind}: ${count}`);
  }
}

runTests().catch(console.error);
