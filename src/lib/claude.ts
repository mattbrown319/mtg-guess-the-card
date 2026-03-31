import Anthropic from "@anthropic-ai/sdk";
import type { Card } from "@/types";

const client = new Anthropic();

export function cardToContext(card: Card): string {
  const parts: string[] = [
    `Name: ${card.name}`,
    `Mana Cost: ${card.mana_cost || "None"}`,
    `Converted Mana Cost (Mana Value): ${card.cmc}`,
    `Type Line: ${card.type_line}`,
    `Colors: ${card.colors.length > 0 ? card.colors.join(", ") : "Colorless"}`,
    `Color Identity: ${card.color_identity.length > 0 ? card.color_identity.join(", ") : "Colorless"}`,
    `Rarity: ${card.rarity}`,
    `Artist: ${card.artist}`,
  ];

  if (card.oracle_text) parts.push(`Oracle Text: ${card.oracle_text}`);
  if (card.power !== null) parts.push(`Power: ${card.power}`);
  if (card.toughness !== null) parts.push(`Toughness: ${card.toughness}`);
  if (card.loyalty !== null) parts.push(`Loyalty: ${card.loyalty}`);
  if (card.keywords.length > 0)
    parts.push(`Keywords: ${card.keywords.join(", ")}`);
  if (card.flavor_text) parts.push(`Flavor Text: ${card.flavor_text}`);
  if (card.produced_mana && card.produced_mana.length > 0)
    parts.push(`Produces Mana: ${card.produced_mana.join(", ")}`);

  if (card.card_faces) {
    parts.push(`\nThis is a double-faced card with ${card.card_faces.length} faces:`);
    for (const face of card.card_faces) {
      parts.push(`\n--- Face: ${face.name} ---`);
      parts.push(`  Mana Cost: ${face.mana_cost || "None"}`);
      parts.push(`  Type: ${face.type_line}`);
      if (face.oracle_text) parts.push(`  Text: ${face.oracle_text}`);
      if (face.power !== null) parts.push(`  Power: ${face.power}`);
      if (face.toughness !== null) parts.push(`  Toughness: ${face.toughness}`);
    }
  }

  const legalFormats = Object.entries(card.legalities)
    .filter(([, status]) => status === "legal" || status === "restricted")
    .map(([format]) => format);
  if (legalFormats.length > 0)
    parts.push(`Legal in: ${legalFormats.join(", ")}`);

  const bannedFormats = Object.entries(card.legalities)
    .filter(([, status]) => status === "banned")
    .map(([format]) => format);
  if (bannedFormats.length > 0)
    parts.push(`Banned in: ${bannedFormats.join(", ")}`);

  if (card.edhrec_rank !== null)
    parts.push(`EDHREC Popularity Rank: ${card.edhrec_rank} (lower = more popular)`);

  return parts.join("\n");
}

export const SYSTEM_PROMPT = `You are a Magic: The Gathering expert acting as the host of a "Guess the Card" game. A player is trying to identify a specific MTG card by asking yes/no questions.

RULES:
1. Answer ONLY with "Yes." or "No." — nothing else. Do NOT add any explanation, clarification, or extra details.
2. If the player asks "is it [card name]?" answer honestly with "Yes." or "No." like any other question. Do NOT volunteer the name unprompted. IMPORTANT: If the player names EXACTLY ONE card and it is the correct card (and your answer is Yes), append [CORRECT_GUESS] at the end of your response. Example: "Yes. [CORRECT_GUESS]". Do NOT append [CORRECT_GUESS] if they name multiple cards (e.g., "is it X or Y?"), ask about a card attribute rather than a specific card, or if the answer is No.
3. NEVER volunteer information the player didn't ask about. If they ask "is it a permanent?" answer "Yes." — do NOT add "It's an artifact" or any other detail. They need to ask about card type separately.
4. If the player says "I give up", "I don't know", "I quit", or similar, respond with "Don't give up! Use the guess button to make your best guess, or keep asking questions!"
5. If a question is ambiguous, interpret it in the most common/natural MTG sense and answer yes or no.
6. If a question truly cannot be answered yes/no, say "Try rephrasing as a yes/no question!"
7. If a question is about subjective things (like "is this card good?"), use your MTG knowledge to give a reasonable yes/no based on general community consensus.
8. For questions about competitive play, archetypes, combos, etc., use your training knowledge about Magic in addition to the card data.
9. If asked about which set the card is from or when it was printed, use your training knowledge about the card's original printing. The card data does not include set information.
10. Keep responses extremely terse. "Yes." or "No." is the ideal response. Qualifiers should be at most 2-3 words like "Yes, conditionally." or "Sometimes." — NEVER explain the condition or mechanic. Do NOT say things like "depends on your devotion" or "only if X". The player must figure out the details themselves.
11. If the player asks something that contradicts or ignores what they already established, gently remind them. For example, if they already confirmed the card costs 4 mana and then ask "does it cost 2U?", answer "No — remember, it's 4 mana, not 3." If they're asking about the wrong color or type, a brief nudge helps. Act like a helpful game store host who notices when someone loses track.
12. If a technically-correct yes/no would be misleading in context, use "Sometimes." or "Yes, conditionally." or "Not always." — do NOT explain why. For example, if a card is conditionally a creature, say "Sometimes." not "depends on devotion to blue."

MTG KNOWLEDGE YOU MUST APPLY:
- Color pairs have guild/faction names. You MUST recognize these: Azorius=WU, Dimir=UB, Rakdos=BR, Gruul=RG, Selesnya=GW, Orzhov=WB, Izzet=UR, Golgari=BG, Boros=RW, Simic=UG. Three-color combinations: Esper=WUB, Grixis=UBR, Jund=BRG, Naya=RGW, Bant=GWU, Abzan/Junk=WBG, Jeskai=URW, Sultai=BUG, Mardu=RWB, Temur=GUR.
- MTG type hierarchy: Permanents include creatures, artifacts, enchantments, planeswalkers, battles, and lands. Creatures are a subset of permanents. If a card says "target nonland permanent", it CAN target creatures, artifacts, enchantments, planeswalkers, and battles. If a card says "target creature", it can target any creature. Think carefully about what card types are subsets of other types.
- When a card says "destroy target nonland permanent" and the player asks "can it target a creature?", the answer is YES because creatures are nonland permanents.
- "Does it interact with" or "does it deal with" a zone/type means the card's text references or affects that zone/type in any way.
- Creature subtypes (Wall, Goblin, Elf, Human, Dragon, etc.) are ALL creatures. If a card says "target Wall" or "destroy target Goblin", it IS targeting a creature. Always answer "Yes" to "does it target a creature?" if the card targets any creature subtype.
- When answering questions, ALWAYS check the card data provided. Do NOT guess or infer information that isn't in the card data or your training knowledge. If the oracle text says "destroy target Wall", the card targets Walls (which are creatures), NOT lands, NOT artifacts.
- Think about what the card FUNCTIONALLY does, not just what words appear in the oracle text. If a card untaps an attacking creature and prevents its combat damage, it effectively "removes it from combat" even if those exact words aren't on the card. If a card exiles a creature and returns it, it effectively "blinks" or "flickers" it. Answer based on function, not just literal text matching.`;

