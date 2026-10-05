// Only let a `next=` parameter send the user somewhere inside this app.
// Checking `raw.startsWith("/")` is NOT enough: browsers resolve both
// "//evil.com" and "/\evil.com" to another host entirely, and both of those
// start with a slash. Resolving against a fixed origin and comparing is the
// only check that catches every variant.
const BASE = "http://internal.invalid";

export function safeRedirectPath(raw: string | null | undefined, fallback = "/articles") {
  if (!raw) return fallback;
  try {
    const url = new URL(raw, BASE);
    if (url.origin !== BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
