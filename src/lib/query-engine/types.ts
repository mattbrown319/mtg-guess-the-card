import type { TruthValue } from "./truth";
import type { OracleSemanticSummary } from "./oracle-semantics";

// ============================================================
// Normalized Card
// ============================================================

export interface NormalizedFace {
  name: string;
  manaCost: string | null;
  cmc: number | null;
  typeLine: string;
  oracleText: string | null;
  colors: string[];
  power: string | null;
  toughness: string | null;
  loyalty: string | null;
  keywords: string[];
}

export interface NormalizedCard {
  id: string;
  oracleId: string;
  name: string;
  layout: string;

  manaCost: string | null;
  cmc: number;
  typeLine: string;
  oracleText: string | null;

  colors: string[];
  colorIdentity: string[];
  keywords: string[];

  power: string | null;
  toughness: string | null;
  loyalty: string | null;

  rarity: string;
  artist: string;
  flavorText: string | null;

  legalities: Record<string, string>;
  producedMana: string[];
  allSets: string[];
  allYears: number[];

  cardFaces: NormalizedFace[];
  hasFaces: boolean;

  // Precomputed convenience fields
  typeTokens: string[];
  subtypeTokens: string[];
  supertypeTokens: string[];
  nameLower: string;
  allFaceNamesLower: string[];

  oracleTextLower: string | null;
  allOracleTextCombined: string;

  numericPower: number | null;
  numericToughness: number | null;
  powerIsVariable: boolean;
  toughnessIsVariable: boolean;

  manaCostSymbols: string[];

  entersTappedTextPresent: boolean;
  targetWordPresent: boolean;

  // Oracle semantic summary (loaded from pre-classified data)
  semantics?: OracleSemanticSummary;
}

// ============================================================
// Structured Query AST
// ============================================================

export type ComparisonOperator = "=" | "<" | "<=" | ">" | ">=";

