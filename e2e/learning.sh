#!/bin/bash
# Browser checks for Customized Learning (/learning, /topics). See e2e/README.md.
# The MAIN account must be a disposable test account: this script adds documents and focus rows
# to it, and the page cannot delete focus rows (it only marks them 'removed').
# Real uploads call the AI (about $0.0005 each) and use 4 of the main account's 10 uploads/day.
cd "$(dirname "$0")/.." || exit 2
source e2e/lib.sh
FX="$PWD/e2e/fixtures"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
for i in 1 2 3 4 5 6; do cp "$FX/blank.png" "$TMP/photo$i.png"; done

BUCKET_SQL="select count(*) as objects from storage.objects where bucket_id = 'learning-uploads'"
USAGE_SQL="select count(*) as uploads_24h from public.learning_upload_usage where created_at > now() - interval '24 hours' and user_id = (select id from auth.users where email = '$E2E_MAIN_EMAIL')"
FOCUS_SQL="select kind, topic_slug from public.learning_focus where user_id = (select id from auth.users where email = '$E2E_MAIN_EMAIL') order by topic_slug"

# Quota pre-check: the run needs 4 of the main account's 10 uploads per day.
USAGE0=$(sql_value "$USAGE_SQL")
case "$USAGE0" in ''|*[!0-9]*) echo "Could not read upload usage (SQL failed); is supabase linked? Aborting."; exit 2;; esac
[ "$USAGE0" -le 6 ] || { echo "Main account already used $USAGE0 of 10 uploads in 24h; this run needs 4. Aborting."; exit 2; }
TOPIC_RE='prepositions-dative|dative-case'

# Open /learning, pick files like a user (click the drop zone, answer the file chooser).
choose() { pw goto "$BASE/learning" >/dev/null; sleep 3; pw click "text=Choose a PDF" >/dev/null; pw upload "$@" >/dev/null; }
# Waits up to 90s for the upload box to say "Done!" or show an error; prints that message.
wait_upload() {
  for i in $(seq 1 90); do sleep 1
    m=$(js "() => document.querySelector('#upload-title')?.parentElement.querySelector('[role=status],[role=alert]')?.textContent || ''" | unjson)
    case "$m" in Done*|*"didn't"*|*wrong*|Please*|Each*|"Upload one"*|"Upload at most"*|Choose*) echo "$m"; return;; esac
  done; echo "(no result after 90s)"
}
# Newest document: its title, then its topic links; and the "Your focus now" links.
newest_title() { js "() => document.querySelector('section[aria-labelledby=docs-title] > ul > li h3')?.textContent || ''" | unjson; }
newest_topics() { js "() => [...document.querySelectorAll('section[aria-labelledby=docs-title] > ul > li:first-child a')].map(a=>a.getAttribute('href')).filter(h=>h.startsWith('/topics/')).join(' ')" | unjson; }
focus_topics() { js "() => [...document.querySelectorAll('section[aria-labelledby=focus-title] a')].map(a=>a.getAttribute('href')).filter(h=>h.startsWith('/topics/')).join(' ')" | unjson; }
doc_count() { js "() => document.querySelectorAll('section[aria-labelledby=docs-title] > ul > li').length"; }
delete_newest_doc() { # clicks Delete then Yes, delete it on the first document
  js "() => { const li=document.querySelector('section[aria-labelledby=docs-title] > ul > li'); [...li.querySelectorAll('button')].find(b=>b.textContent.trim()==='Delete').click(); return 1; }" >/dev/null; sleep 1
  js "() => { const li=document.querySelector('section[aria-labelledby=docs-title] > ul > li'); [...li.querySelectorAll('button')].find(b=>b.textContent.trim()==='Yes, delete it').click(); return 1; }" >/dev/null; sleep 3
}

# Upload a real fixture, wait, then check the new document (check 2/3/4) and the storage folder (check 5).
upload_and_check() { # label file
  echo "-- upload $1"
  choose "$FX/$2"; msg=$(wait_upload); echo "     page says: $msg"; sleep 2
  pw goto "$BASE/learning" >/dev/null; sleep 3
  TITLE=$(newest_title); TOPICS=$(newest_topics); FOCUS=$(focus_topics)
  echo "     newest document: '$TITLE' topics: $TOPICS"; echo "     focus: $FOCUS"
  case "$2" in
    blank.png)
      check "$1: 'No German grammar topics found', no topics, focus unchanged" '[ -z "$TOPICS" ] && text | grep -q "No German grammar topics found"' ;;
    *)
      check "$1: document appears (title mentions lesson 7 or dative prepositions (the AI title varies, any language))" 'echo "$TITLE" | grep -qiE "Lektion 7|Lesson 7|Pr.positionen|Dative Prepositions"'
      check "$1: topics include prepositions-dative or dative-case" 'echo "$TOPICS" | grep -qE "$TOPIC_RE"'
      check "$1: 'Your focus now' lists it" 'echo "$FOCUS" | grep -qE "$TOPIC_RE"' ;;
  esac
  OBJ=$(sql_value "$BUCKET_SQL"); sql "$BUCKET_SQL"
  check "$1: storage bucket is empty after the upload" '[ "$OBJ" = 0 ]'
}

