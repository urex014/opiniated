export const POLICY_DOCUMENTS = ["privacy", "terms"] as const;

export type PolicyDocument = (typeof POLICY_DOCUMENTS)[number];

export type ConsentAction = "registration" | "renewal";

/** Immutable document versions. Publish a new identifier when the text materially changes. */
export const POLICY_VERSIONS: Record<PolicyDocument, string> = {
  privacy: "2026-10-12.2",
  terms: "2026-10-12.2",
};

export const POLICY_LABELS: Record<PolicyDocument, string> = {
  privacy: "Privacy Policy",
  terms: "Terms of Service",
};
