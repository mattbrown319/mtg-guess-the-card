#!/bin/bash
# Usage: ./scripts/review-game.sh "Card Name"
# Or: ./scripts/review-game.sh "Card Name" "player_id_prefix"

CARD="$1"
PLAYER_FILTER=""
if [ -n "$2" ]; then
  PLAYER_FILTER="AND player_id LIKE '$2%'"
fi

echo "=== Finding session ==="
SESSION=$(turso db shell mtg-guess-the-card "
  SELECT session_id, json_extract(card_json, '$.name') as card, question_count, status, correct, player_initials, elapsed_seconds
  FROM sessions
  WHERE json_extract(card_json, '$.name') LIKE '%$CARD%' $PLAYER_FILTER
  ORDER BY started_at DESC LIMIT 1
" 2>&1)
echo "$SESSION"

SESSION_ID=$(echo "$SESSION" | tail -1 | awk '{print $1}')

echo ""
echo "=== Oracle text ==="
sqlite3 data/cards.db "SELECT oracle_text FROM cards WHERE name LIKE '%$CARD%' LIMIT 1"

echo ""
echo "=== Query log ==="
turso db shell mtg-guess-the-card "
  SELECT question, query_kind, outcome, reason_code
  FROM query_logs
  WHERE session_id = '$SESSION_ID'
  ORDER BY created_at
" 2>&1

echo ""
echo "=== Sonnet fallbacks ==="
turso db shell mtg-guess-the-card "
  SELECT question, parsed_outcome, latency_ms
  FROM sonnet_fallback_logs
  WHERE session_id = '$SESSION_ID'
  ORDER BY created_at
" 2>&1
