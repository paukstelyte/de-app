"use client";

import { LoadError } from "@/components/LoadError";

/** Any page whose data couldn't be read (e.g. the database didn't answer) shows this instead of a blank screen. */
export default function PageError({ reset }: { error: Error; reset: () => void }) {
  return <LoadError what="this page" onRetry={reset} />;
}
