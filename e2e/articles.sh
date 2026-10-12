#!/bin/bash
# Browser checks for the der · die · das level picker (guest, no accounts, no AI).
# Run: bash e2e/articles.sh   (BASE defaults to http://localhost:3000)
BASE=${BASE:-http://localhost:3000}
FAILED=0
pw() { playwright-cli "$@" 2>&1; }
js() { pw eval "$1" | sed -n 2p; }
check() { if eval "$2"; then echo "  ✅ $1"; else echo "  ❌ $1"; FAILED=1; fi; }
pressed() { js "() => [...document.querySelectorAll('fieldset button[aria-pressed=true]')].map(b=>b.textContent.trim()).join(',')"; }
badge() { js "() => document.querySelector('[data-card-level]')?.textContent.trim() || ''"; } # not the picker's "Level A" buttons
noun() { js "() => document.querySelector('[data-card-level]')?.parentElement.querySelector('p')?.textContent.trim() || ''"; }

pw close >/dev/null; pw open "$BASE/articles" >/dev/null; pw resize 1280 800 >/dev/null; sleep 3
js "() => { localStorage.clear(); return 1 }" >/dev/null; pw reload >/dev/null; sleep 3
echo "== Picker"
check "shows A · B · C · All" '[ "$(js "() => [...document.querySelectorAll(\"fieldset button\")].map(b=>b.textContent.trim()).join(\",\")")" = "\"A,B,C,All\"" ]'
check "All is selected by default" '[ "$(pressed)" = "\"All\"" ]'
check "the card shows a level badge" '[[ "$(badge)" =~ ^\"[ABC][12]\"$ ]]'

echo "== Band C gives only C1/C2 cards"
js "() => { [...document.querySelectorAll('fieldset button')].find(b=>b.textContent.trim()==='C').click(); return 1 }" >/dev/null; sleep 2
check "C is selected" '[ "$(pressed)" = "\"C\"" ]'
prev=""
for i in 1 2 3 4 5; do
  check "card $i is C1 or C2" '[[ "$(badge)" =~ ^\"C[12]\"$ ]]'
  cur=$(noun)
  check "card $i is a new card ($cur)" '[ -n "$cur" ] && [ "$cur" != "$prev" ]'
  prev=$cur
  pw press Enter >/dev/null; sleep 2 # the first answer button is focused: answer with the keyboard; a correct one moves on after 1.5 s
  [ "$(noun)" = "$cur" ] && pw press Enter >/dev/null && sleep 1 # a wrong one waits: Enter continues
done

echo "== Arrow keys choose, Enter picks"
pw goto "$BASE/articles" >/dev/null; sleep 3
focused() { js "() => document.activeElement?.textContent.trim()"; }
check "first answer focused" '[ "$(focused)" = "\"der\"" ]'
pw press ArrowRight >/dev/null; sleep 0.3
check "→ moves to die" '[ "$(focused)" = "\"die\"" ]'
pw press ArrowLeft >/dev/null; pw press ArrowLeft >/dev/null; sleep 0.3
check "← wraps to das" '[ "$(focused)" = "\"das\"" ]'
before=$(noun); pw press Enter >/dev/null; sleep 0.5
check "Enter picks it (feedback shown)" '[ "$(js "() => /Correct!|Not quite\\./.test(document.body.innerText)")" = "true" ]'
sleep 2; [ "$(noun)" = "$before" ] && pw press Enter >/dev/null && sleep 1
check "the next card appears without a continue button" '[ "$(noun)" != "$before" ] && [ "$(js "() => [...document.querySelectorAll(\"button\")].some(b=>/continue/i.test(b.textContent))")" = "false" ]'

echo "== A wrong answer waits; a click on empty space, or Enter, continues; Restart still restarts"
# Click "der" on fresh cards until one is wrong (a right one moves on by itself after 1.5 s).
wrong_answer() {
  for t in 1 2 3 4 5 6 7 8; do
    js "() => { [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='der').click(); return 1 }" >/dev/null; sleep 0.5
    [ "$(js "() => document.body.innerText.includes('Not quite.')")" = "true" ] && return 0
    sleep 2
  done
  return 1
}
wrong_answer; got=$?
check "got a wrong answer to test with" '[ $got = 0 ]'
before=$(noun); sleep 2.5
check "a wrong answer waits (no auto-advance)" '[ "$(noun)" = "$before" ]'
check "the plain hint shows under it" '[ "$(js "() => document.body.innerText.includes(\"Tap or click anywhere, or press Enter to continue\")")" = "true" ]'
js "() => { document.body.click(); return 1 }" >/dev/null; sleep 0.5
check "a click on empty space continues" '[ "$(noun)" != "$before" ]'
wrong_answer; before=$(noun); sleep 2.5
pw press Enter >/dev/null; sleep 0.5
check "Enter continues after a wrong answer" '[ "$(noun)" != "$before" ]'
wrong_answer; sleep 1
js "() => { [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Restart').click(); return 1 }" >/dev/null; sleep 1
check "Restart restarts (Card 1 of 30)" '[ "$(js "() => /card 1 of 30/i.test(document.body.innerText)")" = "true" ]'

echo "== Old saved choice is converted"
js "() => { localStorage.clear(); localStorage.setItem('de-app:max-level','B1'); return 1 }" >/dev/null; pw reload >/dev/null; sleep 3
check "old B1 → B" '[ "$(pressed)" = "\"B\"" ]'

echo "== Rules page lists the new rules"
pw goto "$BASE/rules" >/dev/null; sleep 3
for t in "People ending in -ist" "Nouns of more than one syllable ending in -ast" "Nouns ending in -ich and -ig" "Nouns ending in -age" "Nouns ending in -ade" "Nouns ending in -ette"; do
  check "/rules has \"$t\"" '[ "$(js "() => document.body.innerText.includes(\"$t\")")" = "true" ]'
done

echo "== Phone width"
pw goto "$BASE/articles" >/dev/null; pw resize 390 844 >/dev/null; sleep 3
check "no horizontal scroll at 390px" '[ "$(js "() => document.documentElement.scrollWidth <= window.innerWidth")" = "true" ]'

pw close >/dev/null
echo; [ "$FAILED" = 0 ] && echo "RESULT: PASS" || echo "RESULT: FAIL"; exit "$FAILED"
