# Code review: exercise fixes A1–C2, umlaut spellings, /improve-exercises (2026-10-12)

`ai-code-reviewer` on the code and command changes merged into main on 2026-10-12 (merged locally at the owner's request, without a PR):
`content/exercises-all` (104 item fixes, see `exercises-<level>.md`), `feature/umlaut-alternatives`, `feature/improve-exercises-command`.

No High findings. No `"id"` lines changed in `lib/exercises/data`.

## Medium

1. An answer like `Groesse` was marked correct without ever showing `Größe`. **Fixed:** a correct answer typed with ae/oe/ue/ss now shows "Spelled: Größe".
2. ß → ss makes pairs like Maße/Masse and daß/dass equal. The reviewer checked every word in the data: no collision exists today. **Left:** accepted risk; a new item hinging on ß vs ss would need care.
3. Old `attempts` rows keep `correct=false` for spellings like `laeuft`, which the answer-data step of `/improve-exercises` could flag. **Fixed:** the command now says such spellings are not suspects and must not be added to `answers`.

## Low

4. `order` items go through the same check; no practical change (answers come from the tiles).
5. The "Check the capital letters" hint used the old matching. **Fixed:** it uses the same spelling-aware matching.
6. Uppercase É was missing. **Fixed.**
7. `/improve-exercises` step 7 pushes and opens a PR. Fine from now on.
8. The CLAUDE.md note is a long sentence. Left as is.

## Checks after the fixes

- `npm test`: 159/159 pass; `npm run lint`: clean
- `e2e/all-practice-pages.sh` PASS (81 pages), `e2e/articles.sh` PASS, `e2e/exercises.sh` PASS (51 checks)
- One-off browser check: `duerfte` accepted for `dürfte`; `waren` still wrong for `wären`
- `/security-scan-changed`: not run (no data access, auth or secrets touched)
