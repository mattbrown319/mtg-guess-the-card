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
  | { kind: "has_non_mana_ability" };

export type StructuredQuery =
  | { kind: "and"; clauses: StructuredQuery[] }
  | { kind: "or"; clauses: StructuredQuery[] }
  | { kind: "not"; clause: StructuredQuery }
  | AtomicQuery
  | { kind: "unsupported" };

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
