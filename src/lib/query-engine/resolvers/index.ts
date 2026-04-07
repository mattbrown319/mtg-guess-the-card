import type { AtomicQuery, NormalizedCard } from "../types";
import type { TruthValue } from "../truth";
import { resolveDirectQuery } from "./direct";
import { resolveDerivedQuery } from "./derived";

const DIRECT_KINDS = new Set([
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
]);

const DERIVED_KINDS = new Set([
  // Layer 2a — pattern-derived
  "is_permanent", "creates_tokens", "enters_tapped", "can_enter_untapped",
  "triggered_ability", "activated_ability", "etb_ability",
  "has_mana_ability", "has_non_mana_ability", "is_modal",
  // Layer 2b — semantic-derived (actions)
  "draws_cards", "deals_damage", "gains_life", "causes_life_loss",
  "destroys_permanents", "exiles", "causes_discard", "searches_library",
  "interacts_with_graveyard", "sacrifice_effect", "targets",
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
  // Layer 2b — semantic-derived (conditions)
  "cares_about_creatures", "cares_about_artifacts", "cares_about_enchantments",
  "cares_about_lands", "cares_about_cards_drawn", "cares_about_discard",
  "cares_about_life_gain_or_loss", "cares_about_counters",
  "cares_about_casting_spells", "cares_about_death",
  "cares_about_combat", "cares_about_power_or_toughness", "cares_about_tokens",
]);

export function resolveAtomicQuery(
  query: AtomicQuery,
  card: NormalizedCard
): TruthValue | null {
  if (DIRECT_KINDS.has(query.kind)) {
    return resolveDirectQuery(query, card);
  }
  if (DERIVED_KINDS.has(query.kind)) {
    return resolveDerivedQuery(query, card);
  }
  // Unknown kind
  return null;
}
