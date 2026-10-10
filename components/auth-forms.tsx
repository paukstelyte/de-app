"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { GoogleIcon } from "@/components/google-icon";

const inputClass =
  "w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:focus:border-zinc-100";
const primaryButton =
  "w-full rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";
const secondaryButton =
  "flex w-full items-center justify-center gap-2 rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";
const linkClass = "underline underline-offset-4";
// Matches the server rule (supabase/config.toml: 8+ characters, letters and digits).
const PASSWORD_RULE = "At least 8 characters, including a letter and a number.";
const NEW_PASSWORD = {
  required: true,
  minLength: 8,
  pattern: "(?=.*[A-Za-z])(?=.*\\d).{8,}",
  title: PASSWORD_RULE,
  autoComplete: "new-password",
  hint: PASSWORD_RULE,
};

export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-sm border border-[var(--line)] bg-[var(--paper)] p-6 shadow-[8px_8px_0_var(--accent)] sm:p-8">
      <h1 className="text-2xl font-bold tracking-[-0.04em]">{title}</h1>
      {description && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
      )}
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}

function Field({ label, hint, ...input }: { label: string; hint?: string } & ComponentProps<"input">) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <input className={inputClass} {...input} />
      {hint && <span className="text-xs font-normal text-zinc-500">{hint}</span>}
    </label>
  );
}

function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {error}
    </p>
  ) : null;
}

// Supabase's wording for the common cases is technical; everything else is shown as-is.
const FRIENDLY_ERRORS: Record<string, string> = {
  "Invalid login credentials": "Wrong email or password.",
  "Email not confirmed": "Please confirm your email first. Check your inbox for the link.",
  "User already registered": "An account with this email already exists. Try logging in.",
};

/** Runs a Supabase auth call with shared loading/error state. */
function useAuthAction() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  async function run(action: () => Promise<{ error: Error | null }>, onSuccess?: () => void) {
    setIsLoading(true);
    setError(null);
    const { error } = await action();
    setIsLoading(false);
    if (error) setError(FRIENDLY_ERRORS[error.message] ?? error.message);
    else onSuccess?.();
  }
  return { error, setError, isLoading, run };
}

/** Google creates the account on first use, so this one button serves both
 * log in and sign up. */
function GoogleButton({ next, onError }: { next: string; onError: (message: string) => void }) {
  async function handleGoogle() {
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    // On success the browser is already on its way to Google.
    if (error) onError(error.message);
  }
  return (
    <button type="button" onClick={handleGoogle} className={secondaryButton}>
      <GoogleIcon className="size-4" />
      Continue with Google
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { error, setError, isLoading, run } = useAuthAction();

  function handleLogin(e: FormEvent) {
    e.preventDefault();
    run(
      () => createClient().auth.signInWithPassword({ email, password }),
      // A full page load, not router.push: the client router may still hold a
      // "redirect to /login" it prefetched for this page while logged out (e.g.
      // a nav link to a protected page), which would bounce the user straight back.
      // `next` is already limited to this site by safeRedirectPath.
      () => window.location.assign(next),
    );
  }

  return (
    <AuthCard title="Log in" description="Log in to save your answers and practise your own mistakes.">
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <Field label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Link href="/auth/forgot-password" className={`-mt-2 self-end text-xs ${linkClass}`}>
          Forgot your password?
        </Link>
        <ErrorText error={error} />
        <button type="submit" disabled={isLoading} className={primaryButton}>
          {isLoading ? "Logging in…" : "Log in"}
        </button>
        <GoogleButton next={next} onError={setError} />
      </form>
      <p className="mt-6 text-center text-sm">
        No account yet?{" "}
        <Link href="/auth/sign-up" className={linkClass}>
          Sign up
        </Link>
      </p>
    </AuthCard>
  );
}

export function SignUpForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const { error, setError, isLoading, run } = useAuthAction();

  function handleSignUp(e: FormEvent) {
    e.preventDefault();
    if (password !== repeat) return setError("Passwords do not match.");
    run(
      () =>
        createClient().auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/confirm` }, // see supabase/templates
        }),
      () => router.push("/auth/sign-up-success"),
    );
  }

  return (
    <AuthCard title="Sign up" description="Track your progress and practise the words you get wrong.">
      <form onSubmit={handleSignUp} className="flex flex-col gap-4">
        <Field label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" {...NEW_PASSWORD} value={password} onChange={(e) => setPassword(e.target.value)} />
        <Field label="Repeat password" type="password" required autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        <ErrorText error={error} />
        <button type="submit" disabled={isLoading} className={primaryButton}>
          {isLoading ? "Creating account…" : "Sign up"}
        </button>
        <GoogleButton next="/learning" onError={setError} />
      </form>
      <p className="mt-4 text-center text-xs text-zinc-500">
        See what we store and how to delete it:{" "}
        <Link href="/privacy" className={linkClass}>
          Privacy
        </Link>
      </p>
      <p className="mt-6 text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className={linkClass}>
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { error, isLoading, run } = useAuthAction();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    run(
      () =>
        createClient().auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/confirm`, // see supabase/templates
        }),
      () => setSent(true),
    );
  }

  if (sent) {
    return (
      <AuthCard
        title="Check your email"
        description="If an account with a password exists for that address, we've sent a link to reset it."
      />
    );
  }

  return (
    <AuthCard title="Reset your password" description="Enter your email and we'll send you a reset link.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <ErrorText error={error} />
        <button type="submit" disabled={isLoading} className={primaryButton}>
          {isLoading ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className={linkClass}>
          Back to log in
        </Link>
      </p>
    </AuthCard>
  );
}

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const { error, isLoading, run } = useAuthAction();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    run(
      () => createClient().auth.updateUser({ password }),
      () => router.push("/learning"),
    );
  }

  return (
    <AuthCard title="Choose a new password">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="New password" type="password" {...NEW_PASSWORD} value={password} onChange={(e) => setPassword(e.target.value)} />
        <ErrorText error={error} />
        <button type="submit" disabled={isLoading} className={primaryButton}>
          {isLoading ? "Saving…" : "Save new password"}
        </button>
      </form>
    </AuthCard>
  );
}

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await createClient().auth.signOut();
        // Full page load (deliberately not router.push) so no page cached while
        // logged in is shown afterwards.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/");
      }}
      className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
    >
      Log out
    </button>
  );
}
