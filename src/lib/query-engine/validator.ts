import type { StructuredQuery, StructuredQueryEnvelope } from "./types";

const VALID_ATOMIC_KINDS = new Set([
  // Direct
  "type_contains", "subtype_contains", "supertype_contains",
  "has_any_subtype", "has_multiple_card_types",
  "color_contains", "color_count_compare", "color_identity_contains",
  "guild_equals", "shard_wedge_equals",
  "cmc_compare",
  "mana_cost_equals", "mana_cost_contains_symbol", "mana_cost_has_generic",
  "power_compare", "toughness_compare", "power_vs_toughness",
  "keyword_contains", "keyword_count_compare",
  "rarity_equals",
  "legality_equals",
  "printed_in_set", "printed_in_year_compare",
  "name_equals", "name_contains",
  "produces_mana", "produces_mana_color", "produces_any_color", "produces_multiple_colors",
  "oracle_text_contains",
  // Derived
  "is_permanent", "creates_tokens", "enters_tapped", "can_enter_untapped",
  "targets", "triggered_ability", "activated_ability", "etb_ability",
  "has_mana_ability", "has_non_mana_ability",
]);

const VALID_COLORS = new Set(["W", "U", "B", "R", "G"]);
const VALID_MANA_COLORS = new Set(["W", "U", "B", "R", "G", "C"]);
const VALID_OPERATORS = new Set(["=", "<", "<=", ">", ">="]);
const VALID_RARITIES = new Set(["common", "uncommon", "rare", "mythic"]);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateQuery(query: StructuredQuery, errors: string[], path: string): void {
  if (!query || typeof query !== "object") {
    errors.push(`${path}: query is not an object`);
    return;
  }

  if (!("kind" in query)) {
    errors.push(`${path}: missing 'kind' field`);
    return;
  }

  switch (query.kind) {
    case "and":
    case "or":
      if (!Array.isArray(query.clauses) || query.clauses.length === 0) {
        errors.push(`${path}: ${query.kind} requires non-empty clauses array`);
      } else {
        for (let i = 0; i < query.clauses.length; i++) {
          validateQuery(query.clauses[i], errors, `${path}.clauses[${i}]`);
        }
      }
      break;

    case "not":
      if (!query.clause || typeof query.clause !== "object") {
        errors.push(`${path}: not requires a clause object`);
      } else {
        validateQuery(query.clause, errors, `${path}.clause`);
      }
      break;

    case "unsupported":
      // Valid — will be handled as refund
      break;

    default: {
      // Atomic query — validate kind and arguments
      if (!VALID_ATOMIC_KINDS.has(query.kind)) {
        errors.push(`${path}: unknown query kind '${query.kind}'`);
        break;
      }

      // Validate specific argument requirements
      const q = query as Record<string, unknown>;

      // Queries requiring "value" string
      if (["type_contains", "subtype_contains", "supertype_contains",
           "guild_equals", "shard_wedge_equals",
           "mana_cost_equals", "mana_cost_contains_symbol",
           "keyword_contains", "rarity_equals",
           "printed_in_set", "name_equals", "name_contains"].includes(query.kind)) {
        if (typeof q.value !== "string" || !q.value) {
          errors.push(`${path}: ${query.kind} requires a non-empty string 'value'`);
        }
      }

      // Color validation
      if (query.kind === "color_contains" || query.kind === "color_identity_contains") {
        if (!VALID_COLORS.has(q.value as string)) {
          errors.push(`${path}: ${query.kind} value must be one of W/U/B/R/G, got '${q.value}'`);
        }
      }

      if (query.kind === "produces_mana_color") {
        if (!VALID_MANA_COLORS.has(q.value as string)) {
          errors.push(`${path}: produces_mana_color value must be one of W/U/B/R/G/C, got '${q.value}'`);
        }
      }

      // Rarity validation
      if (query.kind === "rarity_equals") {
        if (!VALID_RARITIES.has((q.value as string)?.toLowerCase())) {
          errors.push(`${path}: rarity_equals value must be common/uncommon/rare/mythic, got '${q.value}'`);
        }
      }

      // Comparison queries requiring operator + value
      if (["cmc_compare", "power_compare", "toughness_compare",
           "color_count_compare", "keyword_count_compare",
           "printed_in_year_compare"].includes(query.kind)) {
        if (!VALID_OPERATORS.has(q.operator as string)) {
          errors.push(`${path}: ${query.kind} requires valid operator (= < <= > >=), got '${q.operator}'`);
        }
        if (typeof q.value !== "number") {
          errors.push(`${path}: ${query.kind} requires numeric value, got '${q.value}'`);
        }
      }

      // power_vs_toughness
      if (query.kind === "power_vs_toughness") {
        if (!VALID_OPERATORS.has(q.relation as string)) {
          errors.push(`${path}: power_vs_toughness requires valid relation (= < <= > >=), got '${q.relation}'`);
        }
      }

      // legality_equals
      if (query.kind === "legality_equals") {
        if (typeof q.format !== "string" || !q.format) {
          errors.push(`${path}: legality_equals requires 'format' string`);
        }
        if (typeof q.value !== "string" || !q.value) {
          errors.push(`${path}: legality_equals requires 'value' string`);
        }
      }

      break;
    }
  }
}

export function validateEnvelope(envelope: StructuredQueryEnvelope): ValidationResult {
  const errors: string[] = [];

  if (!envelope.query) {
    errors.push("root: missing 'query' field");
    return { valid: false, errors };
  }

  validateQuery(envelope.query, errors, "query");

  return { valid: errors.length === 0, errors };
}
