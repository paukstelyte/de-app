"use client";

import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { sendChatMessage } from "@/app/chat/actions";
import { CHAT_ERRORS, DEFAULT_PERSONA_ID, MAX_CHARS, PERSONAS, personaName, type ChatMessage } from "@/lib/chat";

const pillPrimary =
  "inline-flex items-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";
const pillSecondary =
  "inline-flex items-center rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10";

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [personaId, setPersonaId] = useState(DEFAULT_PERSONA_ID);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const busy = useRef(false); // blocks a second Enter before React re-renders
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, isPending]);

  function send(e?: { preventDefault(): void }) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy.current) return;
    busy.current = true;
    const before = messages;
    const history: ChatMessage[] = [...before, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    setError(null);
    startTransition(async () => {
      const result = await sendChatMessage(personaId, history).catch(() => ({ error: CHAT_ERRORS.generic }));
      if ("reply" in result) {
        setMessages([...history, { role: "assistant", content: result.reply, persona: personaId }]);
      } else {
        setMessages(before);
        setInput(text);
        setError(result.error);
      }
      busy.current = false;
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) send(e);
  }

  const last = messages.at(-1);
  const announcement = isPending
    ? "Thinking…"
    : last?.role === "assistant"
      ? `${personaName(last.persona)}: ${last.content}`
      : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col border border-[var(--line)] bg-[var(--paper)] shadow-[8px_8px_0_var(--accent)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] p-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          Tutor
          <select
            value={personaId}
            onChange={(e) => setPersonaId(e.target.value)}
            className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-sm"
          >
            {PERSONAS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.tagline}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={pillSecondary}
          disabled={isPending || messages.length === 0}
          onClick={() => {
            setMessages([]);
            setError(null);
          }}
        >
          New chat
        </button>
      </div>

      <div ref={listRef} className="flex min-h-40 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        {messages.length === 0 && !isPending && (
          <p className="m-auto max-w-sm text-center text-sm text-zinc-500">
            Ask me anything about German grammar. Pick a tutor above; you can switch any time.
          </p>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="max-w-[85%] self-end whitespace-pre-wrap bg-zinc-900 px-4 py-2.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
              {m.content}
            </div>
          ) : (
            <div key={i} className="max-w-[85%] self-start">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                {personaName(m.persona)}
              </div>
              <div className="whitespace-pre-wrap border border-[var(--line)] px-4 py-2.5 text-sm leading-6">{m.content}</div>
            </div>
          ),
        )}
        {isPending && <p className="self-start text-sm text-zinc-500">{personaName(personaId)} is thinking…</p>}
      </div>

      <form onSubmit={send} className="flex flex-col gap-2 border-t border-[var(--line)] p-4">
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="flex items-end gap-3">
          <label className="sr-only" htmlFor="chat-input">
            Your message
          </label>
          <textarea
            id="chat-input"
            rows={2}
            maxLength={MAX_CHARS}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type your message…"
            className="min-h-[3rem] flex-1 resize-y border border-[var(--line)] bg-transparent px-3 py-2 text-sm"
          />
          <button type="submit" className={pillPrimary} disabled={isPending || !input.trim()}>
            Send
          </button>
        </div>
        <p className="text-xs text-zinc-500">Enter to send · Shift+Enter for a new line</p>
      </form>

      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
