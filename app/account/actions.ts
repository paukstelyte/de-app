"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CONFIRM_WORD } from "@/lib/account";

/** Permanently deletes the logged-in user. Their attempts go with them
 * (attempts.user_id → auth.users is `on delete cascade`). */
export async function deleteAccount(_prev: string | null, formData: FormData) {
  if (formData.get("confirm") !== CONFIRM_WORD) return `Type ${CONFIRM_WORD} to confirm.`;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login?next=/account");

  // Deleting a user needs the admin (secret) key, so it only ever runs here.
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("deleteAccount failed:", error.message);
    return "Something went wrong — your account was not deleted. Please try again.";
  }

  await supabase.auth.signOut(); // clears the now-orphaned session cookies
  redirect("/?account=deleted");
}
