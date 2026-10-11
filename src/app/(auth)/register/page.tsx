import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = { title: "Sign up" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-[28px] font-medium">Create your account</h1>
      <p className="mt-2 text-sm text-muted">You need an account before surveys and rewards can be matched to you.</p>
      <div className="mt-6 border border-line bg-white p-4">
        <RegisterForm />
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
