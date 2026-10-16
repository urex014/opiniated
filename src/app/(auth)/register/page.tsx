import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/forms/auth-forms";
import { safeReturnPath } from "@/lib/auth/return-path";
import { readEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Sign up" };
export const instant = false;

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; ref?: string }>;
}) {
  const resolved = await searchParams;
  const nextPath = safeReturnPath(resolved.next);
  const refCode = resolved.ref ?? "";
  return (
    <>
      <h1 className="page-title">Create your account</h1>
      <p className="mt-2 text-sm leading-6 text-muted">You need an account before surveys and rewards can be matched to you.</p>
      <div className="auth-card">
        <RegisterForm
          siteKey={readEnv().turnstileSiteKey}
          nextPath={nextPath === "/dashboard" ? "" : nextPath}
          refCode={refCode}
        />
      </div>
      <p className="mt-4 text-sm text-muted">
        Already registered?{" "}
        <Link href="/login" className="text-brand">
          Log in
        </Link>
      </p>
    </>
  );
}
