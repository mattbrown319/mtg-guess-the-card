# Semantic Classification Pipeline

## Overview

The pipeline classifies card oracle text into structured semantic data using Sonnet, then applies corrections and migrations. Designed to be re-run safely — idempotent at every step.

## Quick Reference

```bash
# Full sweep (all iconic cards, ~1 hour, ~$35)
./scripts/run-sweep.sh

# Partial sweep (first 50 unclassified)
./scripts/run-sweep.sh --limit 50

# Just apply overrides + migrations (no API calls)
./scripts/run-sweep.sh --sample

# Sync is_iconic to Turso after card pool changes
npx tsx scripts/sync-iconic-to-turso.ts
```

## Pipeline Steps

### 1. Card Pool Changes (before sweep)
- Add/remove cards by setting `is_iconic` in local `data/cards.db`
- Sync to Turso: `npx tsx scripts/sync-iconic-to-turso.ts`

### 2. Sonnet Classification (`scripts/classify-cards.ts`)
- Reads all `is_iconic = 1` cards from local DB
- Calls Sonnet to classify each card's oracle text
- Saves to `data/semantics/{CardName}.json`
- Tracks progress in `data/semantics/progress.json` (resumable)
- Skips already-classified cards
- **To force reclassification:** delete `progress.json` and the card's JSON

### 3. Schema Migrations (`scripts/apply-schema-migrations.ts`)
- Field renames (e.g. `targetsOnCastOrActivation` → `hasTargeting`)
- New field defaults
- Applied to ALL semantic JSON files
- Idempotent — safe to run multiple times
- **Add new migrations:** edit the `MIGRATIONS` array in the script

### 4. Manual Overrides (`scripts/apply-overrides.ts`)
- Corrections for known Sonnet errors
- Stored in `data/semantics/overrides.json`
- Applied AFTER classification and migrations
- Idempotent — checks current value before writing
- **Add new overrides:** add entries to `overrides.json`

### 5. Validation (`scripts/validate-semantics.ts`)
- Catches contradictions (e.g. drawsCards=false but drawsCardsForOpponent=true)
- Validates keyword lists
- Run manually: `npx tsx scripts/validate-semantics.ts` (not yet wired into pipeline)

### 6. Testing & Deployment
- Run resolver tests: `npx tsx scripts/test-query-engine.ts`
- Run translator tests: `npx tsx scripts/test-translator.ts`
- Commit, push, deploy: `git add data/semantics/ && git commit && git push && railway up`

## Key Files

| File | Purpose |
|------|---------|
| `data/semantics/{Card}.json` | Per-card semantic data |
| `data/semantics/overrides.json` | Manual corrections (source of truth) |
| `data/semantics/progress.json` | Classification progress (gitignored) |
| `data/semantics/errors.json` | Classification errors (gitignored) |
| `data/semantics/MANUAL_OVERRIDES.md` | Human-readable override docs |
| `data/next-sweep-fields.md` | Wish list for next sweep |
| `scripts/classification-prompt.ts` | Sonnet system prompt |
| `scripts/validate-semantics.ts` | Post-classification validation |

## Adding Overrides

When you discover a Sonnet classification error:

1. Add to `data/semantics/overrides.json`:
```json
{
  "card": "Card Name",
  "field": "structure.hasAlternativeCost",
  "value": false,
  "reason": "Why this is wrong"
}
```

2. Run: `npx tsx scripts/apply-overrides.ts`

The override will persist across future sweeps.

## Scaling

- **910 → 1000 cards:** just add cards to pool and run sweep (progress tracking skips existing)
- **1000 → 2000 cards:** same process, ~2 hours, ~$70
- **2000 → 33000 cards:** ~33 hours, ~$1100. Consider batching by set/era.
