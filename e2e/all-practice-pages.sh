#!/bin/bash
# Opens every practice page as a guest and checks it renders its first question
# with no console errors. No accounts, no AI, nothing saved.
# Run: bash e2e/all-practice-pages.sh   (BASE defaults to the local dev server)

BASE=${BASE:-http://localhost:3000}
FAILED=0
pw() { playwright-cli "$@" 2>&1; }

SLUGS=$(ls lib/exercises/data/*.json | xargs -n1 basename | sed 's/\.json$//')
echo "Checking $(echo "$SLUGS" | wc -l | tr -d ' ') practice pages on $BASE"

pw close >/dev/null; pw open "$BASE/" >/dev/null; sleep 2
for slug in $SLUGS; do
  pw goto "$BASE/topics/$slug/practice" >/dev/null
  # Wait for the client to render the first question (rounds are built after hydration).
  ok=""
  for i in $(seq 1 10); do
    r=$(pw eval "() => /question 1 of 10/i.test(document.body.innerText) && document.querySelectorAll('main button, main input').length > 0" | sed -n 2p)
    [ "$r" = "true" ] && { ok=1; break; }
    sleep 0.5
  done
  errors=$(pw console error | grep -o 'Errors: [0-9]*' | grep -o '[0-9]*')
  if [ -n "$ok" ] && [ "${errors:-0}" = 0 ]; then
    echo "  ✅ $slug"
  else
    echo "  ❌ $slug (question rendered: ${ok:-no}, console errors: ${errors:-?})"; FAILED=1
  fi
done
pw close >/dev/null

echo; [ "$FAILED" = 0 ] && echo "RESULT: PASS" || echo "RESULT: FAIL"; exit "$FAILED"
