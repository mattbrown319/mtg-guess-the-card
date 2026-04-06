import type { AtomicQuery, NormalizedCard } from "../types";
import type { TruthValue } from "../truth";
import { compareValues } from "../evaluator";

// Guild / shard / wedge color mappings
const GUILD_MAP: Record<string, string[]> = {
  azorius: ["W", "U"], dimir: ["U", "B"], rakdos: ["B", "R"],
  gruul: ["R", "G"], selesnya: ["G", "W"], orzhov: ["W", "B"],
  izzet: ["U", "R"], golgari: ["B", "G"], boros: ["R", "W"],
  simic: ["G", "U"],
};

const SHARD_WEDGE_MAP: Record<string, string[]> = {
  esper: ["W", "U", "B"], grixis: ["U", "B", "R"], jund: ["B", "R", "G"],
  naya: ["R", "G", "W"], bant: ["G", "W", "U"],
  abzan: ["W", "B", "G"], jeskai: ["U", "R", "W"], sultai: ["B", "G", "U"],
  mardu: ["R", "W", "B"], temur: ["G", "U", "R"],
  // Aliases
  junk: ["W", "B", "G"], bug: ["B", "G", "U"],
};

function colorsMatch(cardColors: string[], targetColors: string[]): boolean {
  const cardSet = new Set(cardColors);
  const targetSet = new Set(targetColors);
  if (cardSet.size !== targetSet.size) return false;
  for (const c of targetSet) {
    if (!cardSet.has(c)) return false;
  }
  return true;
}

