# End-to-end checks

Browser checks for the RAG chat, driven by [playwright-cli](https://www.npmjs.com/package/@playwright/cli)
(`npm install -g @playwright/cli`). Each script prints one line per check and ends with
`RESULT: PASS` or `RESULT: FAIL` (exit code 0 or 1). They call the real AI, so replies vary a
little between runs and each run uses a few chat messages from the accounts' daily limit.

| Script | What it checks |
|---|---|
| `rag-happy-path.sh` | Save a note with a fact, ask about it: the answer has the fact and mentions the note |
| `rag-nothing-relevant.sh` | Ask something no note answers: the tutor says it couldn't find it in the notes and doesn't invent an answer |
| `rag-cross-user.sh` | User A saves a note and signs out; user B asks about it: B's answer never contains A's note |

## Run

Start the app (`npm run dev`), then pass two test accounts in the environment. Never commit
their passwords; this repository is public.

```bash
export E2E_MAIN_EMAIL=…  E2E_MAIN_PASSWORD=…    # the tester; their chat is reset
export E2E_OTHER_EMAIL=… E2E_OTHER_PASSWORD=…   # second account; only its notes are touched
for t in e2e/rag-*.sh; do bash "$t" || echo "FAILED: $t"; done
```

Set `BASE=https://…` to run against another deployment. Each script deletes the notes it
creates and starts and ends with "New chat" for the main account.
