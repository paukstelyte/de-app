-- Remove the AI tutor chat and the notes vector store built for its RAG
-- (2026-10-09). The app no longer has a chat or a Notes page; a new AI feature
-- will get its own tables. Deletes their data: saved chat messages, chat and
-- note-save counters, notes and their chunks.

-- Notes vector store (20261008100000, 20261008120000, 20261009100000).
drop function if exists public.match_documents(extensions.vector, float, int, uuid);
drop function if exists public.save_note_with_chunks(bigint, text, text, text[], text[]);
drop function if exists public.use_note_quota();
drop table if exists public.documents;      -- also drops trigger documents_limit
drop table if exists public.notes;          -- also drops trigger notes_limit
drop table if exists public.note_save_usage;
drop function if exists public.enforce_documents_limit();
drop function if exists public.enforce_notes_limit();
drop extension if exists vector;

-- Chat (20261006120000, 20261006130000, 20261007140000).
drop function if exists public.save_chat_turn(text, text, text);
drop function if exists public.use_chat_quota();
drop table if exists public.chat_messages;
drop table if exists public.chat_usage;
