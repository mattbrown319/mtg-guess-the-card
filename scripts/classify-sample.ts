import Anthropic from "@anthropic-ai/sdk";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(__dirname, "..", "data", "cards.db");
const client = new Anthropic();

// Same prompt as classify-cards.ts but importing inline for standalone use
const SYSTEM_PROMPT = `You are a Magic: The Gathering rules expert. Your job is to analyze a card's oracle text and produce a structured semantic summary.

You will be given a card's name, mana cost, type line, oracle text, and keywords.
You must output a JSON object matching the schema below. Be precise and literal.

CRITICAL RULES:
1. ACTIONS = things the card's effects DO. "Draw a card" is an action. "Whenever a player draws" is NOT an action — that is a CONDITION/TRIGGER.
2. CONDITIONS = what the card CARES ABOUT or TRIGGERS ON. "Whenever a creature dies" means caresAboutDeath=true, NOT destroysCreature=true.
3. REFERENCES = things merely mentioned in the rules text. "Target creature" means mentionsCreature=true.
4. For triggered abilities with "Whenever X, do Y": X is a condition, Y is an action. Both should be recorded.
5. Ignore reminder text (text in parentheses).
6. For DFCs, analyze both faces combined.
7. Be conservative. If unsure, set to false and note the ambiguity in audit.flaggedAmbiguities.

OUTPUT: Return ONLY valid JSON matching this schema (no markdown, no explanation):

{
  "schemaVersion": 1,
  "structure": {
    "hasTriggeredAbility": bool, "hasActivatedAbility": bool, "hasStaticAbility": bool,
    "hasReplacementEffect": bool, "hasPreventionEffect": bool,
    "hasEnterBattlefieldTrigger": bool, "hasLeavesBattlefieldTrigger": bool,
    "hasDiesTrigger": bool, "hasAttackTrigger": bool, "hasBlockTrigger": bool,
    "hasUpkeepTrigger": bool, "hasCombatDamageTrigger": bool,
    "hasModalChoice": bool, "modalCount": number_or_null, "modalKind": [],
    "hasAdditionalCost": bool, "hasAlternativeCost": bool, "hasOptionalAdditionalCost": bool,
    "hasManaAbility": bool, "hasNonManaActivatedAbility": bool, "namedMechanics": []
  },
  "actions": {
    "drawsCards": bool, "discardsCards": bool, "millsCards": bool, "surveils": bool,
    "scries": bool, "looksAtTopOfLibrary": bool, "searchesLibrary": bool, "shufflesLibrary": bool,
    "createsTokens": bool, "createdTokenTypes": [],
    "addsMana": bool, "addedManaColors": [], "canAddAnyColor": bool, "canAddMultipleColors": bool, "filtersMana": bool,
    "dealsDamage": bool, "damageTargets": [],
    "destroysCreature": bool, "destroysArtifact": bool, "destroysEnchantment": bool,
    "destroysLand": bool, "destroysPermanent": bool,
    "exilesCreature": bool, "exilesArtifact": bool, "exilesEnchantment": bool,
    "exilesLand": bool, "exilesPermanent": bool, "exilesFromGraveyard": bool,
    "exilesFromLibrary": bool, "exilesFromHand": bool,
    "reanimatesSelf": bool, "reanimatesOther": bool, "returnsToHand": bool,
    "bouncesCreature": bool, "bouncesPermanent": bool,
    "countersSpells": bool, "copiesSpells": bool, "copiesPermanents": bool,
    "tapsThings": bool, "untapsThings": bool,
    "grantsKeywords": bool, "grantedKeywords": [], "grantsPTBonus": bool, "grantsPTPenalty": bool,
    "modifiesPower": bool, "modifiesToughness": bool,
    "usesPlusOneCounters": bool, "usesMinusOneCounters": bool,
    "addsOtherCounters": bool, "otherCounterTypes": [],
    "sacrificesOwnPermanent": bool, "forcesOpponentSacrifice": bool,
    "fetchesLand": bool, "fetchesBasicLand": bool, "letsPlayExtraLands": bool,
    "gainsLife": bool, "causesLifeLoss": bool, "paysLife": bool,
    "takesExtraTurn": bool, "preventsDamage": bool, "redirectsDamage": bool,
    "animatesSelf": bool, "animatesOtherPermanent": bool,
    "makesMonarch": bool, "createsEmblem": bool,
    "restrictsActions": bool, "taxesOpponent": bool, "reducesCosts": bool,
    "phaseOut": bool, "flickersOrBlinks": bool
  },
  "conditions": {
    "caresAboutCreatures": bool, "caresAboutArtifacts": bool, "caresAboutEnchantments": bool,
    "caresAboutLands": bool, "caresAboutNonbasicLands": bool, "caresAboutGraveyard": bool,
    "caresAboutCardsDrawn": bool, "caresAboutDiscard": bool, "caresAboutLifeGainOrLoss": bool,
    "caresAboutCounters": bool, "caresAboutCastingSpells": bool, "caresAboutInstantsAndSorceries": bool,
    "caresAboutDeath": bool, "caresAboutEnterBattlefield": bool, "caresAboutLeaveBattlefield": bool,
    "caresAboutCombat": bool, "caresAboutDamage": bool, "caresAboutTappedUntappedState": bool,
    "caresAboutColors": bool, "caresAboutManaSpent": bool, "caresAboutPowerOrToughness": bool,
    "caresAboutTokens": bool, "caresAboutEquipment": bool, "caresAboutAuras": bool
  },
  "references": {
    "mentionsCreature": bool, "mentionsArtifact": bool, "mentionsEnchantment": bool,
    "mentionsLand": bool, "mentionsPlaneswalker": bool, "mentionsGraveyard": bool,
    "mentionsLibrary": bool, "mentionsHand": bool, "mentionsExile": bool,
    "mentionsOpponent": bool, "mentionsPlayer": bool, "mentionsCombat": bool
  },
  "battlefield": {
    "entersTapped": bool, "canEnterUntapped": bool,
    "alwaysEntersTapped": bool, "conditionallyEntersTapped": bool
  },
  "targeting": {
    "targetsOnCastOrActivation": bool, "targetKinds": []
  },
  "conditionality": {
    "typeChangesConditionally": bool, "faceDependent": bool, "notes": []
  },
  "audit": {
    "shortRationale": "1-2 sentence summary",
    "flaggedAmbiguities": []
  }
}`;

