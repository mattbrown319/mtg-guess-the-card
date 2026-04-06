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
  // Layer 2a — pattern-derived (implemented)
  "is_permanent", "creates_tokens", "enters_tapped", "can_enter_untapped",
  "triggered_ability", "activated_ability", "etb_ability",
  "has_mana_ability", "has_non_mana_ability", "is_modal",
  // Layer 2b — semantic-derived (require oracle semantic extraction)
  // These return null (→ refund) until the extraction layer is built
  "draws_cards", "deals_damage", "gains_life", "causes_life_loss",
  "destroys_permanents", "exiles", "causes_discard", "searches_library",
  "interacts_with_graveyard", "sacrifice_effect", "targets",
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