export type AtomicQuery =
  // Type
  | { kind: "type_contains"; value: string }
  | { kind: "subtype_contains"; value: string }
  | { kind: "supertype_contains"; value: string }
  | { kind: "has_any_subtype" }
  | { kind: "has_multiple_card_types" }

  // Color
  | { kind: "color_contains"; value: string }
  | { kind: "color_count_compare"; operator: ComparisonOperator; value: number }
  | { kind: "color_identity_contains"; value: string }
  | { kind: "guild_equals"; value: string }
  | { kind: "shard_wedge_equals"; value: string }

  // CMC
  | { kind: "cmc_compare"; operator: ComparisonOperator; value: number }

  // Mana cost
  | { kind: "mana_cost_equals"; value: string }
  | { kind: "mana_cost_contains_symbol"; value: string }
  | { kind: "mana_cost_has_generic"; value?: number | null }

  // Power / Toughness
  | { kind: "power_compare"; operator: ComparisonOperator; value: number }
  | { kind: "toughness_compare"; operator: ComparisonOperator; value: number }
  | { kind: "power_vs_toughness"; relation: ComparisonOperator }

  // Keywords
  | { kind: "keyword_contains"; value: string }
  | { kind: "keyword_count_compare"; operator: ComparisonOperator; value: number }

  // Rarity
  | { kind: "rarity_equals"; value: string }

  // Legality
  | { kind: "legality_equals"; format: string; value: string }

  // Printing
  | { kind: "printed_in_set"; value: string }
  | { kind: "printed_in_year_compare"; operator: ComparisonOperator; value: number }

  // Name
  | { kind: "name_equals"; value: string }
  | { kind: "name_contains"; value: string }

  // Mana production
  | { kind: "produces_mana" }
  | { kind: "produces_mana_color"; value: string }
  | { kind: "produces_any_color" }
  | { kind: "produces_multiple_colors" }

  // Derived
  | { kind: "is_permanent" }
  | { kind: "draws_cards" }
  | { kind: "deals_damage" }
  | { kind: "gains_life" }
  | { kind: "causes_life_loss" }
  | { kind: "destroys_permanents" }
  | { kind: "exiles" }
  | { kind: "causes_discard" }
  | { kind: "searches_library" }
  | { kind: "interacts_with_graveyard" }
  | { kind: "sacrifice_effect" }
  | { kind: "is_modal" }
  | { kind: "creates_tokens" }
  | { kind: "enters_tapped" }
  | { kind: "can_enter_untapped" }
  | { kind: "targets" }
  | { kind: "triggered_ability" }
  | { kind: "activated_ability" }
  | { kind: "etb_ability" }
  | { kind: "has_mana_ability" }
  | { kind: "has_non_mana_ability" }
  | { kind: "static_ability" }
  | { kind: "replacement_effect" }
  | { kind: "prevention_effect" }
  | { kind: "leaves_battlefield_trigger" }
  | { kind: "dies_trigger" }
  | { kind: "attack_trigger" }
  | { kind: "block_trigger" }
  | { kind: "upkeep_trigger" }
  | { kind: "combat_damage_trigger" }
  | { kind: "has_additional_cost" }
  | { kind: "has_alternative_cost" }
  | { kind: "has_kicker_or_optional_cost" }
  | { kind: "mills_cards" }
  | { kind: "surveils" }
  | { kind: "scries" }
  | { kind: "looks_at_top_of_library" }
  | { kind: "shuffles_library" }
  | { kind: "adds_mana" }
  | { kind: "counters_spells" }
  | { kind: "copies_spells" }
  | { kind: "copies_permanents" }
  | { kind: "taps_things" }
  | { kind: "untaps_things" }
  | { kind: "grants_abilities" }
  | { kind: "grants_pt_bonus" }
  | { kind: "grants_pt_penalty" }
  | { kind: "uses_plus_one_counters" }
  | { kind: "uses_minus_one_counters" }
  | { kind: "fetches_land" }
  | { kind: "fetches_basic_land" }
  | { kind: "lets_play_extra_lands" }
  | { kind: "pays_life" }
  | { kind: "takes_extra_turn" }
  | { kind: "prevents_damage" }
  | { kind: "redirects_damage" }
  | { kind: "animates_self" }
  | { kind: "animates_other" }
  | { kind: "restricts_actions" }
  | { kind: "taxes_opponent" }
  | { kind: "reduces_costs" }
  | { kind: "flickers_or_blinks" }
  | { kind: "cares_about_creatures" }
  | { kind: "cares_about_artifacts" }
  | { kind: "cares_about_enchantments" }
  | { kind: "cares_about_lands" }
  | { kind: "cares_about_cards_drawn" }
  | { kind: "cares_about_discard" }
  | { kind: "cares_about_life_gain_or_loss" }
  | { kind: "cares_about_counters" }
  | { kind: "cares_about_casting_spells" }
  | { kind: "cares_about_death" }
  | { kind: "cares_about_combat" }
  | { kind: "cares_about_power_or_toughness" }
  | { kind: "cares_about_tokens" }
  // Granular action queries (break out from grouped kinds)
  | { kind: "destroys_creature" }
  | { kind: "destroys_artifact" }
  | { kind: "destroys_enchantment" }
  | { kind: "destroys_land" }
  | { kind: "exiles_creature" }
  | { kind: "exiles_from_graveyard" }
  | { kind: "exiles_from_hand" }
  | { kind: "exiles_from_library" }
  | { kind: "reanimates_self" }
  | { kind: "reanimates_other" }
  | { kind: "returns_to_hand" }
  | { kind: "bounces_creature" }
  | { kind: "bounces_permanent" }
  | { kind: "sacrifices_own_permanent" }
  | { kind: "forces_opponent_sacrifice" }
  | { kind: "draws_cards_for_controller" }
  | { kind: "draws_cards_for_opponent" }
  | { kind: "discards_for_controller" }
  | { kind: "forces_opponent_discard" }
  | { kind: "gains_life_for_controller" }
  | { kind: "gains_life_for_opponent" }
  | { kind: "causes_life_loss_for_controller" }
  | { kind: "causes_life_loss_for_opponent" }
  | { kind: "grants_keywords" }
  | { kind: "grants_evasion" }
  | { kind: "modifies_power" }
  | { kind: "modifies_toughness" }
  | { kind: "adds_other_counters" }
  | { kind: "filters_mana" }
  | { kind: "can_add_any_color" }
  | { kind: "can_add_multiple_colors" }
  | { kind: "makes_monarch" }
  | { kind: "creates_emblem" }
  | { kind: "phase_out" }
  // Conditions not yet wired
  | { kind: "cares_about_nonbasic_lands" }
  | { kind: "cares_about_instants_and_sorceries" }
  | { kind: "cares_about_enter_battlefield" }
  | { kind: "cares_about_leave_battlefield" }
  | { kind: "cares_about_damage" }
  | { kind: "cares_about_tapped_untapped" }
  | { kind: "cares_about_colors" }
  | { kind: "cares_about_mana_spent" }
  | { kind: "cares_about_equipment" }
  | { kind: "cares_about_auras" }
  // Parameterized targeting
  | { kind: "targets_kind"; value: string };

export type StructuredQuery =
  | { kind: "and"; clauses: StructuredQuery[] }
  | { kind: "or"; clauses: StructuredQuery[] }
  | { kind: "not"; clause: StructuredQuery }
  | AtomicQuery
  | { kind: "unsupported" }
  | { kind: "subjective" };

// ============================================================
// Query Envelope
// ============================================================

export interface StructuredQueryEnvelope {
  query: StructuredQuery;
  meta: {
    supported: boolean;
    usedContext: boolean;
    warnings: string[];
    translatorModel: "haiku";
  };
}

// ============================================================
// Engine Result
// ============================================================

export type EngineOutcome = "yes" | "no" | "sometimes" | "refund";

export interface EngineResult {
  outcome: EngineOutcome;
  playerMessage: string;
  reasonCode?: string;
  translatedQuery?: StructuredQueryEnvelope;
  truthValue?: TruthValue;
}

// ============================================================
// Query Kind Registry
// ============================================================

export interface QueryKindDefinition {
  kind: string;
  layer: "direct" | "pattern_derived" | "semantic_derived";
  canReturnSometimes: boolean;
  description: string;
  examples: string[];
  edgeCases: string[];
}
