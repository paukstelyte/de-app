"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CONFIRM_WORD } from "@/lib/account";
import { BUCKET } from "@/lib/learning/uploads";
import { listUserUploads } from "@/lib/learning/storage";

/** Permanently deletes the logged-in user. Their attempts and learning rows go with
 * them (`on delete cascade` on user_id → auth.users). Files in the `learning-uploads`
 * bucket have no foreign key, so they are removed here first (best-effort). */
export async function deleteAccount(_prev: string | null, formData: FormData) {
  if (formData.get("confirm") !== CONFIRM_WORD) return `Type ${CONFIRM_WORD} to confirm.`;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login?next=/account");

  // Deleting a user needs the admin (secret) key, so it only ever runs here.
  if (!process.env.SUPABASE_SECRET_KEY) {
    console.error("deleteAccount: SUPABASE_SECRET_KEY is not set");
    return "Account deletion isn't available right now. Please try again later.";
  }
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  try {
    const storage = admin.storage.from(BUCKET);
    const files = await listUserUploads(storage, userId);
    if (files.length) {
      const { error: rmError } = await storage.remove(files);
      if (rmError) console.error("deleteAccount: upload cleanup failed:", rmError.message);
    }
  } catch (e) {
    console.error("deleteAccount: upload cleanup failed:", e instanceof Error ? e.message : "unknown");
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("deleteAccount failed:", error.message);
    return "Something went wrong — your account was not deleted. Please try again.";
  }

  await supabase.auth.signOut(); // clears the now-orphaned session cookies
  redirect("/?account=deleted");
}
