import Link from "next/link";
import { AuthCard } from "@/components/auth-forms";

// Only fixed messages are shown: echoing the query string would let anyone
// craft a link that displays their own text on this domain.
const MESSAGES = new Map([
  ["link_invalid", "This link is invalid or has expired. Please request a new one."],
  [
    "callback_failed",
    "That link didn't sign you in. It may have expired, or been opened in a different browser from the one you signed up in. If you were confirming your email, it's probably confirmed already, so try logging in.",
  ],
]);

export default async function AuthErrorPage({ searchParams }: PageProps<"/auth/error">) {
  const { error } = await searchParams;
  return (
    <AuthCard
      title="Something went wrong"
      description={MESSAGES.get(String(error)) ?? "An unspecified error occurred."}
    >
      <Link href="/login" className="text-sm underline underline-offset-4">
        Back to log in
      </Link>
    </AuthCard>
  );
}
