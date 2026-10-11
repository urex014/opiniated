import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { outstandingDocuments } from "@/lib/legal/consent";

export async function requireCurrentConsent(userId: string, nextPath: string): Promise<void> {
  const records = await prisma.consentRecord.findMany({
    where: { userId },
    select: { document: true, version: true, acceptedAt: true },
  });
  if (outstandingDocuments(records).length > 0) {
    redirect(`/account/consent?next=${encodeURIComponent(nextPath)}`);
  }
}
