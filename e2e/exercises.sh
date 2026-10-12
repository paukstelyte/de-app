#!/bin/bash
# Browser checks for the grammar practice pages (/topics/<slug>/practice). See e2e/README.md.
# No AI is involved, so the run costs nothing. As the MAIN account it saves 2 answers to
# public.attempts (real answers by the test account; they are left in place).
cd "$(dirname "$0")/.." || exit 2
source e2e/lib.sh
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

# Reads the current question as JSON from the page, picks the answer from the item data in
# lib/exercises/data/<slug>.json (right, or deliberately wrong) and prints the action to take.
cat > "$TMP/solve.py" <<'PY'
import json, re, sys
slug, mode = sys.argv[1], sys.argv[2]
items = json.load(open(f"lib/exercises/data/{slug}.json"))["items"]
q = json.loads(sys.stdin.read())
flat = lambda s: re.sub(r"\s+", "", s)
def out(**k): print(json.dumps(k)); sys.exit(0)
for it in items:
    if q["kind"] == "type" and it["type"] == "type" and q["key"] == it["prompt"].replace("___", "blank") + (" " + it["hint"] if it.get("hint") else ""):
        out(kind="type", text="xxx" if mode == "wrong" else it["answers"][0])
    if q["kind"] == "choice" and it["type"] == "choice" and flat(q["key"]) == flat(it["prompt"].replace("___", "")):
        pick = [o for o in q["options"] if (o != it["answer"]) == (mode == "wrong")][0]
        out(kind="choice", click=pick)
    if q["kind"] == "order" and it["type"] == "order" and sorted(q["words"]) == sorted(it["words"]):
        w = it["words"][::-1] if mode == "wrong" else it["words"]
        if mode == "wrong" and w == it["words"]: w = w[1:] + w[:1]
        out(kind="order", words=w)
out(err="no matching item", q=q)
PY

PROBE="() => { const inp=document.querySelector('input[aria-label]'); if (inp) return JSON.stringify({kind:'type',key:inp.getAttribute('aria-label')}); const w=document.querySelector('[aria-label=Words]'); if (w) return JSON.stringify({kind:'order',words:[...w.querySelectorAll('button')].map(b=>b.textContent.trim())}); const p=document.querySelector('p[lang=de]'); return JSON.stringify({kind:'choice',key:(p?p.textContent:'').replace(/ /g,' '),options:[...document.querySelectorAll('button[lang=de]')].map(b=>b.textContent.trim())}); }"
qprobe() { js "$PROBE" | unjson; }
# Position line, e.g. "Question 3 of 10 · 2 correct"
position() { text | grep -oiE "(Mistakes · )?Question [0-9]+ of [0-9]+ · [0-9]+ correct" | head -1; }

# Answer the current question (mode right|wrong) without pressing Continue; echoes the item type.
answer_now() { # slug mode
  local a kind; a=$(qprobe | python3 "$TMP/solve.py" "$1" "$2"); kind=$(echo "$a" | python3 -c 'import json,sys;print(json.loads(sys.stdin.read()).get("kind","ERR"))')
  case "$kind" in
    choice) click "$(echo "$a" | python3 -c 'import json,sys;print(json.loads(sys.stdin.read())["click"])')" ;;
    type)
      js "() => { const t=document.querySelector('input[aria-label]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(t,$(json "$(echo "$a" | python3 -c 'import json,sys;print(json.loads(sys.stdin.read())["text"])')")); t.dispatchEvent(new Event('input',{bubbles:true})); return 1; }" >/dev/null
      sleep 0.3; click "Check" ;;
    order)
      js "() => { const used=new Set(); for (const w of $(echo "$a" | python3 -c 'import json,sys;print(json.dumps(json.loads(sys.stdin.read())["words"]))')) { const b=[...document.querySelector('[aria-label=Words]').querySelectorAll('button')].find(b=>!b.disabled && !used.has(b) && b.textContent.trim()===w); used.add(b); b.click(); } return 1; }" >/dev/null
      sleep 0.5; click "Check" ;;
    *) echo "  solver error: $a" >&2 ;;
  esac
  echo "$kind" >> "$TMP/types"; sleep 0.5
}
# After a WRONG answer the page waits for a click on empty space; after a RIGHT one the next question
# appears by itself after 1.5 s (so wait 2 s, never click: that would skip the next question).
cont() { js "() => { document.body.click(); return 1 }" >/dev/null; sleep 0.5; }
# Play n questions of the current round; the first $3 are answered wrong, the rest right.
play() { # slug n nwrong
  for i in $(seq 1 "$2"); do
    if [ "$i" -le "$3" ]; then answer_now "$1" wrong; cont; else answer_now "$1" right; sleep 2; fi
  done
}
# Is there a link whose href is exactly $1 / whose href contains $1?
has_link() { [ "$(js "() => [...document.querySelectorAll('a')].some(a=>a.getAttribute('href')===$(json "$1"))")" = true ]; }
has_link_like() { [ "$(js "() => [...document.querySelectorAll('a')].some(a=>(a.getAttribute('href')||'').includes($(json "$1")))")" = true ]; }
no_hscroll() { [ "$(js "() => document.documentElement.scrollWidth <= window.innerWidth")" = true ]; }
has_text() { text | grep -qiF -- "$1"; } # case-insensitive: the position line is shown uppercase

