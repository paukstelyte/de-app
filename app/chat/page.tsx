import Link from "next/link";
import { redirect } from "next/navigation";
import { Chat } from "@/components/Chat";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Chat" };

export default async function ChatPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?next=/chat");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="mb-5 h-2 w-12 bg-[var(--accent)]" />
        <h1 className="text-4xl font-bold leading-none tracking-[-0.06em] sm:text-5xl">Chat with a tutor</h1>
        <p className="mt-4 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Ask questions about German grammar and get answers from an AI tutor. The conversation
          lasts until you reload the page. AI can make mistakes, so check anything important on the{" "}
          <Link href="/rules" className="underline underline-offset-2">Rules</Link> page.
        </p>
      </div>
      <Chat />
    </div>
  );
}
