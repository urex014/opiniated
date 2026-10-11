import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/forms/auth-forms";
import { safeReturnPath } from "@/lib/auth/return-path";

export const metadata: Metadata = { title: "Log in" };
export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const requested = (await searchParams).next;
  const nextPath = requested ? safeReturnPath(requested) : "";
  const registerHref = nextPath ? `/register?next=${encodeURIComponent(nextPath)}` : "/register";
  return (
    <>
      <h1 className="page-title">Log in</h1>
      <p className="mt-2 text-sm leading-6 text-muted">Use the email and password for your Opiniated account.</p>
      <div className="auth-card">
        <LoginForm nextPath={nextPath} />
      </div>
      <p className="mt-4 text-sm">
        <Link href="/forgot-password" className="text-brand">
          Forgot password
        </Link>
      </p>
      <p className="mt-2 text-sm text-muted">
        New here?{" "}
        <Link href={registerHref} className="text-brand">
          Create an account
        </Link>
      </p>
    </>
  );
}
