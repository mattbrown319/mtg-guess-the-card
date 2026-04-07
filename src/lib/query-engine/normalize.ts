import type { Card } from "@/types";
import type { NormalizedCard, NormalizedFace } from "./types";
import { getSemanticsForCard } from "./semantic-loader";

const SUPERTYPES = new Set([
  "legendary", "basic", "snow", "world", "ongoing",
]);

const CARD_TYPES = new Set([
  "creature", "artifact", "enchantment", "land", "planeswalker",
  "instant", "sorcery", "battle", "kindred", "tribal",
]);

function parseTypeLine(typeLine: string): {
  supertypes: string[];
  types: string[];
  subtypes: string[];
} {
  const [mainPart, subtypePart] = typeLine.split("—").map(s => s.trim());
  const mainTokens = mainPart.split(/\s+/).filter(Boolean);

  const supertypes: string[] = [];
  const types: string[] = [];

  for (const token of mainTokens) {
    const lower = token.toLowerCase();
    if (SUPERTYPES.has(lower)) {
      supertypes.push(lower);
    } else if (CARD_TYPES.has(lower)) {
      types.push(lower);
    }
    // Ignore tokens like "//" for DFC type lines
  }

  const subtypes = subtypePart
    ? subtypePart.split(/\s+/).filter(Boolean).map(s => s.toLowerCase())
    : [];

  return { supertypes, types, subtypes };
}

function parseManaCostSymbols(manaCost: string | null): string[] {
  if (!manaCost) return [];
  const matches = manaCost.match(/\{[^}]+\}/g);
  return matches || [];
}

function parseNumeric(value: string | null): { numeric: number | null; isVariable: boolean } {
  if (value === null) return { numeric: null, isVariable: false };
  if (value === "*" || value.includes("*")) return { numeric: null, isVariable: true };
  const n = parseFloat(value);
  return { numeric: isNaN(n) ? null : n, isVariable: false };
}

function normalizeFace(face: {
  name: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  colors?: string[];
  power?: string | null;
  toughness?: string | null;
  loyalty?: string | null;
  keywords?: string[];
}): NormalizedFace {
  return {
    name: face.name || "",
    manaCost: face.mana_cost || null,
    cmc: null, // faces don't always have separate CMC
    typeLine: face.type_line || "",
    oracleText: face.oracle_text || null,
    colors: face.colors || [],
    power: face.power || null,
    toughness: face.toughness || null,
    loyalty: face.loyalty || null,
    keywords: face.keywords || [],
  };
}

export function normalizeCard(card: Card): NormalizedCard {
  // For DFCs, use face data to fill in missing top-level fields
  const faces: NormalizedFace[] = card.card_faces
    ? card.card_faces.map(normalizeFace)
    : [];

  const hasFaces = faces.length > 0;

  // Effective values — prefer top-level, fall back to first face
  const effectiveManaCost = card.mana_cost ?? (hasFaces ? faces[0].manaCost : null);
  const effectiveOracleText = card.oracle_text ?? (hasFaces ? faces[0].oracleText : null);
  const effectiveColors = card.colors.length > 0
    ? card.colors
    : (hasFaces ? faces[0].colors : []);
  const effectivePower = card.power ?? (hasFaces ? faces[0].power : null);
  const effectiveToughness = card.toughness ?? (hasFaces ? faces[0].toughness : null);

  // Parse type line (use top-level which includes both faces for DFCs)
  // For DFCs like "Creature — Human Wizard // Creature — Human Insect",
  // split on // and parse each half
  const typeLineParts = card.type_line.split("//").map(s => s.trim());
  const allParsed = typeLineParts.map(parseTypeLine);

  const typeTokens = [...new Set(allParsed.flatMap(p => p.types))];
  const subtypeTokens = [...new Set(allParsed.flatMap(p => p.subtypes))];
  const supertypeTokens = [...new Set(allParsed.flatMap(p => p.supertypes))];

  // Combine all oracle text across faces
  const allOracleTexts: string[] = [];
  if (card.oracle_text) allOracleTexts.push(card.oracle_text);
  for (const face of faces) {
    if (face.oracleText) allOracleTexts.push(face.oracleText);
  }
  const allOracleTextCombined = allOracleTexts.join("\n");

  // All face names (for name matching)
  const allFaceNamesLower = hasFaces
    ? faces.map(f => f.name.toLowerCase())
    : [card.name.toLowerCase()];
  // Also add the full DFC name
  if (hasFaces) {
    allFaceNamesLower.push(card.name.toLowerCase());
  }

  // Parse numeric P/T
  const powerParsed = parseNumeric(effectivePower);
  const toughnessParsed = parseNumeric(effectiveToughness);

  // Mana cost symbols
  const manaCostSymbols = parseManaCostSymbols(effectiveManaCost);

  // Precomputed booleans
  const oracleTextLower = allOracleTextCombined.toLowerCase() || null;
  const entersTappedTextPresent = oracleTextLower
    ? /enters (the battlefield )?tapped/.test(oracleTextLower)
    : false;
  const targetWordPresent = oracleTextLower
    ? /\btarget\b/.test(oracleTextLower)
    : false;

  return {
    id: card.id,
    oracleId: card.oracle_id,
    name: card.name,
    layout: card.layout,

    manaCost: effectiveManaCost,
    cmc: card.cmc,
    typeLine: card.type_line,
    oracleText: effectiveOracleText,

    colors: effectiveColors,
    colorIdentity: card.color_identity,
    keywords: card.keywords.map(k => k.toLowerCase()),

    power: effectivePower,
    toughness: effectiveToughness,
    loyalty: card.loyalty,

    rarity: card.rarity,
    artist: card.artist,
    flavorText: card.flavor_text,

    legalities: card.legalities,
    producedMana: card.produced_mana || [],
    allSets: card.all_sets || [],
    allYears: (card.all_years || []).map(y => typeof y === "string" ? parseInt(y) : y),

    cardFaces: faces,
    hasFaces,

    typeTokens,
    subtypeTokens,
    supertypeTokens,
    nameLower: card.name.toLowerCase(),
    allFaceNamesLower,

    oracleTextLower,
    allOracleTextCombined,

    numericPower: powerParsed.numeric,
    numericToughness: toughnessParsed.numeric,
    powerIsVariable: powerParsed.isVariable,
    toughnessIsVariable: toughnessParsed.isVariable,

    manaCostSymbols,

    entersTappedTextPresent,
    targetWordPresent,

    semantics: getSemanticsForCard(card.name),
  };
}
