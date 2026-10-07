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
    // data-fit-screen: the layout sizes this page to the window, so only the message list scrolls.
    <div data-fit-screen className="flex min-h-0 flex-1 flex-col gap-6">
      <div>
        <div className="mb-4 h-2 w-12 bg-[var(--accent)]" />
        <h1 className="text-3xl font-bold leading-none tracking-[-0.06em] sm:text-4xl">Chat with a tutor</h1>
        <p className="mt-3 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Ask questions about German grammar and get answers from an AI tutor. The conversation
          lasts until you reload the page. AI can make mistakes, so check anything important on the{" "}
          <Link href="/rules" className="underline underline-offset-2">Rules</Link> page.
        </p>
      </div>
      <Chat />
    </div>
  );
}
