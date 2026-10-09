#!/bin/bash
# RAG test 2 ("nothing relevant"): ask something no note answers and check the
# tutor says it found nothing in the notes instead of making an answer up.
source "$(dirname "$0")/lib.sh"

echo "RAG TEST 2: with no relevant note, the tutor says so instead of guessing"
login "$E2E_MAIN_EMAIL" "$E2E_MAIN_PASSWORD"
open_chat; new_chat; pick_tutor british
REPLY=$(send "What time is my dentist appointment?"); echo "  tutor: $REPLY"
check "says it couldn't find this in the notes" 'echo "$REPLY" | grep -qiE "$NOT_FOUND_RE"'
check "doesn't claim a note as its source" '! echo "$REPLY" | grep -qiE "based on your note|your note (says|mentions)"'
check "doesn't invent an appointment time" '! echo "$REPLY" | grep -qE "\b[0-9]{1,2}[:.][0-9]{2}\b|\b[0-9]{1,2} ?(am|pm|Uhr)\b"'

new_chat; pw close >/dev/null
result
