import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUser } from "@/lib/auth/current-user";

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/surveys/load", () => ({
  loadSurveysForUser: vi.fn(),
}));

describe("survey API authentication", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockReset();
  });

  it("rejects an anonymous survey list", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import("@/app/api/surveys/route");
    const response = await GET();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("rejects an anonymous survey start", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { POST } = await import("@/app/api/surveys/start/route");
    const response = await POST(new Request("http://localhost:3000/api/surveys/start", { method: "POST" }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?next=%2Fsurveys");
  });

  it("rejects an anonymous reward read", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import("@/app/api/rewards/route");
    const response = await GET();
    expect(response.status).toBe(401);
  });
});
