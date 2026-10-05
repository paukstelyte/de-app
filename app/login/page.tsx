import { LoginForm } from "@/components/auth-forms";
import { safeRedirectPath } from "@/lib/safe-redirect";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return <LoginForm next={safeRedirectPath(typeof next === "string" ? next : null)} />;
}
