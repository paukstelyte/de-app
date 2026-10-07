# AI chat with tutor personas — design

Date: 2026-10-06 · Branch: `feature/ai-chat`

## Goal

A `/chat` page where a logged-in learner talks to an AI German tutor. The AI
remembers the conversation (follow-ups like "what did you mean by that?" work),
the user can switch between three tutor personas at any time, the OpenRouter
key never reaches the browser, and the model is changed by editing one value.

## Decisions (agreed with the user)

| Topic | Decision |
|---|---|
| Access | Any logged-in user. Guests are redirected to `/login?next=/chat`. |
| Conversation lifetime | In the browser's memory only. Reload or "New chat" starts fresh. Nothing is stored except usage counts. |
| Purpose | German grammar tutor (A1–B2), kept on German-learning topics. |
| Personas | Three, switchable at any time; the conversation continues. |
| Language | Strict tutor: simple German (A2–B1) only. Others: English with German examples. |
| Transport | Server action, plain `fetch` to OpenRouter, whole reply at once (no streaming). No new packages. |
| Model | From env var `OPENROUTER_MODEL`, default `google/gemma-4-31b-it` (paid, ~$0.00004/reply: the account's guardrail blocks all free models, so this is the cheapest allowed model that works). |

## Personas — `lib/chat.ts`

One list; adding a persona = adding an entry. Each entry: `id`, `name`,
`tagline` (shown in the picker), `prompt` (persona-specific instructions).

| id | name | voice | language |
|---|---|---|---|
| `softie` (default) | Lotte | Endlessly encouraging and patient; celebrates small wins. | English + German examples |
| `strict` | Frau Streng | Demanding and precise, no small talk; corrects every German mistake and asks for a retry. | Simple German (A2–B1) only |
| `british` | Nigel | Cheerfully annoying Brit: bad puns, tea, "right then!". Grammar still correct under the jokes. | English + German examples |

All personas share a base prompt: German-learning topics only (politely steer
back otherwise), A1–B2 level, accurate grammar, short answers.

## Data flow

1. `components/Chat.tsx` (client) holds `messages: {role, content, persona?}[]`
   and the selected persona id in React state.
2. On send it calls the server action `sendChatMessage(personaId, messages)`
   in `app/chat/actions.ts`.
3. The action:
   1. checks the user is logged in (`getClaims`), else returns an error;
   2. looks up `personaId` in the persona list, rejects unknown ids;
   3. cleans the history with `cleanHistory()` (`lib/chat.ts`, which has no
      imports so Node's test runner can load it):
      keeps only `user`/`assistant` roles with string content, trims each
      message to 2,000 characters, drops empty ones, keeps the last 20, and
      requires the last message to be from the user;
   4. calls the `use_chat_quota()` database function, which enforces the rate
      limit and records one `chat_usage` row;
   5. builds the request: base prompt + persona prompt as the system message,
      then the history. Earlier assistant replies from a *different* persona
      are prefixed `[Earlier reply by <name>]` so the current voice doesn't
      copy them;
   6. `POST https://openrouter.ai/api/v1/chat/completions` with
      `Authorization: Bearer ${OPENROUTER_API_KEY}` and
      `model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL`;
   7. returns `{ reply }` or `{ error }` (friendly text only, never raw
      provider errors).
4. The client appends the reply labelled with the persona's name.

The key is read only in the `"use server"` file and has no `NEXT_PUBLIC_`
prefix. The browser talks only to our own origin, so the CSP needs no change.

## Rate limiting — migration `create_chat_usage`

Table `public.chat_usage (id identity pk, user_id uuid references auth.users
on delete cascade, created_at timestamptz default now())`.

- RLS on with **no** policies, and all privileges revoked from `anon` and
  `authenticated`: users cannot read, insert, back-date or delete rows.
- `public.use_chat_quota()` (`security definer`, `search_path = ''`, execute
  granted to `authenticated` only) takes an advisory lock, raises
  `P0001` when the caller (`auth.uid()`) has ≥ 10 rows in the last minute or
  ≥ 25 in the last 24 hours, or when all users together have ≥ 45 in the
  last 24 hours (review fix: the free tier's 50/day is account-wide), and
  otherwise inserts one row.

OpenRouter's free tier is account-wide: 20 requests/min, 50/day (1,000/day
after $10 of credits ever purchased). An OpenRouter `429` is shown as
"The AI is busy or out of messages for today — try again later."

## UI — `app/chat/page.tsx` + `components/Chat.tsx`

- Persona picker (dropdown with name + tagline) above the input; default Lotte.
- Message list: user messages right-aligned, AI messages left with persona
  name label; uses existing design tokens (`--paper`, `--accent`, `--line`).
- Empty state: "Ask me anything about German grammar…".
- Input at the bottom: Enter sends, Shift+Enter new line; disabled with
  "Thinking…" while waiting. Auto-scroll to newest message.
- New replies announced via a `role="status"` live region.
- Errors shown inline (`role="alert"`); the failed message is removed from
  the list and its text goes back into the input so the user can resend it.
- "New chat" button clears the conversation.
- Nav: "Chat" link in `components/NavBar.tsx`.

## Other changes

- `lib/supabase/proxy.ts`: add `/chat` to `PROTECTED_PATHS`.
- `.env.example`: `OPENROUTER_API_KEY=` and `OPENROUTER_MODEL=` (commented).
- `app/privacy/page.tsx`: chat messages are sent to OpenRouter and the model's
  provider; free models may log them.
- `docs/supabase-schema.md`: document `chat_usage`.
- Vercel: add `OPENROUTER_API_KEY` (and optionally `OPENROUTER_MODEL`).

## Error handling

| Case | User sees |
|---|---|
| Not logged in | Redirect to login (page); "Please log in again." (action) |
| Rate limit trigger | "You've reached the chat limit — try again in a bit." |
| OpenRouter 429 | "The AI is busy or out of messages for today — try again later." |
| Missing key / other failure | "Something went wrong — please try again." (details logged server-side) |

## Testing

- `lib/chat.test.mjs` (node:test, like the existing tests): `cleanHistory`
  role filtering, 2,000-char trim, last-20 cap, last-message-must-be-user;
  persona lookup rejects unknown ids; persona labelling; reply extraction;
  429 mapping.
- Manual (Playwright CLI): follow-up question keeps context; switching persona
  mid-chat changes voice and language; key absent from page source and
  network requests; guest redirected to login; limit message appears.

## Out of scope

Streaming replies, saved conversations, per-persona separate chats, guest access.
