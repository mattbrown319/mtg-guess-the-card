# Manual Overrides to Semantic Data

These changes were made manually after the initial Sonnet classification.
When running a new sweep, either:
1. Fix the classification prompt so Sonnet gets them right
2. Re-apply these overrides after the sweep

## hasAlternativeCost → false (cycling/equip are NOT alternative casting costs)
- Cast Out (had cycling)
- Lórien Revealed (had cycling)
- Miscalculation (had cycling)
- Shark Typhoon (had cycling)
- Unearth (had cycling)
- Cranial Plating (had alternate equip {B}{B} — not an alternative CASTING cost)
- Bolas's Citadel (grants alternative costs to OTHER spells, not itself)
- Dream Halls (grants alternative costs to OTHER spells, not itself)

## targetKinds fix
- Jace, Vryn's Prodigy // Jace, Telepath Unbound: bare "instant" and "sorcery" → "instant or sorcery card in graveyard" (his -3 targets cards in graveyard)

## hasTargeting rename (schema-wide)
- All 1000 cards: `targetsOnCastOrActivation` → `hasTargeting` (field rename, done via script)

## Dack Fayden recipient fix
- drawsCardsForController: true, drawsCardsForOpponent: true (target player draws)
- discardsForController: true, forcesOpponentDiscard: true (target player discards)
