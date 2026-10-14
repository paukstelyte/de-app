# ai-code-reviewer report: PR #25

- **Pull request:** https://github.com/paukstelyte/de-app/pull/25 — "Stricter passwords: 10+ characters, upper- and lower-case letters and a number"
- **Branch:** `stricter-passwords` → `main`
- **Date:** 2026-10-14
- **Reviewer:** the `ai-code-reviewer` subagent, on `git diff main...HEAD`. It ran `npm test` (173/173), `tsc` and lint, and tested the rule against the local Supabase directly (its 4 test users were deleted afterwards).
- **Security scans:** Supabase and Next.js scanners. No critical, high or (apart from the deploy step below) medium findings.

## Verdict
No critical issues. The browser rule and Supabase's rule count the same characters (A–Z, a–z, 0–9 only; umlauts and ß count as neither case); Supabase counts length in bytes, so the browser is the same or stricter. Existing users are not locked out: an old-style password still signs in.

## Findings and what was done
1. **The live project needs `supabase config push`** (reviewer, both scanners). `config.toml` only drives the local Supabase. *Done before merging:* a preview showed exactly the two password settings change and no secrets sent; then pushed and checked.
2. **A weak password refused by the server showed Supabase's raw message** (reviewer, both scanners). *Fixed:* the `weak_password` error shows the plain rule; the e2e test now checks that text.
3. **German learners may expect ä/ö/ü/ß to count as letters.** *Fixed:* the hint says "A–Z, a–z; umlauts and ß don't count", and the browser test has an umlaut case.
4. **The local auth server reads `config.toml` only on start.** *Documented* in `e2e/README.md`.
5. **Remaining gaps** (Supabase scanner): no CAPTCHA, leaked-password protection needs Pro, existing passwords stay until changed. *Added to `docs/todo.md`* (free Cloudflare Turnstile); the README states the rest.

## Checks after the fixes
`npm test` 173/173, `tsc`, lint, `npm run test:e2e` (the full suite passed 119/119 before the fixes; the auth specs 5/5 after).