echo "== 1. Guest, login redirect"
pw close >/dev/null; pw open "$BASE/learning" >/dev/null; pw resize 1280 800 >/dev/null; sleep 3
check "guest /learning shows 'Log in to use Customized Learning'" 'text | grep -q "Log in to use Customized Learning"'
login "$E2E_MAIN_EMAIL" "$E2E_MAIN_PASSWORD"
check "logging in from /login lands on /learning (at $(js '() => location.pathname'))" '[ "$(js "() => location.pathname")" = "\"/learning\"" ]'
pw goto "$BASE/" >/dev/null; sleep 3
check "/ redirects to /learning when logged in (at $(js '() => location.pathname'))" '[ "$(js "() => location.pathname")" = "\"/learning\"" ]'

echo "== Start state"
pw goto "$BASE/learning" >/dev/null; sleep 3
START_DOCS=$(doc_count); START_FOCUS=$(focus_topics); echo "     documents at start: $START_DOCS; focus at start: '$START_FOCUS'"
sql "$USAGE_SQL"
sql "$FOCUS_SQL"; echo "     (focus rows above = START)"

echo "== 9. Rejected before upload (no storage, no quota)"
choose "$FX/old.doc"; msg=$(wait_upload); echo "     page says: $msg"
check ".doc shows 'Please upload a PDF, Word (.docx), JPG, PNG, WebP or HEIC file.'" '[ "$msg" = "Please upload a PDF, Word (.docx), JPG, PNG, WebP or HEIC file." ]'
choose "$TMP"/photo1.png "$TMP"/photo2.png "$TMP"/photo3.png "$TMP"/photo4.png "$TMP"/photo5.png "$TMP"/photo6.png; msg=$(wait_upload); echo "     page says: $msg"
check "6 photos show 'Upload at most 5 photos at a time.'" '[ "$msg" = "Upload at most 5 photos at a time." ]'
sql "$USAGE_SQL"; check "neither rejection used any quota" '[ "$(sql_value "$USAGE_SQL")" = "$USAGE0" ]'
sql "$BUCKET_SQL"; check "neither rejection touched storage" '[ "$(sql_value "$BUCKET_SQL")" = 0 ]'

echo "== 2/3/4/5. Real uploads"
upload_and_check "PDF" lektion7.pdf
upload_and_check "HEIC photo" lektion7.heic
upload_and_check "Word file" lektion7.docx
upload_and_check "blank image" blank.png
sql "$USAGE_SQL"

echo "== 6. Focus buttons"
pw goto "$BASE/learning" >/dev/null; sleep 3
SLUG=$(focus_topics | tr ' ' '\n' | grep -E "$TOPIC_RE" | head -1)
TTITLE=$(js "() => [...document.querySelectorAll('section[aria-labelledby=focus-title] a')].find(a=>a.getAttribute('href')==='$SLUG')?.textContent || ''" | unjson)
js "() => { const li=[...document.querySelectorAll('section[aria-labelledby=focus-title] > ul > li')].find(l=>l.textContent.includes('$TTITLE')); [...li.querySelectorAll('button')].find(b=>b.textContent.trim()==='Remove from focus').click(); return 1; }" >/dev/null; sleep 3; pw goto "$BASE/learning" >/dev/null; sleep 3
check "'Remove from focus' hides $SLUG from 'Your focus now'" '! focus_topics | grep -q "$SLUG"'
pw goto "$BASE/topics/modal-verbs" >/dev/null; sleep 3
click "Add to my focus"; sleep 3; pw goto "$BASE/learning" >/dev/null; sleep 3
check "'Add to my focus' on /topics/modal-verbs adds it to 'Your focus now'" 'focus_topics | grep -q "/topics/modal-verbs"'

echo "== 8. Other user sees none of it"
login "$E2E_OTHER_EMAIL" "$E2E_OTHER_PASSWORD"; pw goto "$BASE/learning" >/dev/null; sleep 3
check "user B is logged in (not on /login)" '[ "$(js "() => location.pathname")" != "\"/login\"" ]'
check "user B sees none of user A's documents" '! text | grep -qE "Lektion 7|Pr.positionen mit Dativ|What I read"'
check "user B's focus has no prepositions-dative / dative-case / modal-verbs" '! focus_topics | grep -qE "prepositions-dative|dative-case|modal-verbs"'
echo "     user B focus: '$(focus_topics)'"

echo "== 7. Delete documents, clean up"
login "$E2E_MAIN_EMAIL" "$E2E_MAIN_PASSWORD"; pw goto "$BASE/learning" >/dev/null; sleep 3
n=$(doc_count)
delete_newest_doc; pw goto "$BASE/learning" >/dev/null; sleep 3
check "deleted document is gone after reload" '[ "$(doc_count)" = "$((n - 1))" ]'
for i in $(seq 1 10); do [ "$(doc_count)" -gt "$START_DOCS" ] 2>/dev/null || break; delete_newest_doc; pw goto "$BASE/learning" >/dev/null; sleep 3; done
check "all created documents deleted (back to $START_DOCS)" '[ "$(doc_count)" = "$START_DOCS" ]'
# Focus: take modal-verbs out again (a 'removed' row stays in learning_focus; the page can't delete it).
pw goto "$BASE/topics/modal-verbs" >/dev/null; sleep 3; click "Remove from my focus"; sleep 3
echo "     focus rows at END (compare with START above, no assertion):"; sql "$FOCUS_SQL"
sql "$BUCKET_SQL"
pw close >/dev/null
result
