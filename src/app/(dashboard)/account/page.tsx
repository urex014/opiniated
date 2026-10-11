import type { Metadata } from "next";
import Link from "next/link";
import { PasswordForm, ProfileForm } from "@/components/forms/account-forms";
import { logoutAction } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Account" };
export const instant = false;

export default async function AccountPage() {
  const user = await requireUser();
  const created = new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(user.createdAt);

  return (
    <>
      <h1 className="text-[28px] font-medium">Account</h1>
      <dl className="mt-5 grid gap-3 border border-line bg-white p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted">Email</dt>
          <dd className="mt-1">{user.email}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Account created</dt>
          <dd className="mt-1">{created}</dd>
        </div>
      </dl>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Name</h2>
        <div className="mt-3">
          <ProfileForm name={user.name ?? ""} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Password</h2>
        <div className="mt-3">
          <PasswordForm />
        </div>
      </section>

      <section className="mt-8 border-t border-line pt-6 text-sm">
        <form action={logoutAction}>
          <button type="submit" className="inline-flex h-10 items-center rounded-md border border-line px-3 font-medium">
            Log out
          </button>
        </form>
        <p className="mt-4 text-muted">
          <Link href="/privacy" className="text-brand">Privacy</Link>
          {" · "}
          <Link href="/help" className="text-brand">Help</Link>
        </p>
      </section>
    </>
  );
}
