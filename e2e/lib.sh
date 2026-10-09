#!/bin/bash
# Shared helpers for the end-to-end checks. They drive a real browser with
# playwright-cli (npm install -g @playwright/cli), so no test runner is needed.
# Accounts come from the environment, never from this (public) repo:
#   E2E_MAIN_EMAIL / E2E_MAIN_PASSWORD   the tester; its documents and focus are cleaned up
#   E2E_OTHER_EMAIL / E2E_OTHER_PASSWORD a second account; only read
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
text() { js "() => document.body.innerText" | unjson; } # whole visible page text

check() { if eval "$2"; then echo "  ✅ $1"; else echo "  ❌ $1"; FAILED=1; fi; }
result() { echo; [ "$FAILED" = 0 ] && echo "RESULT: PASS" || echo "RESULT: FAIL"; exit "$FAILED"; }

# Fresh browser, log in through /login, wait until we leave the login page.
login() { # email password
  pw close >/dev/null; pw open "$BASE/login" >/dev/null; pw resize 1280 800 >/dev/null; sleep 3
  js "() => { const set=(sel,v)=>{const t=document.querySelector(sel); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(t,v); t.dispatchEvent(new Event('input',{bubbles:true}));}; set('input[type=email]', $(json "$1")); set('input[type=password]', $(json "$2")); [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Log in').click(); return 1; }" >/dev/null
  for i in $(seq 1 15); do sleep 1; [ "$(js '() => location.pathname')" != '"/login"' ] && { sleep 2; return 0; }; done
  echo "  ❌ login failed for $1 (still on $(js '() => location.pathname'))"; FAILED=1; result
}

# Log out through the Account page, like a user would.
logout() {
  pw goto "$BASE/account" >/dev/null; sleep 3
  js "() => { [...document.querySelectorAll('button')].find(b=>/log ?out/i.test(b.textContent))?.click(); return 1; }" >/dev/null; sleep 4
}

# Click the first button whose text is exactly $1.
click() { js "() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===$(json "$1")); b?.click(); return !!b; }" >/dev/null; }

# SQL against the linked project (read-only selects). Prints the SQL and its result rows.
sql() {
  echo "     SQL: $1"
  npx supabase db query --linked --project-ref "${SUPABASE_PROJECT_REF:-cenzahkgbbnmgzikxvsz}" "$1" 2>/dev/null \
    | python3 -c 'import json,sys;d=json.loads(sys.stdin.read().split("Initialising login role...")[-1]);print("     ->",json.dumps(d["rows"]))'
}
# Prints the single numeric value of a query, or SQL_ERROR (never equal to a number, so checks fail).
sql_value() {
  local v; v=$(npx supabase db query --linked --project-ref "${SUPABASE_PROJECT_REF:-cenzahkgbbnmgzikxvsz}" "$1" 2>/dev/null \
    | python3 -c 'import json,sys;d=json.loads(sys.stdin.read().split("Initialising login role...")[-1]);print(list(d["rows"][0].values())[0])' 2>/dev/null)
  case "$v" in ''|*[!0-9]*) echo "SQL_ERROR"; echo "  SQL failed: $1" >&2;; *) echo "$v";; esac
}
