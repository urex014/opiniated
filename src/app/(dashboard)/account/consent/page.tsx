import type { Metadata } from "next";
import Link from "next/link";
import { RenewConsentForm } from "@/components/forms/consent-form";
import { requireUser } from "@/lib/auth/current-user";
import { safeReturnPath } from "@/lib/auth/return-path";
import { prisma } from "@/lib/db";
import { outstandingDocuments } from "@/lib/legal/consent";
import { POLICY_LABELS, POLICY_VERSIONS } from "@/lib/legal/versions";

export const metadata: Metadata = { title: "Accept updated policies" };
export const instant = false;

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await requireUser();
  const nextPath = safeReturnPath((await searchParams).next);
  const records = await prisma.consentRecord.findMany({
    where: { userId: user.id },
    select: { document: true, version: true, acceptedAt: true },
  });
  const needed = outstandingDocuments(records);

  return (
    <>
      <h1 className="page-title">Privacy and terms</h1>
      {needed.length === 0 ? (
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          You have accepted Privacy Policy {POLICY_VERSIONS.privacy} and Terms of Service {POLICY_VERSIONS.terms}. A
          new acceptance is requested only when a published version changes.
        </p>
      ) : (
        <>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Accept the current {needed.map((document) => POLICY_LABELS[document]).join(" and ")} before starting a
            survey. This acceptance is stored as a renewal. It does not change the record from registration.
          </p>
          <div className="mt-5 max-w-lg rounded-lg border border-line bg-white p-4">
            <RenewConsentForm documents={needed} nextPath={nextPath} />
          </div>
        </>
      )}
      <p className="mt-4 text-sm">
        <Link href="/account" className="text-brand">
          Back to account
        </Link>
      </p>
    </>
  );
}