CNT_SQL="select count(*) from public.attempts where user_id = (select id from auth.users where email = '$E2E_MAIN_EMAIL')"
ROWS_SQL="select topic, item_id, correct from public.attempts where user_id = (select id from auth.users where email = '$E2E_MAIN_EMAIL') and topic = 'modal-verbs' order by created_at desc limit 2"
LAST2_SQL="select count(*) from (select correct from public.attempts where user_id = (select id from auth.users where email = '$E2E_MAIN_EMAIL') and topic = 'modal-verbs' order by created_at desc limit 2) s where correct"
START=$(sql_value "$CNT_SQL"); sql "$CNT_SQL"
[ "$START" != SQL_ERROR ] || { echo "Could not read attempts (is supabase linked?). Aborting."; exit 2; }

echo "== 1. Guest: pages and links"
pw close >/dev/null; pw open "$BASE/topics/dative-case/practice" >/dev/null; pw resize 1280 800 >/dev/null; sleep 3
check "/topics/dative-case/practice loads with 'Question 1 of 10'" 'has_text "Question 1 of 10"'
pw goto "$BASE/topics/dative-case" >/dev/null; sleep 3
check "/topics/dative-case has a Practice 'Start' link to /topics/dative-case/practice" 'has_link /topics/dative-case/practice && has_text Start'
pw goto "$BASE/topics/noun-gender" >/dev/null; sleep 3
check "/topics/noun-gender has no /practice link" '! has_link_like /practice'
check "/topics/noun-gender keeps its /articles link" 'has_link_like /articles'
pw goto "$BASE/topics/not-a-topic/practice" >/dev/null; sleep 3
check "/topics/not-a-topic/practice shows a 404 page" 'text | grep -qiE "404|could not be found|not found"'
pw goto "$BASE/topics/noun-gender/practice" >/dev/null; sleep 3
check "/topics/noun-gender/practice shows a 404 page" 'text | grep -qiE "404|could not be found|not found"'

echo "== 2/3. Guest round on separable-verbs (first 3 wrong, 7 right)"
: > "$TMP/types"
pw goto "$BASE/topics/separable-verbs/practice" >/dev/null; sleep 3
check "round starts at 'Question 1 of 10'" 'has_text "Question 1 of 10"'
answer_now separable-verbs wrong; sleep 0.5
check "a wrong answer shows 'Not quite.' and an 'Answer:' line" 'has_text "Not quite." && has_text "Answer:"'
check "[390px] no horizontal scroll on the answered page" '{ pw resize 390 844 >/dev/null; sleep 1; no_hscroll; r=$?; pw resize 1280 800 >/dev/null; sleep 1; return $r; }'
cont; play separable-verbs 2 2; play separable-verbs 7 0
check "round end shows 'Round complete!' and 'You got 7 of 10'" 'has_text "Round complete!" && has_text "You got 7 of 10"'
check "'Practise my mistakes (3)' button is offered" 'has_text "Practise my mistakes (3)"'
check "'Log in to save your progress' link is shown to the guest" 'has_text "Log in to save your progress"'
click "Practise my mistakes (3)"; sleep 1
check "mistakes round has exactly 3 items ('Question 1 of 3')" 'position | grep -qi "Mistakes · Question 1 of 3"'
play separable-verbs 3 0
check "mistakes round ends 'Mistakes round complete!' with 'You got 3 of 3'" 'has_text "Mistakes round complete!" && has_text "You got 3 of 3"'
check "no mistakes button after a perfect mistakes round" '! has_text "Practise my mistakes"'
click "Next 10 →"; sleep 1
check "'Next 10' starts a new round ('Question 1 of 10 · 0 correct')" 'has_text "Question 1 of 10 · 0 correct"'
echo "     item types answered on separable-verbs: $(sort "$TMP/types" | uniq -c | tr '\n' ' ')"
for t in choice type order; do
  if ! grep -q "^$t$" "$TMP/types"; then
    echo "     no '$t' item yet; playing a round on simple-past"
    pw goto "$BASE/topics/simple-past/practice" >/dev/null; sleep 3; play simple-past 10 0
  fi
