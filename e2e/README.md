# End-to-end checks

Browser checks for Customized Learning, driven by [playwright-cli](https://www.npmjs.com/package/@playwright/cli)
(`npm install -g @playwright/cli`). `learning.sh` prints one line per check and ends with
`RESULT: PASS` or `RESULT: FAIL` (exit code 0 or 1).

| Check | What it verifies |
|---|---|
| Guest and login | Guest `/learning` shows "Log in to use Customized Learning"; logging in lands on `/learning`; `/` redirects there |
| PDF, HEIC photo, Word | Each upload creates a "Lektion 7" document with `prepositions-dative` / `dative-case`, listed under "Your focus now" |
| Blank image | "No German grammar topics found", no topics |
| Storage | After every upload the `learning-uploads` bucket is empty (read-only SQL, printed with its result) |
| Focus | "Remove from focus" hides a topic; "Add to my focus" on `/topics/modal-verbs` adds it |
| Delete | A deleted document is gone after reload |
| Other user | The second account sees none of the first account's documents or focus |
| Rejections | A `.doc` file and 6 photos show the plain error messages and use no quota or storage |

## Run

Start the app (`npm run dev`), then pass two test accounts in the environment. Never commit
their passwords; this repository is public. The SQL checks use the linked Supabase project
(`npx supabase db query --linked`; set `SUPABASE_PROJECT_REF` to override the project).

```bash
export E2E_MAIN_EMAIL=…  E2E_MAIN_PASSWORD=…    # the tester: must be a disposable test account (documents deleted at the end)
export E2E_OTHER_EMAIL=… E2E_OTHER_PASSWORD=…   # second account; only read
bash e2e/learning.sh
```

Set `BASE=https://…` to run against another deployment.

## Cost and side effects

- Each run makes **4 real AI analyses** (about $0.0005 each) and uses 4 of the main account's
  10 uploads per day, so run it at most twice a day. The `.doc` and 6-photo checks are rejected
  in the browser and cost nothing.
- Documents the run creates are deleted through the page. The page cannot delete focus rows, so
  the main account keeps two "removed" rows (`modal-verbs` and the topic removed in the focus check).
- `fixtures/` holds only the German sample text "Lektion 7: Präpositionen mit Dativ …" (plus a one-line
  English `old.doc` placeholder); the 6 photos are copies of `blank.png` made in a temp folder at run time.

## Grammar practice (`exercises.sh`)

Checks the `/topics/<slug>/practice` pages: guest links and 404s, a full guest round (3 wrong, 7 right;
"Practise my mistakes (3)"; "Next 10"; all three item types), no rows written for guests, answers saved
to `public.attempts` when logged in (and "Your accuracy so far" on the topic page and the `/topics` card),
no horizontal scroll at 390px, and Enter to submit/continue on a type item. The right and wrong answers
come from `lib/exercises/data/<slug>.json`. No AI is involved, so it costs nothing.

```bash
export E2E_MAIN_EMAIL=…  E2E_MAIN_PASSWORD=…    # same accounts as above (the OTHER pair is only needed by lib.sh)
export E2E_OTHER_EMAIL=… E2E_OTHER_PASSWORD=…
bash e2e/exercises.sh                            # about 3 minutes
```

Side effect: each run adds 2 `modal-verbs` rows to the main account's `public.attempts` (they stay).
