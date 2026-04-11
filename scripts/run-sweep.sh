#!/bin/bash
# Full semantic classification pipeline.
# Usage:
#   ./scripts/run-sweep.sh              # full sweep of all iconic cards
#   ./scripts/run-sweep.sh --limit 50   # sweep first 50 unclassified cards
#   ./scripts/run-sweep.sh --sample     # just run overrides + migrations (no API calls)
#
# Pipeline steps:
#   1. Show card pool stats
#   2. Run Sonnet classification (skips already-classified cards)
#   3. Apply schema migrations (field renames, defaults)
#   4. Apply manual overrides (corrections that Sonnet gets wrong)
#   5. Run validation
#   6. Show results
#
# Prerequisites:
#   - ANTHROPIC_API_KEY set (for classification)
#   - turso CLI logged in (for sync)
#   - Local data/cards.db up to date

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "============================================================"
echo "SEMANTIC CLASSIFICATION PIPELINE"
echo "============================================================"
echo ""

# Step 0: Pre-flight
echo "Step 0: Pre-flight checks"
ICONIC_COUNT=$(sqlite3 "$PROJECT_DIR/data/cards.db" "SELECT COUNT(*) FROM cards WHERE is_iconic = 1")
EXISTING=$(ls "$PROJECT_DIR/data/semantics/"*.json 2>/dev/null | grep -v progress.json | grep -v errors.json | grep -v overrides.json | wc -l | tr -d ' ')
echo "  Iconic cards in DB: $ICONIC_COUNT"
echo "  Existing semantic files: $EXISTING"
echo ""

if [ "$1" = "--sample" ]; then
  echo "Sample mode: skipping classification, running overrides + migrations only"
  echo ""
else
  # Step 1: Classification
  echo "Step 1: Sonnet classification"
  if [ -n "$2" ]; then
    echo "  Running with --limit $2"
    source "$PROJECT_DIR/.env.local" 2>/dev/null || true
    ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY npx tsx "$SCRIPT_DIR/classify-cards.ts" --limit "$2"
  elif [ "$1" = "--limit" ] && [ -n "$2" ]; then
    echo "  Running with --limit $2"
    source "$PROJECT_DIR/.env.local" 2>/dev/null || true
    ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY npx tsx "$SCRIPT_DIR/classify-cards.ts" --limit "$2"
  else
    echo "  Running full sweep (this may take ~1 hour and ~$35)"
    read -p "  Continue? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "  Aborted."
      exit 0
    fi
    source "$PROJECT_DIR/.env.local" 2>/dev/null || true
    ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY npx tsx "$SCRIPT_DIR/classify-cards.ts"
  fi
  echo ""
fi

# Step 2: Schema migrations
echo "Step 2: Schema migrations"
npx tsx "$SCRIPT_DIR/apply-schema-migrations.ts"
echo ""

# Step 3: Manual overrides
echo "Step 3: Manual overrides"
npx tsx "$SCRIPT_DIR/apply-overrides.ts"
echo ""

# Step 4: Summary
echo "============================================================"
echo "PIPELINE COMPLETE"
echo "============================================================"
FINAL_COUNT=$(ls "$PROJECT_DIR/data/semantics/"*.json 2>/dev/null | grep -v progress.json | grep -v errors.json | grep -v overrides.json | wc -l | tr -d ' ')
echo "  Semantic files: $FINAL_COUNT"
echo ""
echo "Next steps:"
echo "  1. Spot-check a few cards: cat data/semantics/\"Card Name\".json | python3 -m json.tool"
echo "  2. Run tests: npx tsx scripts/test-query-engine.ts"
echo "  3. Sync to Turso: npx tsx scripts/sync-iconic-to-turso.ts"
echo "  4. Deploy: git add data/semantics/ && git commit && git push && railway up"