done
echo "     item types answered overall: $(sort "$TMP/types" | uniq -c | tr '\n' ' ')"
check "all three item types (choice, type, order) were answered" 'for t in choice type order; do grep -q "^$t$" "$TMP/types" || return 1; done'
sql "$CNT_SQL"
check "guest answers wrote no attempts rows (count still $START)" '[ "$(sql_value "$CNT_SQL")" = "$START" ]'

echo "== 5. Phone width 390px"
pw resize 390 844 >/dev/null
for s in dative-case separable-verbs; do
  pw goto "$BASE/topics/$s/practice" >/dev/null; sleep 3
  check "/topics/$s/practice has no horizontal scroll at 390px" 'no_hscroll'
done
pw resize 1280 800 >/dev/null

# Walk the round on $1 (answering right) until the current question is of kind $2; reshuffle up to 5 times.
goto_kind() { # slug kind
  local t i q
  for t in 1 2 3 4 5; do
    pw goto "$BASE/topics/$1/practice" >/dev/null; sleep 3
    for i in $(seq 1 10); do
      q=$(qprobe); echo "$q" | grep -q "\"kind\": *\"$2\"" && return 0
      answer_now "$1" right; sleep 2
    done
  done
  return 1
}
qnum() { position | grep -oiE "Question [0-9]+" | grep -oE "[0-9]+"; }
no_continue_button() { [ "$(js "() => ![...document.querySelectorAll('button')].some(b=>/continue/i.test(b.textContent))")" = true ]; }

echo "== 6. Keyboard: type item, Enter submits; right moves on by itself; wrong waits for Enter"
goto_kind simple-past type; found=$?
check "reached a type item" '[ "$found" = 0 ]'
if [ "$found" = 0 ]; then
  q=$(qprobe); n0=$(qnum)
  ans=$(echo "$q" | python3 "$TMP/solve.py" simple-past right | python3 -c 'import json,sys;print(json.loads(sys.stdin.read())["text"])')
  echo "     typing '$ans'"
  pw type "$ans" >/dev/null; pw press Enter >/dev/null
  snap=$(text) # one read right after Enter (the browser is slow, so don't sleep first: the page moves on after 1.5 s)
  check "Enter submits the typed answer ('Correct!' feedback)" 'echo "$snap" | grep -qF "Correct!"'
  check "no Continue button after answering" 'no_continue_button'
  check "the submitting Enter did not skip ahead (still question $n0)" 'echo "$snap" | grep -qiE "Question $n0 of"'
  sleep 2
  n1=$(qnum)
  check "right answer moved on by itself, by exactly one (question $n0 -> ${n1:-round end})" '[ "$n1" = "$((n0 + 1))" ] || has_text "Round complete!"'
fi
goto_kind simple-past type; found=$?
check "reached another type item" '[ "$found" = 0 ]'
if [ "$found" = 0 ]; then
  n0=$(qnum)
  pw type "xxx" >/dev/null; pw press Enter >/dev/null; sleep 1
  check "wrong typed answer shows 'Not quite.'" 'has_text "Not quite."'
  check "wrong answer shows the hint 'Tap or click anywhere, or press Enter to continue'" 'has_text "Tap or click anywhere, or press Enter to continue"'
  check "no Continue button after a wrong answer" 'no_continue_button'
  sleep 2.5
  check "wrong answer waits (still question $n0 after 3.5 s)" '[ "$(qnum)" = "$n0" ] && has_text "Not quite."'
  pw press Enter >/dev/null; sleep 1
  n1=$(qnum)
  check "Enter continues after a wrong answer (question $n0 -> ${n1:-round end})" '[ "$n1" = "$((n0 + 1))" ] || has_text "Round complete!"'
fi

