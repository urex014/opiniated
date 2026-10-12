import { prisma } from "@/lib/db";
import { bankFingerprint, fingerprint, normalizeEmail } from "@/lib/risk/fingerprint";

export async function rememberEmail(userId: string, email: string, key: string | null): Promise<boolean> {
  const digest = digestFor(normalizeEmail(email), key);
  if (!digest) return false;
  await prisma.identityDigest.upsert({
    where: { userId_kind: { userId, kind: "email" } },
    create: { userId, kind: "email", digest },
    update: { digest },
  });
  const others = await prisma.identityDigest.count({ where: { kind: "email", digest, NOT: { userId } } });
  return others > 0;
}

export async function rememberBank(
  userId: string,
  account: { bankCode: string; accountLast4: string; accountName: string },
  key: string | null,
): Promise<boolean> {
  const digest = digestFor(bankFingerprint(account), key);
  if (!digest) return false;
  await prisma.identityDigest.upsert({
    where: { userId_kind: { userId, kind: "bank" } },
    create: { userId, kind: "bank", digest },
    update: { digest },
  });
  const others = await prisma.identityDigest.count({ where: { kind: "bank", digest, NOT: { userId } } });
  return others > 0;
}

export function emailSubject(email: string, key: string | null): string | null {
  return digestFor(normalizeEmail(email), key);
}

function digestFor(value: string, key: string | null): string | null {
  if (!key || key.length < 32) return null;
  return fingerprint(value, key);
}
