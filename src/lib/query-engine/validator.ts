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
  "produces_mana", "produces_mana_color", "produces_any_color", "produces_colored_mana", "produces_all_colors", "produces_multiple_colors",
  // Derived — pattern
  "is_permanent", "creates_tokens", "enters_tapped", "can_enter_untapped",
  "triggered_ability", "activated_ability", "etb_ability",
  "has_mana_ability", "has_non_mana_ability", "is_modal", "targets",
  // Derived — semantic (actions)
  "draws_cards", "deals_damage", "gains_life", "causes_life_loss",
  "destroys_permanents", "exiles", "causes_discard", "searches_library",
  "interacts_with_graveyard", "sacrifice_effect",
  "static_ability", "grants_abilities",
  "replacement_effect", "prevention_effect",
  "leaves_battlefield_trigger", "dies_trigger", "attack_trigger",
  "block_trigger", "upkeep_trigger", "combat_damage_trigger",
  "has_additional_cost", "has_alternative_cost", "has_kicker_or_optional_cost",
  "mills_cards", "surveils", "scries", "looks_at_top_of_library",
  "shuffles_library", "adds_mana", "counters_spells",
  "copies_spells", "copies_permanents",
  "taps_things", "untaps_things",
  "grants_pt_bonus", "grants_pt_penalty",
  "uses_plus_one_counters", "uses_minus_one_counters",
  "fetches_land", "fetches_basic_land", "lets_play_extra_lands",
  "pays_life", "takes_extra_turn",
  "prevents_damage", "redirects_damage",
  "animates_self", "animates_other",
  "restricts_actions", "taxes_opponent", "reduces_costs",
  "flickers_or_blinks",
  // Derived — semantic (conditions)
  "cares_about_creatures", "cares_about_artifacts", "cares_about_enchantments",
  "cares_about_lands", "cares_about_cards_drawn", "cares_about_discard",
  "cares_about_life_gain_or_loss", "cares_about_counters",
  "cares_about_casting_spells", "cares_about_death",
  "cares_about_combat", "cares_about_power_or_toughness", "cares_about_tokens",
  // Granular actions
  "destroys_creature", "destroys_artifact", "destroys_enchantment", "destroys_land",
  "exiles_creature", "exiles_from_graveyard", "exiles_from_hand", "exiles_from_library",
  "reanimates_self", "reanimates_other",
  "returns_to_hand", "bounces_creature", "bounces_permanent",
  "sacrifices_own_permanent", "forces_opponent_sacrifice",
  "draws_cards_for_controller", "draws_cards_for_opponent",
  "discards_for_controller", "forces_opponent_discard",
  "gains_life_for_controller", "gains_life_for_opponent",
  "causes_life_loss_for_controller", "causes_life_loss_for_opponent",
  "grants_keywords", "grants_evasion",
  "modifies_power", "modifies_toughness",
  "adds_other_counters", "filters_mana",
  "can_add_any_color", "can_add_multiple_colors",
  "makes_monarch", "creates_emblem", "phase_out",
  // Remaining conditions
  "cares_about_nonbasic_lands", "cares_about_instants_and_sorceries",
  "cares_about_enter_battlefield", "cares_about_leave_battlefield",
  "cares_about_damage", "cares_about_tapped_untapped",
  "cares_about_colors", "cares_about_mana_spent",
  "cares_about_equipment", "cares_about_auras",
  "targets_kind",
]);

const VALID_COLORS = new Set(["W", "U", "B", "R", "G"]);
const VALID_MANA_COLORS = new Set(["W", "U", "B", "R", "G", "C"]);
const VALID_OPERATORS = new Set(["=", "<", "<=", ">", ">="]);
const VALID_RARITIES = new Set(["common", "uncommon", "rare", "mythic"]);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  isNearMiss: boolean; // true = known kind but bad params (should fall back to Sonnet)
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
    case "subjective":
    case "ambiguous":
      // Valid — will be handled downstream
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
           "printed_in_set", "name_equals", "name_contains",
           "targets_kind"].includes(query.kind)) {
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
    return { valid: false, errors, isNearMiss: false };
  }

  validateQuery(envelope.query, errors, "query");

  // Near miss = the kind is known/valid but parameters are wrong
  // Hard fail = unknown kind, missing kind, malformed structure
  const isNearMiss = errors.length > 0 && errors.every(e =>
    !e.includes("unknown query kind") &&
    !e.includes("missing 'kind'") &&
    !e.includes("is not an object") &&
    !e.includes("requires non-empty clauses") &&
    !e.includes("requires a clause object")
  );

  return { valid: errors.length === 0, errors, isNearMiss };
}
