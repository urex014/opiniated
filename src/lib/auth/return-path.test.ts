import { describe, expect, it } from "vitest";
import { safeReturnPath } from "@/lib/auth/return-path";

describe("return path", () => {
  it("keeps account paths and drops external targets", () => {
    expect(safeReturnPath("/surveys/abc")).toBe("/surveys/abc");
    expect(safeReturnPath("/account/consent?next=%2Fsurveys")).toBe("/account/consent?next=%2Fsurveys");
    expect(safeReturnPath("https://evil.example/surveys")).toBe("/dashboard");
    expect(safeReturnPath("//evil.example")).toBe("/dashboard");
    expect(safeReturnPath("/login")).toBe("/dashboard");
  });
});
