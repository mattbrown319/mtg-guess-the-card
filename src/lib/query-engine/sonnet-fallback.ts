// Sonnet fallback — answers questions the deterministic engine can't handle.
// Only called when the query engine would otherwise refund.

import Anthropic from "@anthropic-ai/sdk";
import type { NormalizedCard } from "./types";

const client = new Anthropic();

const SONNET_SYSTEM_PROMPT = `You are a Magic: The Gathering rules expert answering yes/no questions about a specific card in a guessing game. You will be given the card's full data. Answer ONLY based on the card data provided.

RESPONSE FORMAT:
Answer with ONLY "Yes.", "No.", or "Sometimes." — nothing else. No explanations.

MTG RULES REMINDERS (unintuitive cases):
- Replacement effects ("If X would happen, Y happens instead") are STATIC abilities, not triggered abilities. They don't use "when/whenever/at".
- "Enters the battlefield" triggers use "When [this] enters". Replacement effects that modify how something enters (like "enters tapped") are NOT triggers.
- Reminder text (in parentheses) is NOT rules text. Ignore it for ability classification.
- A card's COLOR is determined by mana cost pips. Color IDENTITY includes all mana symbols anywhere on the card.
- Hybrid mana {W/B} means the card is BOTH white AND black.
- Lands have no mana cost and CMC 0, but they are not "free spells" — they aren't cast at all.
- Modal DFCs: both faces exist on the card. Analyze both when asked about the card's properties.
- Companion is a deckbuilding restriction, not a gameplay triggered/activated ability.
- "Can't be blocked" is rules text, not a keyword. Keywords are things like flying, trample, haste.
- Paying life as a cost is different from losing life as an effect.
- "Destroy" and "exile" are different. Exile bypasses indestructible.
- Tokens are not cards. "Card" in rules text specifically means a non-token game piece.`;

function buildCardContext(card: NormalizedCard): string {
  const parts: string[] = [
    `Name: ${card.name}`,
    `Mana Cost: ${card.manaCost || "None"}`,
    `CMC: ${card.cmc}`,
    `Type Line: ${card.typeLine}`,
    `Colors: ${card.colors.length > 0 ? card.colors.join(", ") : "Colorless"}`,
    `Color Identity: ${card.colorIdentity.length > 0 ? card.colorIdentity.join(", ") : "Colorless"}`,
    `Rarity: ${card.rarity}`,
  ];

  if (card.oracleText) parts.push(`Oracle Text: ${card.oracleText}`);
  if (card.power !== null) parts.push(`Power: ${card.power}`);
  if (card.toughness !== null) parts.push(`Toughness: ${card.toughness}`);
  if (card.loyalty !== null) parts.push(`Loyalty: ${card.loyalty}`);
  if (card.keywords.length > 0) parts.push(`Keywords: ${card.keywords.join(", ")}`);
  if (card.producedMana.length > 0) parts.push(`Produces Mana: ${card.producedMana.join(", ")}`);
  if (card.allSets.length > 0) parts.push(`Printed in sets: ${card.allSets.join(", ")}`);
  if (card.allYears.length > 0) parts.push(`Print years: ${card.allYears.join(", ")} (first: ${card.allYears[0]})`);

  if (card.hasFaces) {
    for (const face of card.cardFaces) {
      parts.push(`\n--- Face: ${face.name} ---`);
      parts.push(`  Mana Cost: ${face.manaCost || "None"}`);
      parts.push(`  Type: ${face.typeLine}`);
      if (face.oracleText) parts.push(`  Oracle Text: ${face.oracleText}`);
      if (face.power !== null) parts.push(`  Power: ${face.power}`);
      if (face.toughness !== null) parts.push(`  Toughness: ${face.toughness}`);
    }
  }

  return parts.join("\n");
}

export interface SonnetFallbackResult {
  answer: string;          // "Yes." / "No." / "Sometimes." or raw if unparseable
  outcome: "yes" | "no" | "sometimes" | "refund";
  rawOutput: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  cardContext: string;     // what we sent to Sonnet
}

export async function askSonnet(
  card: NormalizedCard,
  question: string,
): Promise<SonnetFallbackResult> {
  const t0 = Date.now();
  const cardContext = buildCardContext(card);

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 50,
      system: SONNET_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Card data:\n${cardContext}\n\nQuestion: ${question}`,
      }],
    });

    const latencyMs = Date.now() - t0;
    const textBlock = response.content.find((b) => b.type === "text");
    const rawOutput = textBlock?.text?.trim() || "";

    // Parse the answer
    const lower = rawOutput.toLowerCase();
    let outcome: "yes" | "no" | "sometimes" | "refund";
    let answer: string;

    if (lower.startsWith("yes")) {
      outcome = "yes";
      answer = "Yes.";
    } else if (lower.startsWith("no")) {
      outcome = "no";
      answer = "No.";
    } else if (lower.startsWith("sometimes")) {
      outcome = "sometimes";
      answer = "Sometimes.";
    } else {
      outcome = "refund";
      answer = rawOutput;
    }

    return {
      answer,
      outcome,
      rawOutput,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
      cardContext,
    };
  } catch (e) {
    return {
      answer: "I'm not sure how to answer that.",
      outcome: "refund",
      rawOutput: e instanceof Error ? e.message : String(e),
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - t0,
      cardContext,
    };
  }
}
