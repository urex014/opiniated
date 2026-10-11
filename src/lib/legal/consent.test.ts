import { describe, expect, it } from "vitest";
import { consentMetadata, consentWrites, outstandingDocuments } from "@/lib/legal/consent";
import { POLICY_VERSIONS } from "@/lib/legal/versions";

const at = new Date("2026-10-11T12:00:00.000Z");

describe("policy consent", () => {
  it("requires both current versions before survey participation", () => {
    expect(outstandingDocuments([])).toEqual(["privacy", "terms"]);
    const current = consentWrites({
      userId: "user-1",
      documents: ["privacy", "terms"],
      action: "registration",
      acceptedAt: at,
      ip: "203.0.113.10",
      userAgent: "Test",
    });
    expect(outstandingDocuments(current)).toEqual([]);
    expect(current.map((row) => row.version)).toEqual([POLICY_VERSIONS.privacy, POLICY_VERSIONS.terms]);
    expect(current.every((row) => row.action === "registration")).toBe(true);
  });

  it("records a renewal separately and leaves the registration row unchanged", () => {
    const registration = consentWrites({
      userId: "user-1",
      documents: ["privacy", "terms"],
      action: "registration",
      acceptedAt: at,
      ip: null,
      userAgent: null,
    });
    const stale = registration.map((row) => (row.document === "privacy" ? { ...row, version: "2020-01-01" } : row));
    expect(outstandingDocuments(stale)).toEqual(["privacy"]);
    const renewal = consentWrites({
      userId: "user-1",
      documents: ["privacy"],
      action: "renewal",
      acceptedAt: new Date("2026-10-12T12:00:00.000Z"),
      ip: "203.0.113.10",
      userAgent: "A".repeat(400),
    });
    expect(renewal).toHaveLength(1);
    expect(renewal[0]?.action).toBe("renewal");
    expect(renewal[0]?.version).toBe(POLICY_VERSIONS.privacy);
    expect(registration[0]?.action).toBe("registration");
    expect(outstandingDocuments([...stale, ...renewal])).toEqual([]);
    expect(renewal[0]?.userAgent?.length).toBe(160);
  });

  it("drops a user agent or address that is not safe to store", () => {
    expect(consentMetadata("not an ip\n", "line\nbreak")).toEqual({
      ip: null,
      userAgent: "line break",
    });
  });
});
