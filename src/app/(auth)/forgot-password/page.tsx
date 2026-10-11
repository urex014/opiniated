import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-[28px] font-medium">Reset your password</h1>
      <p className="mt-2 text-sm text-muted">
        If email delivery is configured, we send a reset link. The response is the same whether or not the email is registered.
      </p>
      <div className="mt-6 border border-line bg-white p-4">
        <ForgotForm />
      </div>
      <p className="mt-4 text-sm">
        <Link href="/login" className="text-brand">
          Back to log in
        </Link>
      </p>
    </>
  );
}
