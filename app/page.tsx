import Link from "next/link";
import { TOPICS } from "@/lib/grammar/topics";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { account } = await searchParams;
  return (
    <div className="flex flex-col gap-10">
      {account === "deleted" && (
        <p role="status" className="border border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-sm">
          Your account and all your saved answers have been deleted.
        </p>
      )}
      <div>
        <div className="mb-5 h-2 w-12 bg-[var(--accent)]" />
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">German grammar practice · A1–C2</p>
        <h1 className="mt-3 text-4xl font-bold leading-none tracking-[-0.06em] sm:text-5xl">{TOPICS.length} grammar topics, one place</h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Browse every grammar topic from beginner to proficient, read what each one is about and
          practise it. No account needed to play.{" "}
          <Link href="/auth/sign-up" className="underline underline-offset-2">Sign up</Link> to save
          your answers and see your progress.
        </p>
      </div>

      <ul className="grid gap-6 sm:grid-cols-2">
        <li>
          <Link
            href="/topics"
            className="flex h-full flex-col gap-3 border border-[var(--line)] bg-[var(--paper)] p-6 shadow-[8px_8px_0_var(--accent)] transition-transform hover:-translate-y-0.5"
          >
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">All topics · A1–C2</span>
            <span className="text-2xl font-bold tracking-[-0.04em]">Grammar Topics</span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              From der, die, das to reported speech: pick a topic and start practising.
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/articles"
            className="flex h-full flex-col gap-3 border border-[var(--line)] bg-[var(--paper)] p-6 transition-transform hover:-translate-y-0.5"
          >
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">Try it now · A1</span>
            <span className="text-2xl font-bold tracking-[-0.04em]">der · die · das</span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              Flashcards for noun gender, with the rule behind every answer.
            </span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
