import type { Metadata } from "next";
import Link from "next/link";
import { VerifyEmailForm } from "@/app/(auth)/verify-email/verify-form";

export const metadata: Metadata = { title: "Verify email" };
export const instant = false;

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = (await searchParams).token ?? "";

  return (
    <>
      <h1 className="page-title">Email verification</h1>
      {token ? (
        <>
          <p className="mt-3 text-sm leading-6 text-muted">Confirm this address for your Opiniated account.</p>
          <VerifyEmailForm token={token} />
        </>
      ) : (
        <p className="mt-3 text-sm leading-6 text-muted">This verification link is missing a token.</p>
      )}
      <p className="mt-4 text-sm">
        <Link href="/account" className="text-brand">
          Go to account
        </Link>
      </p>
    </>
  );
}
