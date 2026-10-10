import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";

// Where Google sign-in lands (sign-up and password-reset emails go to
// /auth/confirm instead). Exchanges the auth code Supabase appended to the URL
// for a session, then sends the user on to `next` (default: /learning).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // Always the request's own origin: trusting x-forwarded-host would let a
    // proxy that passes the header through redirect users off-site.
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(
    `${origin}/auth/error?error=callback_failed`,
  );
}
