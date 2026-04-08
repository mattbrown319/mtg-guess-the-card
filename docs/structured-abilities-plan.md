# Structured Abilities Plan

## Summary

Add a supplementary `abilities[]` model to each card's semantic data. This does NOT replace the existing flat boolean summary — it adds ability-level structure for questions the flat model can't answer.

## Why

Flat booleans answer "does it do X?" but fail on "how does it do X?":
- "Does it tap to activate?" — need cost structure
- "Can it produce 2 colorless?" — need mana output amount (Sonnet got this WRONG for Mana Vault)
- "Does it sacrifice itself to activate?" — need to distinguish cost from effect
- "How many activated abilities?" — need ability count
- "Does the activated ability target?" — need per-ability targeting

These questions currently fall to Sonnet and sometimes get wrong answers.

## Architecture

Three layers of card understanding:
- **Layer A: Flat semantic summary** — broad "does it do X?" facts. Fast path, ~120 query kinds. Keep as-is.
- **Layer B: Structured abilities** — per-ability cost/effect/targeting/quantities. For "how" questions.
- **Layer C: Raw oracle text** — audit, debugging, Sonnet fallback for unmodeled questions.

## Schema

```ts
interface StructuredAbility {
  abilityType: "activated" | "triggered" | "static" | "mana" | "spell_effect";
  rawText: string;

  trigger?: {
    pattern?: string;   // "upkeep", "dies", "enters_battlefield", "attack", etc.
    rawCondition?: string;
  };

  cost?: {
    hasTap: boolean;
    manaCost?: string | null;
    paysLife?: number | null;
    sacrificesSelf: boolean;
    sacrificesOther: boolean;
    sacrificeQuantity?: number | null;
    sacrificeDescription?: string | null;
    discardsCards?: number | null;
    removesCounters?: boolean;
    otherCostText?: string | null;
  };

  targeting?: {
    hasTargets: boolean;
    targetKinds: string[];
  };

  effects?: {
    addsMana?: {
      manaProduced?: string | null;   // "{C}{C}{C}"
      colors: string[];               // ["C"]
      amount?: number | null;         // 3
      anyColor?: boolean;
    } | null;

    drawsCards?: {
      amount?: number | null;
      forController?: boolean;
      forOpponent?: boolean;
    } | null;

    gainsLife?: { amount?: number | null } | null;
    causesLifeLoss?: { amount?: number | null } | null;

    createsTokens?: {
      tokenDescriptions: string[];
      quantity?: number | null;
    } | null;

    grantsCounters?: {
      counterType?: string | null;
      quantity?: number | null;
    } | null;

    modifiesPT?: {
      powerDelta?: number | null;
      toughnessDelta?: number | null;
      usesCounters?: boolean;
    } | null;

    untaps?: boolean;
    taps?: boolean;
    destroys?: string[];
    exiles?: string[];
    bounces?: string[];
    reanimates?: string[];
  };

  flags?: {
    isManaAbility: boolean;
    isModal: boolean;
    isConditional: boolean;
  };

  audit?: {
    confidenceNotes?: string[];
    unparsedFragments?: string[];
  };
}
```

## Key design decisions

1. **Partial extraction is OK** — not every field needs to be filled. `hasTap: true, manaProduced: "{C}{C}{C}"` with everything else null is still useful.
2. **rawText per ability** — always stored for audit/debug and scoped Sonnet fallback.
3. **Don't deeply encode modals/conditionals** — flag `isModal: true` but don't decompose branches.
4. **Don't attempt a full MTG rules AST** — this is "subset of structure that helps answer real questions."

## High-value query kinds this enables

- `activated_ability_has_tap_cost`
- `activated_ability_requires_mana`
- `activated_ability_sacrifices_self`
- `activated_ability_sacrifice_quantity`
- `ability_count` (activated / triggered)
- `ability_targets_kind` (per-ability)
- `mana_produced_amount`
- `activated_ability_produces_mana_amount`

## Implementation plan

### Stage 1: Define schema
Add `StructuredAbility` interface to the codebase. Design the classification prompt additions.

### Stage 2: Targeted sample (~30-50 cards)
Run on adversarial cards before committing to full sweep:
- Mana rocks: Sol Ring, Mana Vault, Mana Crypt, Arcane Signet, Chromatic Lantern
- Sacrifice outlets: Priest of Forgotten Gods, Arcbound Ravager, Ashnod's Altar, Viscera Seer
- Planeswalkers: Jace the Mind Sculptor, Liliana of the Veil, Teferi Time Raveler
- Multiple activated abilities: Deathrite Shaman, Figure of Destiny
- Mixed trigger + activated: Aetherflux Reservoir, Breya
- Known problem cards: Mana Vault, Priest of Forgotten Gods, Scalding Tarn

### Stage 3: Validate and refine
Check sample output, adjust schema/prompt, fix edge cases.

### Stage 4: Full sweep
Run on all 910 iconic cards. Wire resolvers for new query kinds.

## Timeline

Not a launch blocker — flat booleans + Sonnet fallback handle these questions adequately for now. Target for v3.2 or v3.3, after the next flat-field sweep is done.