echo "== 7. Arrow keys on a choice item and an order item; click continues a wrong answer"
goto_kind simple-past choice; found=$?
check "reached a choice item" '[ "$found" = 0 ]'
if [ "$found" = 0 ]; then
  OPT="() => { const b=[...document.querySelectorAll('button[lang=de]')]; return JSON.stringify(b.indexOf(document.activeElement)); }"
  check "first option is focused on a choice item" '[ "$(js "$OPT")" = "\"0\"" ]'
  pw press ArrowRight >/dev/null; sleep 0.3
  check "→ moves focus to the second option" '[ "$(js "$OPT")" = "\"1\"" ]'
  pw press ArrowLeft >/dev/null; pw press ArrowLeft >/dev/null; sleep 0.3
  check "← twice wraps to the last option" '[ "$(js "() => { const b=[...document.querySelectorAll(\"button[lang=de]\")]; return b.indexOf(document.activeElement) === b.length - 1 }")" = true ]'
  pw press ArrowRight >/dev/null; pw press ArrowRight >/dev/null; sleep 0.3
  n0=$(qnum)
  pw press Enter >/dev/null; sleep 0.8
  check "Enter picks the focused option (feedback shown)" 'has_text "Correct!" || has_text "Not quite."'
  check "no Continue button after answering a choice item" 'no_continue_button'
  if has_text "Not quite."; then
    sleep 2.5
    check "a wrong choice waits (still question $n0)" '[ "$(qnum)" = "$n0" ]'
    cont; n1=$(qnum)
    check "a click on empty space continues (question $n0 -> ${n1:-round end})" '[ "$n1" = "$((n0 + 1))" ] || has_text "Round complete!"'
  else
    sleep 2; n1=$(qnum)
    check "a right choice moves on by itself (question $n0 -> ${n1:-round end})" '[ "$n1" = "$((n0 + 1))" ] || has_text "Round complete!"'
  fi
fi
goto_kind simple-past choice; found=$?
if [ "$found" = 0 ]; then
  n0=$(qnum); answer_now simple-past wrong; sleep 2.5
  check "wrong choice by click waits for 2.5 s (question $n0)" '[ "$(qnum)" = "$n0" ] && has_text "Not quite."'
  pw press Enter >/dev/null; sleep 1; n1=$(qnum)
  check "Enter continues a wrong choice (question $n0 -> ${n1:-round end})" '[ "$n1" = "$((n0 + 1))" ] || has_text "Round complete!"'
fi
goto_kind separable-verbs order; found=$?
check "reached an order item" '[ "$found" = 0 ]'
if [ "$found" = 0 ]; then
  TILE="() => document.activeElement.getAttribute('data-i')"
  check "first word tile is focused on an order item" '[ "$(js "$TILE")" = "\"0\"" ]'
  pw press ArrowRight >/dev/null; sleep 0.3
  check "→ moves focus to the next word tile" '[ "$(js "$TILE")" = "\"1\"" ]'
  n0=$(qnum); answer_now separable-verbs wrong; sleep 2.5
  check "wrong order answer waits (question $n0) and shows the hint" '[ "$(qnum)" = "$n0" ] && has_text "Tap or click anywhere, or press Enter to continue"'
  check "no Continue button after an order answer" 'no_continue_button'
  cont; n1=$(qnum)
  check "click continues a wrong order answer (question $n0 -> ${n1:-round end})" '[ "$n1" = "$((n0 + 1))" ] || has_text "Round complete!"'
fi

echo "== 4. Logged in: answers are saved, accuracy shows"
login "$E2E_MAIN_EMAIL" "$E2E_MAIN_PASSWORD"
B=$(sql_value "$CNT_SQL"); sql "$CNT_SQL"
pw goto "$BASE/topics/modal-verbs/practice" >/dev/null; sleep 3
answer_now modal-verbs right; sleep 2; answer_now modal-verbs wrong; sleep 3
check "two items answered ('Question 2 of 10 · 1 correct')" 'has_text "Question 2 of 10 · 1 correct"'
sql "$ROWS_SQL"
A=$(sql_value "$CNT_SQL"); sql "$CNT_SQL"
check "2 new attempts rows saved for the main account ($B -> $A)" '[ "$A" = "$((B + 2))" ]'
sql "$LAST2_SQL"
check "the 2 newest modal-verbs rows are one wrong and one right" '[ "$(sql_value "$LAST2_SQL")" = 1 ]'
pw goto "$BASE/topics/modal-verbs" >/dev/null; sleep 3
check "/topics/modal-verbs shows 'Your accuracy so far'" 'has_text "Your accuracy so far"'
pw goto "$BASE/topics" >/dev/null; sleep 3
card_text() { js "() => ([...document.querySelectorAll('a')].find(a=>a.getAttribute('href')==='/topics/modal-verbs')||{}).textContent||''" | unjson; }
check "/topics library card for modal-verbs shows 'Your accuracy'" 'card_text | grep -q "Your accuracy"'
pw close >/dev/null
echo "     attempts rows added by this run: $(( $(sql_value "$CNT_SQL") - START ))"
result
