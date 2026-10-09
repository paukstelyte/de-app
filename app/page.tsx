import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const label = "text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400";
const pillPrimary = "inline-flex items-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";
const pillGhost = "inline-flex items-center rounded-full border border-[var(--line)] px-5 py-2.5 text-sm font-medium";
const card = "flex h-full flex-col gap-3 border border-[var(--line)] bg-[var(--paper)] p-6 transition-transform hover:-translate-y-0.5";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { account } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect("/learning");

  return (
    <div className="flex flex-col gap-12">
      {account === "deleted" && (
        <p role="status" className="border border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-sm">
          Your account and all your saved answers have been deleted.
        </p>
      )}
      <section className="flex flex-col gap-6 border border-[var(--line)] bg-[var(--paper)] p-6 shadow-[8px_8px_0_var(--accent)] sm:p-8">
        <div>
          <div className="mb-4 h-2 w-12 bg-[var(--accent)]" />
          <p className={label}>Customized Learning</p>
          <h1 className="mt-3 text-4xl font-bold leading-none tracking-[-0.06em] sm:text-5xl">
            Upload what you&apos;re learning and get grammar topics to practise
          </h1>
        </div>
        <ol className="grid gap-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400 sm:grid-cols-3 sm:gap-6">
          <li><b>1. Upload</b><br />A textbook page, worksheet, notes or homework.</li>
          <li><b>2. We read it</b><br />We pick the grammar topics it covers.</li>
          <li><b>3. Practise</b><br />Work through the suggested topics and track your progress.</li>
        </ol>
        <div className="flex flex-wrap gap-3">
          <Link href="/auth/sign-up" className={pillPrimary}>Sign up</Link>
          <Link href="/login?next=/learning" className={pillGhost}>Log in</Link>
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="try-title">
        <h2 id="try-title" className={label}>Try it without an account</h2>
        <ul className="grid gap-6 sm:grid-cols-2">
          <li>
            <Link href="/topics" className={card}>
              <span className="text-2xl font-bold tracking-[-0.04em]">Grammar Topics</span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">From der, die, das to reported speech: pick a topic and start practising.</span>
            </Link>
          </li>
          <li>
            <Link href="/articles" className={card}>
              <span className="text-2xl font-bold tracking-[-0.04em]">der · die · das</span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Flashcards for noun gender, with the rule behind every answer.</span>
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
