"use client";

import { useEffect } from "react";
import { LoadError } from "@/components/LoadError";

/** Any page whose data couldn't be read (e.g. the database didn't answer) shows this instead of a blank screen. */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error("page error", error.digest ?? error.message), [error]);
  return <LoadError what="this page" onRetry={reset} />;
}
