import { updateSession } from "@/lib/supabase/proxy";
import { type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match every request path except Next's own build output and the favicon.
     * Exclusions are named files rather than an image-extension wildcard, so a
     * route like /progress/x.svg can never skip the session check.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
