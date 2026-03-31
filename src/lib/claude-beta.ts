import Anthropic from "@anthropic-ai/sdk";
import type { Card } from "@/types";
import { SYSTEM_PROMPT, cardToContext } from "./claude";

const client = new Anthropic();

const BETA_ADDITION = `

OVERRIDE TO RULE 1: In this version, you MUST append additional structured data after your Yes/No answer. Your response format is: "Yes. [ATTRS:{...}]" or "No. [ATTRS:{...}]". The [ATTRS:...] block is REQUIRED on every response. This overrides the "nothing else" part of Rule 1.

STRUCTURED OUTPUT INSTRUCTIONS:
After your Yes/No answer, you MUST append a JSON block tagged [ATTRS:{...}] containing any card attributes that are NOW newly confirmed by this specific question and answer. Only include attributes where THIS exchange provides NEW information not previously established.

Use this exact schema (only include fields with new information):
- "colors": array of confirmed color letters of the card itself, e.g. ["R"] or ["W","U"]. Lands have no colors.
- "colorIdentity": array of colors the card is associated with (includes mana it produces). E.g., a UB land has colors:[] but colorIdentity:["U","B"]
- "types": array of confirmed card types, e.g. ["creature"] or ["instant"]
- "subtypes": array of confirmed subtypes, e.g. ["goblin","wizard"]
- "supertypes": array of confirmed supertypes, e.g. ["legendary"]
- "cmc": number if confirmed, e.g. 3
- "manaCost": string if fully confirmed, e.g. "{1}{R}{R}"
- "power": string if confirmed, e.g. "2"
- "toughness": string if confirmed, e.g. "1"
- "keywords": array of confirmed keywords, e.g. ["flying","trample"]
- "abilities": array of brief ability descriptions confirmed, e.g. ["triggered ability","ETB effect"]
- "rarity": string if confirmed, e.g. "rare"
- "isMulticolor": boolean if confirmed

CRITICAL RULES FOR ATTRS:
- Only include attributes that are EXACTLY confirmed. "CMC 3 or greater?" → "Yes" does NOT confirm cmc is 3. Only "CMC 3?" → "Yes" confirms cmc is 3. Do NOT report bounds or ranges as exact values.
- Include ALL attributes confirmed by this exchange. If the player asks "is it 1UG?" and you answer "Yes.", return the full mana cost AND cmc: [ATTRS:{"manaCost":"{1}{U}{G}","cmc":3}]. If the player confirms power and toughness (e.g., "2/2?" → "Yes."), return BOTH: [ATTRS:{"power":"2","toughness":"2"}].
- Use deductive logic: if a "No" answer combined with all previous answers narrows something to exactly one possibility, include the inferred attribute. E.g., if the player has established it's not a permanent and not an instant, it must be a sorcery — include {"types":["sorcery"]}. If they've confirmed it's not W, U, B, or G, and it's monocolor, it must be R — include {"colors":["R"]}.

Examples:
- Player asks "is it a creature?" you answer "Yes." → append [ATTRS:{"types":["creature"]}]
- Player asks "is it red?" you answer "Yes." → append [ATTRS:{"colors":["R"]}]
- Player asks "CMC 3?" you answer "Yes." → append [ATTRS:{"cmc":3}]
- Player asks "CMC 3 or greater?" you answer "Yes." → append [ATTRS:{}] (NOT confirmed as exactly 3)
- Player asks "1RR?" you answer "Yes." → append [ATTRS:{"manaCost":"{1}{R}{R}","cmc":3}]
- Player asks "2 power?" you answer "Yes." → append [ATTRS:{"power":"2"}]
- Player asks "power equal to toughness?" you answer "Yes." AND power is known to be 2 → append [ATTRS:{"toughness":"2"}]
- Player asks "does it have flying?" you answer "No." → append [ATTRS:{}]
- Player already established it's not a permanent and not an instant. Player asks "is it an instant?" you answer "No." → append [ATTRS:{"types":["sorcery"]}] (deduced)
- Player asks "legendary?" you answer "Yes." → append [ATTRS:{"supertypes":["legendary"]}]

If no new attributes are confirmed or the answer is No without revealing anything new, append [ATTRS:{}].
ALWAYS append the [ATTRS:...] block. Never skip it.`;

export async function answerQuestionBeta(
  card: Card,
  question: string,
  previousQA: { question: string; answer: string }[]
): Promise<{ answer: string; attrs: Record<string, unknown> }> {
  const messages: Anthropic.MessageParam[] = [];

  for (const qa of previousQA) {
    messages.push({ role: "user", content: qa.question });
    messages.push({ role: "assistant", content: qa.answer });
  }

  messages.push({ role: "user", content: question });

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 300,
    system: `${SYSTEM_PROMPT}${BETA_ADDITION}\n\nThe card the player is trying to guess:\n${cardToContext(card)}`,
    messages,
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const raw = textBlock?.text || "Sorry, I couldn't process that question.";

  // Parse out [ATTRS:{...}] block
  const attrsMatch = raw.match(/\[ATTRS:(\{[^]*?\})\]/);
  let attrs: Record<string, unknown> = {};
  let answer = raw;

  console.log("[BETA RAW]", raw);

  if (attrsMatch) {
    answer = raw.replace(attrsMatch[0], "").trim();
    try {
      attrs = JSON.parse(attrsMatch[1]);
      console.log("[BETA ATTRS]", attrs);
    } catch (e) {
      console.error("[BETA ATTRS PARSE FAIL]", attrsMatch[1], e);
      attrs = {};
    }
  } else {
    console.warn("[BETA NO ATTRS FOUND IN]", raw);
  }

  return { answer, attrs };
}
