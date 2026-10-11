import { POLICY_DOCUMENTS, POLICY_VERSIONS, type ConsentAction, type PolicyDocument } from "@/lib/legal/versions";

export type StoredConsent = {
  document: string;
  version: string;
  action?: string;
  acceptedAt: Date;
};

export function outstandingDocuments(records: StoredConsent[]): PolicyDocument[] {
  return POLICY_DOCUMENTS.filter((document) => {
    const latest = records
      .filter((record) => record.document === document)
      .sort((left, right) => right.acceptedAt.getTime() - left.acceptedAt.getTime())[0];
    return !latest || latest.version !== POLICY_VERSIONS[document];
  });
}

export function consentMetadata(ip: string | null, userAgent: string | null): { ip: string | null; userAgent: string | null } {
  const cleanIp = ip && /^[0-9a-fA-F:.]+$/.test(ip) && ip.length <= 64 ? ip : null;
  const agent = userAgent?.replace(/[\r\n]/g, " ").trim().slice(0, 160);
  return { ip: cleanIp, userAgent: agent ? agent : null };
}

export function consentWrites(input: {
  userId: string;
  documents: PolicyDocument[];
  action: ConsentAction;
  acceptedAt: Date;
  ip: string | null;
  userAgent: string | null;
}) {
  const metadata = consentMetadata(input.ip, input.userAgent);
  return input.documents.map((document) => ({
    userId: input.userId,
    document,
    version: POLICY_VERSIONS[document],
    action: input.action,
    acceptedAt: input.acceptedAt,
    ip: metadata.ip,
    userAgent: metadata.userAgent,
  }));
}
