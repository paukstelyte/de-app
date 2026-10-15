import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth-forms";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { CONFIRM_WORD } from "@/lib/account";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email;
  if (!email) redirect("/login?next=/account");

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div>
        <div className="mb-5 h-2 w-12 bg-[var(--accent)]" />
        <h1 className="text-4xl font-bold leading-none tracking-[-0.06em] sm:text-5xl">Account</h1>
      </div>

      <section className="panel flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="section-heading">Logged in as</h2>
          <p className="mt-1 text-sm">{email}</p>
        </div>
        <LogoutButton />
      </section>

      <section className="panel flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="section-heading">Your data</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Everything saved in your account (account details, answers, Customized Learning), as a JSON file.
          </p>
        </div>
        <a href="/account/export" download className="pill-secondary">Download my data</a>
      </section>

      <section className="panel flex flex-col gap-4 border-red-300 dark:border-red-900">
        <h2 className="section-heading">Delete account</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This permanently deletes your account and every answer you&apos;ve saved, including your
          progress, trouble words, your Customized Learning documents and focus list. It can&apos;t be undone.
        </p>
        <DeleteAccountForm confirmWord={CONFIRM_WORD} />
      </section>
    </div>
  );
}
