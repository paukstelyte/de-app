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

pw close >/dev/null; pw open "$BASE/articles" >/dev/null; pw resize 1280 800 >/dev/null; sleep 3
js "() => { localStorage.clear(); return 1 }" >/dev/null; pw reload >/dev/null; sleep 3
echo "== Picker"
check "shows A · B · C · All" '[ "$(js "() => [...document.querySelectorAll(\"fieldset button\")].map(b=>b.textContent.trim()).join(\",\")")" = "\"A,B,C,All\"" ]'
check "All is selected by default" '[ "$(pressed)" = "\"All\"" ]'
check "the card shows a level badge" '[[ "$(badge)" =~ ^\"[ABC][12]\"$ ]]'

echo "== Band C gives only C1/C2 cards"
js "() => { [...document.querySelectorAll('fieldset button')].find(b=>b.textContent.trim()==='C').click(); return 1 }" >/dev/null; sleep 2
for i in 1 2 3 4 5; do
  check "card $i is C1 or C2" '[[ "$(badge)" =~ ^\"C[12]\"$ ]]'
  pw press Enter >/dev/null; sleep 1 # the first answer button is focused: answer with the keyboard
  pw press Enter >/dev/null; sleep 1 # the focused "continue" button advances
done

echo "== Old saved choice is converted"
js "() => { localStorage.clear(); localStorage.setItem('de-app:max-level','B1'); return 1 }" >/dev/null; pw reload >/dev/null; sleep 3
check "old B1 → B" '[ "$(pressed)" = "\"B\"" ]'

echo "== Rules page lists the new rules"
pw goto "$BASE/rules" >/dev/null; sleep 3
for s in -ist -age -ade -ette; do
  check "/rules mentions $s" '[ "$(js "() => document.body.innerText.includes(\"$s\")")" = "true" ]'
done

echo "== Phone width"
pw goto "$BASE/articles" >/dev/null; pw resize 390 844 >/dev/null; sleep 3
check "no horizontal scroll at 390px" '[ "$(js "() => document.documentElement.scrollWidth <= window.innerWidth")" = "true" ]'

pw close >/dev/null
echo; [ "$FAILED" = 0 ] && echo "RESULT: PASS" || echo "RESULT: FAIL"; exit "$FAILED"
