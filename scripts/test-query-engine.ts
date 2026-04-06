import Database from "better-sqlite3";
import path from "path";
import { normalizeCard } from "../src/lib/query-engine/normalize";
import { evaluate } from "../src/lib/query-engine/evaluator";
import type { StructuredQuery } from "../src/lib/query-engine/types";
import type { Card } from "../src/types";

const DB_PATH = path.join(__dirname, "..", "data", "cards.db");

function loadCard(name: string): Card {
  const db = new Database(DB_PATH, { readonly: true });
  const row = db.prepare("SELECT * FROM cards WHERE name = ?").get(name) as Record<string, unknown>;
  db.close();
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

function test(
  cardName: string,
  query: StructuredQuery,
  expected: string,
  description: string
) {
  const card = loadCard(cardName);
  const normalized = normalizeCard(card);
  const result = evaluate(query, normalized);
  const pass = result === expected;
  const icon = pass ? "✅" : "❌";
  console.log(`${icon} ${cardName}: ${description} → ${result} (expected ${expected})`);
  if (!pass) failures++;
  total++;
}

let failures = 0;
let total = 0;

console.log("=== QUERY ENGINE SMOKE TESTS ===\n");

// --- Lightning Bolt ---
test("Lightning Bolt", { kind: "type_contains", value: "Instant" }, "yes", "is an instant");
test("Lightning Bolt", { kind: "type_contains", value: "Creature" }, "no", "is not a creature");
test("Lightning Bolt", { kind: "is_permanent" }, "no", "is not a permanent");
test("Lightning Bolt", { kind: "color_contains", value: "R" }, "yes", "is red");
test("Lightning Bolt", { kind: "color_count_compare", operator: "=", value: 1 }, "yes", "is monocolor");
test("Lightning Bolt", { kind: "cmc_compare", operator: "=", value: 1 }, "yes", "CMC is 1");
test("Lightning Bolt", { kind: "mana_cost_equals", value: "{R}" }, "yes", "costs {R}");
test("Lightning Bolt", { kind: "targets" }, "yes", "targets");
test("Lightning Bolt", { kind: "name_equals", value: "Lightning Bolt" }, "yes", "name equals");
test("Lightning Bolt", { kind: "name_equals", value: "lightning bolt" }, "yes", "name equals case insensitive");
test("Lightning Bolt", { kind: "printed_in_set", value: "Alpha" }, "yes", "printed in Alpha");
test("Lightning Bolt", { kind: "printed_in_year_compare", operator: "=", value: 1993 }, "yes", "printed in 1993");
test("Lightning Bolt", { kind: "keyword_count_compare", operator: "=", value: 0 }, "yes", "no keywords");

// --- Thassa, God of the Sea ---
test("Thassa, God of the Sea", { kind: "type_contains", value: "Creature" }, "sometimes", "conditionally a creature");
test("Thassa, God of the Sea", { kind: "type_contains", value: "Enchantment" }, "yes", "is an enchantment");
test("Thassa, God of the Sea", { kind: "is_permanent" }, "yes", "is a permanent");
test("Thassa, God of the Sea", { kind: "supertype_contains", value: "legendary" }, "yes", "is legendary");
test("Thassa, God of the Sea", { kind: "subtype_contains", value: "god" }, "yes", "is a God");
test("Thassa, God of the Sea", { kind: "color_contains", value: "U" }, "yes", "is blue");
test("Thassa, God of the Sea", { kind: "cmc_compare", operator: "=", value: 3 }, "yes", "CMC is 3");
test("Thassa, God of the Sea", { kind: "keyword_contains", value: "indestructible" }, "yes", "has indestructible");
test("Thassa, God of the Sea", { kind: "activated_ability" }, "yes", "has activated ability");
test("Thassa, God of the Sea", { kind: "triggered_ability" }, "yes", "has triggered ability (scry)");
test("Thassa, God of the Sea", { kind: "power_compare", operator: "=", value: 5 }, "yes", "power is 5");

// --- Thought-Knot Seer ---
test("Thought-Knot Seer", { kind: "mana_cost_equals", value: "{3}{C}" }, "yes", "costs {3}{C}");
test("Thought-Knot Seer", { kind: "mana_cost_contains_symbol", value: "{C}" }, "yes", "has colorless pip");
test("Thought-Knot Seer", { kind: "mana_cost_has_generic" }, "yes", "has generic mana");
test("Thought-Knot Seer", { kind: "mana_cost_has_generic", value: 3 }, "yes", "has {3} generic");
test("Thought-Knot Seer", { kind: "color_count_compare", operator: "=", value: 0 }, "yes", "colorless");
test("Thought-Knot Seer", { kind: "cmc_compare", operator: "=", value: 4 }, "yes", "CMC is 4");
test("Thought-Knot Seer", { kind: "subtype_contains", value: "eldrazi" }, "yes", "is Eldrazi");
test("Thought-Knot Seer", { kind: "etb_ability" }, "yes", "has ETB ability");

// --- Delver of Secrets // Insectile Aberration ---
test("Delver of Secrets // Insectile Aberration", { kind: "type_contains", value: "Creature" }, "yes", "is a creature");
test("Delver of Secrets // Insectile Aberration", { kind: "name_equals", value: "Delver of Secrets" }, "yes", "matches front face name");
test("Delver of Secrets // Insectile Aberration", { kind: "name_equals", value: "Insectile Aberration" }, "yes", "matches back face name");
test("Delver of Secrets // Insectile Aberration", { kind: "keyword_contains", value: "transform" }, "yes", "has transform");
test("Delver of Secrets // Insectile Aberration", { kind: "keyword_contains", value: "flying" }, "yes", "has flying (back face)");
test("Delver of Secrets // Insectile Aberration", { kind: "cmc_compare", operator: "=", value: 1 }, "yes", "CMC is 1");

// --- Chord of Calling ---
test("Chord of Calling", { kind: "mana_cost_equals", value: "{X}{G}{G}{G}" }, "yes", "costs XGGG");
test("Chord of Calling", { kind: "mana_cost_contains_symbol", value: "{X}" }, "yes", "has X in cost");
test("Chord of Calling", { kind: "type_contains", value: "Instant" }, "yes", "is an instant");

// --- Maze of Ith ---
test("Maze of Ith", { kind: "type_contains", value: "Land" }, "yes", "is a land");
test("Maze of Ith", { kind: "targets" }, "yes", "targets");
test("Maze of Ith", { kind: "activated_ability" }, "yes", "has activated ability");
test("Maze of Ith", { kind: "produces_mana" }, "no", "doesn't produce mana");

// --- Compound queries ---
test("Lightning Bolt", {
  kind: "and",
  clauses: [
    { kind: "color_contains", value: "R" },
    { kind: "type_contains", value: "Instant" },
  ]
}, "yes", "is red AND instant");

test("Lightning Bolt", {
  kind: "not",
  clause: { kind: "type_contains", value: "Creature" },
}, "yes", "is NOT a creature");

test("Thassa, God of the Sea", {
  kind: "and",
  clauses: [
    { kind: "type_contains", value: "Creature" },
    { kind: "color_contains", value: "U" },
  ]
}, "sometimes", "is creature (sometimes) AND blue → sometimes");

// --- Seat of the Synod ---
test("Seat of the Synod", { kind: "type_contains", value: "Land" }, "yes", "is a land");
test("Seat of the Synod", { kind: "type_contains", value: "Artifact" }, "yes", "is also an artifact");
test("Seat of the Synod", { kind: "has_multiple_card_types" }, "yes", "has multiple types");
test("Seat of the Synod", { kind: "produces_mana_color", value: "U" }, "yes", "produces blue mana");

// --- Goblin Masons ---
test("Goblin Masons", { kind: "subtype_contains", value: "goblin" }, "yes", "is a Goblin");
test("Goblin Masons", { kind: "targets" }, "yes", "targets (target Wall)");
test("Goblin Masons", { kind: "triggered_ability" }, "yes", "has triggered ability (when dies)");

console.log(`\n=== RESULTS: ${total - failures}/${total} passed, ${failures} failed ===`);
if (failures > 0) process.exit(1);
