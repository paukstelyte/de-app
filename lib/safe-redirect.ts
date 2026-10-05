// Only let a `next=` parameter send the user somewhere inside this app.
// Checking `raw.startsWith("/")` is NOT enough: browsers resolve both
// "//evil.com" and "/\evil.com" to another host entirely, and both of those
// start with a slash. Resolving against a fixed origin and comparing catches
// those; the extra `//` check catches paths like "/.//evil.com", which keep our
// origin but normalise to a protocol-relative "//evil.com" pathname.
const BASE = "http://internal.invalid";

export function safeRedirectPath(raw: string | null | undefined, fallback = "/articles") {
  if (!raw) return fallback;
  try {
    const url = new URL(raw, BASE);
    if (url.origin !== BASE || url.pathname.startsWith("//")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
