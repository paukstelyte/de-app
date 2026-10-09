#!/bin/bash
# Shared helpers for the end-to-end checks. They drive a real browser with
# playwright-cli (npm install -g @playwright/cli), so no test runner is needed.
# Accounts come from the environment, never from this (public) repo:
#   E2E_MAIN_EMAIL / E2E_MAIN_PASSWORD   the tester; their chat is reset ("New chat")
#   E2E_OTHER_EMAIL / E2E_OTHER_PASSWORD a second account; only its notes are touched
# BASE defaults to the local dev server.

BASE=${BASE:-http://localhost:3000}
FAILED=0

for v in E2E_MAIN_EMAIL E2E_MAIN_PASSWORD E2E_OTHER_EMAIL E2E_OTHER_PASSWORD; do
  [ -n "${!v}" ] || { echo "Missing $v (see e2e/README.md)"; exit 2; }
done

pw() { playwright-cli "$@" 2>&1; }
js() { pw eval "$1" | sed -n 2p; } # prints the JSON-encoded result
json() { python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$1"; }
unjson() { python3 -c 'import json,sys;print(json.loads(sys.stdin.read() or "\"\""))'; }

check() { if eval "$2"; then echo "  ✅ $1"; else echo "  ❌ $1"; FAILED=1; fi; }
result() { echo; [ "$FAILED" = 0 ] && echo "RESULT: PASS" || echo "RESULT: FAIL"; exit "$FAILED"; }

# Fresh browser, log in, wait until we leave the login page.
login() { # email password
  pw close >/dev/null; pw open "$BASE/login" >/dev/null; pw resize 1280 800 >/dev/null; sleep 3
  js "() => { const set=(sel,v)=>{const t=document.querySelector(sel); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(t,v); t.dispatchEvent(new Event('input',{bubbles:true}));}; set('input[type=email]', $(json "$1")); set('input[type=password]', $(json "$2")); [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Log in').click(); return 1; }" >/dev/null
  for i in $(seq 1 15); do sleep 1; [ "$(js '() => location.pathname')" != '"/login"' ] && return 0; done
  echo "  login failed for $1"; return 1
}

# Log out through the Account page, like a user would.
logout() {
  pw goto "$BASE/account" >/dev/null; sleep 3
  js "() => { [...document.querySelectorAll('button')].find(b=>/log ?out/i.test(b.textContent))?.click(); return 1; }" >/dev/null; sleep 4
}

click() { js "() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===$(json "$1")); b?.click(); return !!b; }" >/dev/null; }

# Waits for the Notes page's "Note saved." / error message and prints it.
wait_note_msg() {
  for i in $(seq 1 30); do sleep 1
    m=$(js "() => document.querySelector('[role=status], [role=alert]')?.textContent || ''")
    [ "$m" != '""' ] && { echo "$m" | unjson; return; }
  done; echo "(no message after 30s)"
}

add_note() { # title content -> prints the page's message
  pw goto "$BASE/notes" >/dev/null; sleep 3
  js "() => { const set=(sel,v)=>{const t=document.querySelector(sel); const P=t.tagName==='TEXTAREA'?HTMLTextAreaElement:HTMLInputElement; Object.getOwnPropertyDescriptor(P.prototype,'value').set.call(t,v); t.dispatchEvent(new Event('input',{bubbles:true}));}; set('#note-title', $(json "$1")); set('#note-content', $(json "$2")); return 1; }" >/dev/null
  click "Save note"; wait_note_msg
}

delete_note() { # title
  pw goto "$BASE/notes" >/dev/null; sleep 3
  js "() => { const a=[...document.querySelectorAll('article')].find(a=>a.querySelector('h3')?.textContent===$(json "$1")); [...(a?.querySelectorAll('button')||[])].find(b=>b.textContent.trim()==='Delete')?.click(); return !!a; }" >/dev/null
  sleep 1; click "Yes, delete it"; wait_note_msg >/dev/null
}

open_chat() { pw goto "$BASE/chat" >/dev/null; sleep 4; }

new_chat() { js "() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='New chat'); if (b && !b.disabled) b.click(); return 1; }" >/dev/null; sleep 3; }

pick_tutor() { js "() => { const s=document.querySelector('select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,$(json "$1")); s.dispatchEvent(new Event('change',{bubbles:true})); return 1; }" >/dev/null; }

# Sends a chat message and prints the tutor's reply (or ERROR: …).
send() {
  local before; before=$(js "() => document.querySelectorAll('.self-start .whitespace-pre-wrap').length")
  js "() => { const t=document.querySelector('#chat-input'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t, $(json "$1")); t.dispatchEvent(new Event('input',{bubbles:true})); t.focus(); return 1; }" >/dev/null
  pw press Enter >/dev/null
  for i in $(seq 1 45); do sleep 1
    local alert; alert=$(js "() => document.querySelector('[role=alert]')?.textContent || ''")
    [ "$alert" != '""' ] && { echo "ERROR: $(echo "$alert" | unjson)"; return 1; }
    local now; now=$(js "() => document.querySelectorAll('.self-start .whitespace-pre-wrap').length")
    [ "$now" -gt "$before" ] 2>/dev/null && { js "() => [...document.querySelectorAll('.self-start .whitespace-pre-wrap')].at(-1).textContent" | unjson; return 0; }
  done; echo "ERROR: no reply within 45s"; return 1
}

# Plain "not found in your notes" wording the tutor is told to use (lib/rag.ts).
NOT_FOUND_RE="couldn.t find this in your notes|could not find this in your notes|konnte das nicht in deinen notizen|nicht in (deinen|ihren) notizen"