const SAMPLE_CARDS = [
  "Lightning Bolt",
  "Thassa, God of the Sea",
  "Thought-Knot Seer",
  "Maze of Ith",
  "Rhystic Study",
];

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

async function main() {
  const db = new Database(DB_PATH, { readonly: true });
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const name of SAMPLE_CARDS) {
    const row = db.prepare("SELECT * FROM cards WHERE name = ?").get(name) as Record<string, unknown>;
    if (!row) { console.log(`Card not found: ${name}`); continue; }

    const context = buildCardContext(row);
    console.log(`\n${"=".repeat(60)}`);
    console.log(`CARD: ${name}`);
    console.log(`${"=".repeat(60)}`);

    const t0 = Date.now();
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Analyze this Magic card:\n\n${context}` }],
    });

    const latency = Date.now() - t0;
    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock?.text || "";

    let jsonStr = raw.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

    try {
      const result = JSON.parse(jsonStr);

      // Print key fields for spot-checking
      console.log(`\nLatency: ${latency}ms`);
      console.log(`Tokens: ${response.usage.input_tokens} in, ${response.usage.output_tokens} out`);
      console.log(`\nAudit: ${result.audit?.shortRationale}`);
      if (result.audit?.flaggedAmbiguities?.length > 0) {
        console.log(`Ambiguities: ${result.audit.flaggedAmbiguities.join("; ")}`);
      }

      // Spot-check critical fields
      const checks: [string, unknown, unknown][] = [];

      if (name === "Lightning Bolt") {
        checks.push(
          ["actions.dealsDamage", result.actions?.dealsDamage, true],
          ["actions.drawsCards", result.actions?.drawsCards, false],
          ["targeting.targetsOnCastOrActivation", result.targeting?.targetsOnCastOrActivation, true],
          ["structure.hasTriggeredAbility", result.structure?.hasTriggeredAbility, false],
        );
      } else if (name === "Thassa, God of the Sea") {
        checks.push(
          ["conditionality.typeChangesConditionally", result.conditionality?.typeChangesConditionally, true],
          ["actions.scries", result.actions?.scries, true],
          ["actions.grantsKeywords", result.actions?.grantsKeywords, true],
          ["structure.hasActivatedAbility", result.structure?.hasActivatedAbility, true],
          ["structure.hasTriggeredAbility", result.structure?.hasTriggeredAbility, true],
        );
      } else if (name === "Thought-Knot Seer") {
        checks.push(
          ["structure.hasEnterBattlefieldTrigger", result.structure?.hasEnterBattlefieldTrigger, true],
          ["structure.hasLeavesBattlefieldTrigger", result.structure?.hasLeavesBattlefieldTrigger, true],
          ["actions.exilesFromHand", result.actions?.exilesFromHand, true],
          ["actions.drawsCards", result.actions?.drawsCards, true], // opponent draws on leave
        );
      } else if (name === "Maze of Ith") {
        checks.push(
          ["structure.hasActivatedAbility", result.structure?.hasActivatedAbility, true],
          ["actions.preventsDamage", result.actions?.preventsDamage, true],
          ["actions.untapsThings", result.actions?.untapsThings, true],
          ["targeting.targetsOnCastOrActivation", result.targeting?.targetsOnCastOrActivation, true],
          ["actions.addsMana", result.actions?.addsMana, false],
        );
      } else if (name === "Rhystic Study") {
        checks.push(
          ["structure.hasTriggeredAbility", result.structure?.hasTriggeredAbility, true],
          ["conditions.caresAboutCastingSpells", result.conditions?.caresAboutCastingSpells, true],
          ["actions.drawsCards", result.actions?.drawsCards, true],
          ["actions.taxesOpponent", result.actions?.taxesOpponent, true],
        );
      }

      let allPass = true;
      for (const [field, actual, expected] of checks) {
        const pass = actual === expected;
        console.log(`  ${pass ? "✅" : "❌"} ${field}: ${actual} (expected ${expected})`);
        if (!pass) allPass = false;
      }
      if (checks.length > 0) {
        console.log(allPass ? "  ALL CHECKS PASSED" : "  ⚠️ SOME CHECKS FAILED");
      }

    } catch (e) {
      console.log(`❌ JSON parse error: ${e}`);
      console.log(`Raw output (first 200): ${raw.slice(0, 200)}`);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  db.close();

  // Cost summary
  const inputCost = totalInputTokens / 1_000_000 * 3;
  const outputCost = totalOutputTokens / 1_000_000 * 15;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`COST SUMMARY (${SAMPLE_CARDS.length} cards)`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Input tokens: ${totalInputTokens.toLocaleString()}`);
  console.log(`Output tokens: ${totalOutputTokens.toLocaleString()}`);
  console.log(`Input cost: $${inputCost.toFixed(4)}`);
  console.log(`Output cost: $${outputCost.toFixed(4)}`);
  console.log(`Total cost: $${(inputCost + outputCost).toFixed(4)}`);
  console.log(`Estimated cost for 1000 cards: $${((inputCost + outputCost) / SAMPLE_CARDS.length * 1000).toFixed(2)}`);
}

main().catch(console.error);
