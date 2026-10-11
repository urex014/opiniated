import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

describe("public legal pages", () => {
  it("does not require a session for privacy, terms, or contact", () => {
    for (const path of ["/privacy", "/terms", "/contact"]) {
      const response = proxy(new NextRequest(new URL(path, "http://localhost:3000")));
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("sends an anonymous survey visitor to sign in and back", () => {
    const response = proxy(new NextRequest(new URL("/surveys/survey-1", "http://localhost:3000")));
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain("next=%2Fsurveys%2Fsurvey-1");
  });
});