export function resolveDirectQuery(
  query: AtomicQuery,
  card: NormalizedCard
): TruthValue | null {
  switch (query.kind) {
    // ==================== TYPE ====================
    case "type_contains": {
      const val = query.value.toLowerCase();
      // Check for conditional creature (Theros gods, etc.)
      if (val === "creature" && card.typeTokens.includes("creature")) {
        // Check if oracle text says it conditionally isn't a creature
        if (card.oracleTextLower && /isn't a creature/.test(card.oracleTextLower)) {
          return "sometimes";
        }
        return "yes";
      }
      return card.typeTokens.includes(val) ? "yes" : "no";
    }

    case "subtype_contains":
      return card.subtypeTokens.includes(query.value.toLowerCase()) ? "yes" : "no";

    case "supertype_contains":
      return card.supertypeTokens.includes(query.value.toLowerCase()) ? "yes" : "no";

    case "has_any_subtype":
      return card.subtypeTokens.length > 0 ? "yes" : "no";

    case "has_multiple_card_types":
      return card.typeTokens.length > 1 ? "yes" : "no";

    // ==================== COLOR ====================
    case "color_contains":
      return card.colors.includes(query.value) ? "yes" : "no";

    case "color_count_compare":
      return compareValues(card.colors.length, query.operator, query.value) ? "yes" : "no";

    case "color_identity_contains":
      return card.colorIdentity.includes(query.value) ? "yes" : "no";

    case "guild_equals": {
      const target = GUILD_MAP[query.value.toLowerCase()];
      if (!target) return null;
      return colorsMatch(card.colors, target) ? "yes" : "no";
    }

    case "shard_wedge_equals": {
      const target = SHARD_WEDGE_MAP[query.value.toLowerCase()];
      if (!target) return null;
      return colorsMatch(card.colors, target) ? "yes" : "no";
    }

    // ==================== CMC ====================
    case "cmc_compare":
      return compareValues(card.cmc, query.operator, query.value) ? "yes" : "no";

    // ==================== MANA COST ====================
    case "mana_cost_equals": {
      if (!card.manaCost) return "no";
      return card.manaCost.toLowerCase() === query.value.toLowerCase() ? "yes" : "no";
    }

    case "mana_cost_contains_symbol": {
      if (!card.manaCost) return "no";
      return card.manaCost.toLowerCase().includes(query.value.toLowerCase()) ? "yes" : "no";
    }

    case "mana_cost_has_generic": {
      if (!card.manaCost) return "no";
      // Generic mana symbols are {1}, {2}, {3}, etc. (NOT {C} which is colorless)
      const genericMatch = card.manaCostSymbols.filter(s => /^\{\d+\}$/.test(s));
      if (query.value !== undefined && query.value !== null) {
        return genericMatch.some(s => s === `{${query.value}}`) ? "yes" : "no";
      }
      return genericMatch.length > 0 ? "yes" : "no";
    }

    // ==================== POWER / TOUGHNESS ====================
    case "power_compare": {
      if (card.powerIsVariable) return "sometimes";
      if (card.numericPower === null) return "no";
      return compareValues(card.numericPower, query.operator, query.value) ? "yes" : "no";
    }

    case "toughness_compare": {
      if (card.toughnessIsVariable) return "sometimes";
      if (card.numericToughness === null) return "no";
      return compareValues(card.numericToughness, query.operator, query.value) ? "yes" : "no";
    }

    case "power_vs_toughness": {
      if (card.powerIsVariable || card.toughnessIsVariable) return "sometimes";
      if (card.numericPower === null || card.numericToughness === null) return "no";
      return compareValues(card.numericPower, query.relation, card.numericToughness) ? "yes" : "no";
    }

    // ==================== KEYWORDS ====================
    case "keyword_contains":
      return card.keywords.includes(query.value.toLowerCase()) ? "yes" : "no";

    case "keyword_count_compare":
      return compareValues(card.keywords.length, query.operator, query.value) ? "yes" : "no";

    // ==================== RARITY ====================
    case "rarity_equals":
      return card.rarity.toLowerCase() === query.value.toLowerCase() ? "yes" : "no";

    // ==================== LEGALITY ====================
    case "legality_equals": {
      const format = query.format.toLowerCase();
      const status = card.legalities[format];
      if (!status) return "no";
      return status.toLowerCase() === query.value.toLowerCase() ? "yes" : "no";
    }

    // ==================== PRINTING ====================
    case "printed_in_set": {
      const target = query.value.toLowerCase();
      return card.allSets.some(s => s.toLowerCase().includes(target)) ? "yes" : "no";
    }

    case "printed_in_year_compare": {
      if (card.allYears.length === 0) return "no";
      // For "printed before 2010" → any year < 2010
      // For "printed after 2020" → any year > 2020
      // For "printed in 2015" → any year = 2015
      if (query.operator === "=") {
        return card.allYears.includes(query.value) ? "yes" : "no";
      }
      // For inequality comparisons, check if ANY printing matches
      if (query.operator === "<" || query.operator === "<=") {
        return card.allYears.some(y => compareValues(y, query.operator, query.value)) ? "yes" : "no";
      }
      if (query.operator === ">" || query.operator === ">=") {
        return card.allYears.some(y => compareValues(y, query.operator, query.value)) ? "yes" : "no";
      }
      return "no";
    }

    // ==================== NAME ====================
    case "name_equals": {
      const target = query.value.toLowerCase();
      return card.allFaceNamesLower.some(n => n === target) ? "yes" : "no";
    }

    case "name_contains": {
      const target = query.value.toLowerCase();
      return card.allFaceNamesLower.some(n => n.includes(target)) ? "yes" : "no";
    }

    // ==================== MANA PRODUCTION ====================
    case "produces_mana":
      return card.producedMana.length > 0 ? "yes" : "no";

    case "produces_mana_color":
      return card.producedMana.includes(query.value) ? "yes" : "no";

    case "produces_any_color": {
      const colorMana = card.producedMana.filter(m => ["W", "U", "B", "R", "G"].includes(m));
      return colorMana.length > 0 ? "yes" : "no";
    }

    case "produces_multiple_colors": {
      const colorMana = new Set(card.producedMana.filter(m => ["W", "U", "B", "R", "G"].includes(m)));
      return colorMana.size > 1 ? "yes" : "no";
    }

    default:
      return null;
  }
}
