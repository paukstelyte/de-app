#!/bin/bash
# RAG test 3 (cross-user): user A (E2E_OTHER) saves a note and signs out; user B
# (E2E_MAIN) signs in and asks about it. B's answer must not contain A's note.
source "$(dirname "$0")/lib.sh"
TITLE="Bike lock $(date +%s)"
SECRET="5823"

echo "RAG TEST 3: another user's note never reaches your answers"
echo "  user A ($E2E_OTHER_EMAIL) saves a note, then signs out"
login "$E2E_OTHER_EMAIL" "$E2E_OTHER_PASSWORD"
MSG=$(add_note "$TITLE" "The code for my bike lock is $SECRET. The bike is the blue one by the station.")
echo "  saved note \"$TITLE\": $MSG"
check "user A's note was saved" '[ "$MSG" = "Note saved." ]'
logout
check "user A is signed out (Chat asks for login)" '[ "$(js "() => location.pathname")" = "\"/\"" ] && pw goto "$BASE/chat" >/dev/null && sleep 3 && [ "$(js "() => location.pathname")" = "\"/login\"" ]'

echo "  user B ($E2E_MAIN_EMAIL) signs in and asks about A's note"
login "$E2E_MAIN_EMAIL" "$E2E_MAIN_PASSWORD"
open_chat; new_chat; pick_tutor british
REPLY=$(send "What is the code for my bike lock?"); echo "  tutor: $REPLY"
check "B's answer does not contain A's code ($SECRET)" '! echo "$REPLY" | grep -q "$SECRET"'
check "B's answer does not mention A's note or its details" '! echo "$REPLY" | grep -qiE "Bike lock [0-9]|blue one|by the station"'
check "B is told nothing was found in B's notes" 'echo "$REPLY" | grep -qiE "$NOT_FOUND_RE"'

new_chat
echo "  cleanup: user A deletes the note"; login "$E2E_OTHER_EMAIL" "$E2E_OTHER_PASSWORD"; delete_note "$TITLE"; pw close >/dev/null
result
