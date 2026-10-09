#!/bin/bash
# RAG test 1 (happy path): save a note with a specific fact, ask the chat about
# it, and check the answer has the right information and mentions the note.
source "$(dirname "$0")/lib.sh"
TITLE="Train to Hamburg $(date +%s)"
FACT="My train to Hamburg leaves on Friday 21 November at 08:15 from platform 7."

echo "RAG TEST 1: the chat answers from a saved note and mentions it"
login "$E2E_MAIN_EMAIL" "$E2E_MAIN_PASSWORD"
MSG=$(add_note "$TITLE" "$FACT"); echo "  saved note \"$TITLE\": $MSG"
check "the note was saved" '[ "$MSG" = "Note saved." ]'

open_chat; new_chat; pick_tutor british
REPLY=$(send "What time does my train to Hamburg leave?"); echo "  tutor: $REPLY"
check "the answer has the correct time (08:15)" 'echo "$REPLY" | grep -qE "\b0?8[:.]15\b"'
check "the answer mentions the note" 'echo "$REPLY" | grep -qiE "your note|based on.{0,10}note|note.{0,20}Train to Hamburg"'
check "the answer is not the \"not found\" reply" '! echo "$REPLY" | grep -qiE "$NOT_FOUND_RE"'

new_chat; delete_note "$TITLE"; pw close >/dev/null
result
