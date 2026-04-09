#!/bin/bash
# Usage:
#   ./scripts/review-game.sh                          # most recent game (any player)
#   ./scripts/review-game.sh --player MCB             # most recent game by player initials
#   ./scripts/review-game.sh --card "Seeker of the Way"  # most recent game with this card
#   ./scripts/review-game.sh --recent 5               # list 5 most recent games

MODE="latest"
VALUE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --player) MODE="player"; VALUE="$2"; shift 2 ;;
    --card) MODE="card"; VALUE="$2"; shift 2 ;;
    --recent) MODE="recent"; VALUE="${2:-5}"; shift 2 ;;
    *) MODE="card"; VALUE="$1"; shift ;;
  esac
done

if [ "$MODE" = "recent" ]; then
  echo "=== Recent games ==="
  turso db shell mtg-guess-the-card "
    SELECT json_extract(card_json, '$.name') as card, question_count as qs,
      CASE WHEN correct = 1 THEN '✅' ELSE '❌' END as result,
      player_initials as player, status,
      datetime(started_at/1000, 'unixepoch', 'localtime') as started
    FROM sessions
    WHERE status = 'guessed'
    ORDER BY started_at DESC LIMIT $VALUE
  " 2>&1
  exit 0
fi

# Build the session query based on mode
if [ "$MODE" = "player" ]; then
  SESSION_QUERY="SELECT session_id, json_extract(card_json, '$.name') as card, question_count, status, correct, player_initials, elapsed_seconds FROM sessions WHERE player_initials = '$VALUE' AND status = 'guessed' ORDER BY started_at DESC LIMIT 1"
elif [ "$MODE" = "card" ]; then
  SESSION_QUERY="SELECT session_id, json_extract(card_json, '$.name') as card, question_count, status, correct, player_initials, elapsed_seconds FROM sessions WHERE json_extract(card_json, '$.name') LIKE '%$VALUE%' AND status = 'guessed' ORDER BY started_at DESC LIMIT 1"
else
  SESSION_QUERY="SELECT session_id, json_extract(card_json, '$.name') as card, question_count, status, correct, player_initials, elapsed_seconds FROM sessions WHERE status = 'guessed' ORDER BY started_at DESC LIMIT 1"
fi

echo "=== Session ==="
SESSION=$(turso db shell mtg-guess-the-card "$SESSION_QUERY" 2>&1)
echo "$SESSION"

SESSION_ID=$(echo "$SESSION" | tail -1 | awk '{print $1}')
CARD_NAME=$(echo "$SESSION" | tail -1 | awk -F'|' '{print $2}' | sed 's/^ *//;s/ *$//')

if [ -z "$SESSION_ID" ] || [ "$SESSION_ID" = "SESSION ID" ]; then
  echo "No matching game found."
  exit 1
fi

echo ""
echo "=== Oracle text ==="
sqlite3 data/cards.db "SELECT oracle_text FROM cards WHERE name = '$CARD_NAME'"

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
