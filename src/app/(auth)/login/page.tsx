import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-[28px] font-medium">Log in</h1>
      <p className="mt-2 text-sm text-muted">Use the email and password for your Opiniated account.</p>
      <div className="mt-6 border border-line bg-white p-4">
        <LoginForm />
      </div>
      <p className="mt-4 text-sm">
        <Link href="/forgot-password" className="text-brand">
          Forgot password
        </Link>
      </p>
      <p className="mt-2 text-sm text-muted">
        New here?{" "}
        <Link href="/register" className="text-brand">
          Create an account
        </Link>
      </p>
    </>
  );
}
