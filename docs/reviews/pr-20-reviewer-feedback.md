# ai-code-reviewer report: PR #20

- **Pull request:** "Reviewer feedback: visible failures, typed data boundaries, safer AI flow, standard tests"
- **Branch:** `reviewer-feedback` → `main`, reviewed at commit `066fdd7`
- **Date:** 2026-10-14
- **Reviewer:** the `ai-code-reviewer` subagent, run on `git diff main...HEAD` (the removed third-party skill files left out). It ran `npm test` (165/165), `tsc` and lint, and wrote proof-of-concept scripts for the two critical findings.

## Verdict
Two critical findings, both memory blow-ups from crafted uploads, both reproduced. Both are fixed in the follow-up commit, with tests. The new browser and database tests hadn't been run at review time (no Docker).

## Findings and what was done

### Critical
1. **The Word zip-bomb guard could be bypassed.** The guard read the zip's table of contents differently from JSZip (the zip library mammoth uses): JSZip reads every entry it finds whatever the header's count says, shifts offsets when there's data in front of the zip, and switches to zip64 on any 0xFFFF field. A 61 KB file unpacked to 60 MB. *Fixed:* the guard now reads the zip exactly as JSZip does (`jszip/lib/zipEntries.js`) and refuses anything JSZip could read differently: a count mismatch, data before the zip, zip64 markers, or a central directory that doesn't end at its end record. Three new tests, including the reviewer's attack.
2. **pdf-lib unpacked compressed object streams with no size limit.** A 306 KB PDF took 299 MB of memory. *Fixed:* pdf-lib is no longer used on the server (it stays a dev dependency to build test PDFs). `pdfPageCount` counts pages itself and unpacks only object streams, with a hard 50 MB cap. The reviewer's PDF is now refused in 20 ms; compressed pages are still counted.

### Warning
1. **`OPENROUTER_BASE_URL` could send the real key to any host.** *Fixed:* only `http://127.0.0.1:<port>` or `http://localhost:<port>` is accepted; anything else falls back to OpenRouter.
2. **Strict checking turned usable AI answers into paid failures.** *Fixed:* the answer is checked with `z.object`. The JSON schema sent to the model still has `additionalProperties: false`; an extra key in the answer is dropped, not wasted. New test.
3. **One odd saved suggestion hid a document's topics silently.** *Fixed:* the same tolerant schema, and a failure is logged.
4. **Behaviour changes to confirm.** A text-less PDF scan is now refused and counted (it used to be saved as "no grammar"), and an answer with no catalogue topics is an error that counts. These come from the feedback ("distinguish unreadable documents, invalid model responses and genuine no-grammar results") and are listed for the owner. *Changed:* a Word file the model "can't read" (it always has text) is now reported as an invalid answer, and the messages no longer mention scans for Word files.
5. **der · die · das tests would be flaky.** Cards with an exception note wait even after a right answer. *Fixed:* the tests look up each noun's article in `seed.json` and answer right or wrong on purpose.
6. **The faults test raced PostgREST's schema cache.** *Fixed:* the retry is wrapped in `expect(...).toPass()`.
7. **The second-user check counted help links.** *Fixed:* it now checks that no document and none of the first user's topics are shown.
8. **Two loaders duplicated the query and error handling.** *Fixed:* one shared `withFocus`, with the two column lists.

### Suggestion
- `PROMPT_VERSION` isn't stored: kept, and its comment now says storing it is part of the planned evaluation step.
- Unsaved answers were lost silently on leaving the page: *added* a `beforeunload` prompt while any are unsaved; the logged-out wording now clears on the next result.
- `app/error.tsx` now logs the error digest; "Nothing was lost" was removed from the message.
- The CSP's `upgrade-insecure-requests` is now dropped only with an explicit `E2E=1` flag, never because of a URL.
- `engines` is now `>=24`.
- The pgTAP upload test's bare `select`s are wrapped in `lives_ok`.
- Not done: a shared hook for the two localStorage choices (level band, auto-advance), and releasing preview URLs on unmount (minor). The 2026-10-09 design spec still says 3–6 topics; it is kept as the record of that design.

## Security scan
See the PR for `/security-scan-changed`.