export async function answerQuestion(
  card: Card,
  question: string,
  previousQA: { question: string; answer: string }[]
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [];

  // Include previous Q&A as conversation context
  for (const qa of previousQA) {
    messages.push({ role: "user", content: qa.question });
    messages.push({ role: "assistant", content: qa.answer });
  }

  messages.push({ role: "user", content: question });

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 150,
    system: `${SYSTEM_PROMPT}\n\nThe card the player is trying to guess:\n${cardToContext(card)}`,
    messages,
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock ? textBlock.text : "Sorry, I couldn't process that question.";
}

export async function getHint(
  card: Card,
  previousQA: { question: string; answer: string }[]
): Promise<string> {
  const qaHistory = previousQA
    .map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 100,
    system: `${SYSTEM_PROMPT}\n\nThe card the player is trying to guess:\n${cardToContext(card)}`,
    messages: [
      {
        role: "user",
        content: `Give the player ONE new fact about the card they haven't discovered yet. Respond with ONLY the fact — no preamble.

CRITICAL RULES FOR HINTS:
- ABSOLUTELY NEVER reveal the card's name. Not even partially. Not even if there's nothing else left to hint.
- NEVER reveal the card's signature mechanic, unique ability, or defining characteristic. Those are what make the card identifiable — giving them away ruins the game.
- Instead, give MUNDANE attributes: mana cost, color, card type, rarity, power/toughness, set era, artist name, or a generic keyword like flying or trample.
- You can also quote flavor text from the card if it has any.
- Good hints: "It costs 3 mana." / "It's from the 1990s." / "It's mythic rare." / "It has 5 toughness." / "Its flavor text mentions a journey."
- BAD hints (too revealing): "It involves a subgame." / "You flip it onto the battlefield." / "It has protection from everything." / "It's called [anything]."
- If the player has already discovered all mundane facts and you have nothing left to hint besides the card name or its defining mechanic, respond with: "No more hints available — you've got all the info you need!"

Conversation so far:\n${qaHistory || "No questions asked yet."}`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock ? textBlock.text : "Try asking about the card's color or type!";
}

export async function generateSummary(
  previousQA: { question: string; answer: string }[]
): Promise<string> {
  const qaHistory = previousQA
    .map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 300,
    system: `You consolidate information from a Q&A session about a mystery Magic: The Gathering card into a clean summary. Do NOT guess the card name.`,
    messages: [
      {
        role: "user",
        content: `Based on this Q&A, write a concise summary of what the player knows about the mystery card. Consolidate redundant facts (e.g., "is it 4+ mana?" Yes + "is it 7 mana?" Yes → just say "7 mana"). Include BOTH confirmed facts (Yes answers) and ruled-out facts (No answers). Format as two sections:

IS:
- bullet points of confirmed attributes

IS NOT:
- bullet points of ruled-out attributes

Keep it tight. Merge related facts. Skip questions that were just refinements of earlier ones.

Q&A:
${qaHistory}`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock ? textBlock.text : "Could not generate summary.";
}

export async function generateShareSummary(
  previousQA: { question: string; answer: string }[]
): Promise<string> {
  const qaHistory = previousQA
    .map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 100,
    system: `You write ultra-condensed one-line summaries of what a player learned about a mystery Magic: The Gathering card. Do NOT guess or reveal the card name.`,
    messages: [
      {
        role: "user",
        content: `Summarize what the player learned into ONE short line using MTG shorthand. Use abbreviations like UB, CMC, ETB. Comma-separated attributes. No full sentences. Examples:
- "rare UB land, ETB conditionally tapped, untapped with 2+ lands"
- "3CMC mono-white enchantment, static ability, taxes attackers"
- "7CMC colorless artifact creature, 5/5, has keywords + static ability"

Q&A:
${qaHistory}`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock ? textBlock.text : "";
}
