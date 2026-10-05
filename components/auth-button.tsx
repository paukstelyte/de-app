import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth-forms";

export async function AuthButton() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email;

  return email ? (
    <div className="flex items-center gap-1 text-sm">
      <Link
        href="/progress"
        className="whitespace-nowrap rounded-full px-2.5 py-1.5 font-medium text-zinc-600 transition-colors hover:bg-black/5 sm:px-3 dark:text-zinc-400 dark:hover:bg-white/10"
      >
        Progress
      </Link>
      <span className="hidden text-zinc-500 lg:inline">{email}</span>
      <LogoutButton />
    </div>
  ) : (
    <Link
      href="/login"
      className="whitespace-nowrap rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/5 dark:border-zinc-700 dark:hover:bg-white/10"
    >
      Log in
    </Link>
  );
}
