import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth-forms";

export async function AuthButton() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email;

  return email ? (
    <div className="flex items-center gap-2 text-sm">
      <span className="hidden text-zinc-500 sm:inline">{email}</span>
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
