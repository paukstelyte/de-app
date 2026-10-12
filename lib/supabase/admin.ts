import "server-only"; // holds the secret key; the build fails if browser code imports this
import { createClient } from "@supabase/supabase-js";

/** The admin (secret-key) client, or null when the key isn't set. It skips row-level
 * security, so every query through it must be pinned to the user id from getClaims(). */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) {
    console.error("SUPABASE_SECRET_KEY is not set");
    return null;
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
