import type { Metadata } from "next";
import Link from "next/link";
import { DeleteAccountForm, PasswordForm, ProfileForm, VerificationForm } from "@/components/forms/account-forms";
import { logoutAction } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { outstandingDocuments } from "@/lib/legal/consent";
import { POLICY_LABELS, POLICY_VERSIONS, type PolicyDocument } from "@/lib/legal/versions";
import { readEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Account" };
export const instant = false;

export default async function AccountPage() {
  const user = await requireUser();
  const env = readEnv();
  const consents = await prisma.consentRecord.findMany({
    where: { userId: user.id },
    orderBy: { acceptedAt: "desc" },
    select: { document: true, version: true, action: true, acceptedAt: true },
  });
  const outstanding = outstandingDocuments(consents);
  const created = new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(user.createdAt);

  return (
    <>
      <h1 className="page-title">Account</h1>
      <dl className="mt-5 grid gap-3 rounded-lg border border-line bg-white p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted">Email</dt>
          <dd className="mt-1">{user.email}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Account created</dt>
          <dd className="mt-1">{created}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Email verification</dt>
          <dd className="mt-1">
            {user.emailVerifiedAt
              ? `Verified ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(user.emailVerifiedAt)}`
              : env.email
                ? "Not verified"
                : "Not verified. Email delivery is not configured, so a verification message cannot be sent."}
          </dd>
        </div>
      </dl>

      {!user.emailVerifiedAt && env.email ? (
        <section className="mt-8">
          <h2 className="section-title">Verify email</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Verification is an extra check on the address you registered. Survey access does not wait for it.
          </p>
          <div className="mt-3">
            <VerificationForm />
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="section-title">Privacy and terms</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Current versions are Privacy Policy {POLICY_VERSIONS.privacy} and Terms of Service {POLICY_VERSIONS.terms}.
          Registration acceptance stays on its own row. A later acceptance is stored as a renewal.
        </p>
        <ul className="mt-3 grid gap-2 text-sm">
          {(["privacy", "terms"] as PolicyDocument[]).map((document) => {
            const latest = consents.find((record) => record.document === document);
            return (
              <li key={document} className="rounded-md border border-line bg-white px-3 py-2">
                <span className="font-medium">{POLICY_LABELS[document]}</span>
                {latest ? (
                  <span className="text-muted">
                    {" "}
                    · version {latest.version} · {latest.action} ·{" "}
                    {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(latest.acceptedAt)}
                  </span>
                ) : (
                  <span className="text-muted"> · not accepted yet</span>
                )}
              </li>
            );
          })}
        </ul>
        {outstanding.length > 0 ? (
          <p className="mt-3 text-sm">
            <Link href="/account/consent" className="text-brand">
              Review and accept the current {outstanding.map((document) => POLICY_LABELS[document]).join(" and ")}
            </Link>
          </p>
        ) : null}
        <p className="mt-3 text-sm">
          <a className="text-brand" href="/api/privacy/export">
            Download account data
          </a>
        </p>
      </section>

      <section className="mt-8">
        <h2 className="section-title">Name</h2>
        <div className="mt-3">
          <ProfileForm name={user.name ?? ""} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="section-title">Password</h2>
        <div className="mt-3">
          <PasswordForm />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="section-title">Delete account</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Deletion removes your email, name, and password and signs you out. Reward history, survey activity, and
          consent records stay on an anonymized id so a reversal can still be applied. This cannot be undone from the
          site.
        </p>
        <div className="mt-3">
          <DeleteAccountForm />
        </div>
      </section>

      <section className="mt-8 border-t border-line pt-6 text-sm">
        <form action={logoutAction}>
          <button type="submit" className="btn btn-secondary">
            Log out
          </button>
        </form>
        <p className="mt-4 text-muted">
          <Link href="/privacy" className="text-brand">Privacy</Link>
          {" · "}
          <Link href="/terms" className="text-brand">Terms</Link>
          {" · "}
          <Link href="/contact" className="text-brand">Contact</Link>
        </p>
      </section>
    </>
  );
}
