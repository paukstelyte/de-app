import Link from "next/link";
import { TOPICS } from "@/lib/topics";

export default function Home() {
  return (
    <div className="flex flex-col gap-10">
      <div>
        <div className="mb-5 h-2 w-12 bg-[var(--accent)]" />
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">German grammar practice · A1–B2</p>
        <h1 className="mt-3 text-4xl font-bold leading-none tracking-[-0.06em] sm:text-5xl">Pick a topic</h1>
      </div>

      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map((topic, i) => (
          <li key={topic.slug}>
            <Link
              href={topic.href}
              className="flex h-full flex-col gap-3 border border-[var(--line)] bg-[var(--paper)] p-6 shadow-[8px_8px_0_var(--accent)] transition-transform hover:-translate-y-0.5"
            >
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-2xl font-bold tracking-[-0.04em]">{topic.title}</span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{topic.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
