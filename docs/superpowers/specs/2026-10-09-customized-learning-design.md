# Customized Learning — design

Date: 2026-10-09. Agreed with the user in a grilling session (27 decisions). Steps 1 (A1–C2
topic catalogue, `lib/grammar/topics.json`) and 2 (Grammar Topics library, `/topics`) are
live. This spec covers step 3.

## Goal

Logged-in learners upload what they're learning now (a PDF, a Word file or up to 5 photos).
The app reads it with AI, suggests grammar topics from the fixed catalogue, keeps a "focus"
list of what they're working on, and shows their progress on those topics. Customized
Learning becomes the app's central page.

## Decisions

| Area | Decision |
|---|---|
| Name and address | "Customized Learning", `/learning` |
| Who | Logged-in users only; guests see the page with a "log in to use this" message |
| Landing | After any login (email/password, Google, confirmation link) and when opening `/` while logged in. An explicit `next=` still wins. |
| Nav | Customized Learning · Grammar Topics · Progress · Account (guests: Customized Learning, Grammar Topics, Log in) |
| Guest front page | Leads with Customized Learning and Sign up / Log in; flashcards below as "try it without an account" |
| Upload contents | One PDF, or one `.docx`, or up to 5 photos (JPG, PNG, WebP, HEIC/HEIF; extension checked too). ≤ 10 MB per file, PDFs ≤ 20 pages |
| Material | Printed or typed only (no handwriting). Upload note: "Upload printed or typed learning material, such as textbook pages, worksheets, typed notes or homework, as a PDF, Word file or up to 5 photos (JPG/PNG/HEIC). Handwriting isn't supported. Don't upload documents with personal details." |
| File handling | Browser uploads straight to a private Supabase Storage bucket (Vercel's 4.5 MB body limit); the server reads it, sends it to the AI, then deletes it, success or failure. Only the extracted text and suggestions are kept. |
| Word files | Small built-in reader (zip + XML, no new package); unusual files → "Couldn't read this Word file. Save it as PDF and upload that." |
| AI | `google/gemini-2.5-flash-lite` via OpenRouter (one setting), server-side only, structured JSON output. PDFs with the file-parser engine set explicitly to `native` (never the paid OCR default). About $0.0004 per document. |
| Suggestions | Only from what's in the document. 3–6 topics, only from the catalogue (anything else dropped), mistakes shown in the document first, then topics it covers; each with level and a one-line reason quoting the document. No readable text or no German grammar → say so, suggest nothing (a blank image made the model invent text in testing). |
| Saved per document | AI title, date, extracted text ("What I read", folded), suggestions; Delete; no re-analyse; removed with the account |
| Focus | "Your focus now": topics from uploads in the last 30 days, combined — more documents and mistakes rank higher; the user can remove a topic or add one from the library |
| Progress | Per focus topic: answers, accuracy, last practised, in focus since (date, document); from the existing `attempts` table; topics without exercises show "no exercises yet" |
| Limits | 10 uploads a day per user, 100 a day app-wide, 200 saved documents per user (database-enforced); "no grammar found" still counts |
| Privacy | Privacy page updated: documents are sent through OpenRouter to Google; files deleted after reading |

## Out of scope

Building exercises, using flashcard history in suggestions, handwriting, re-analysing a saved
document, choosing the AI model.
