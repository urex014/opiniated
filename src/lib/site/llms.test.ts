import { describe, expect, it } from "vitest";
import { GET } from "@/app/llms.txt/route";
import { llmsPages, llmsTxt, pageUrl } from "@/lib/site/llms";

const excluded = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/dashboard", "/surveys", "/rewards", "/payouts", "/activity", "/account", "/admin", "/api/"];

describe("llms.txt", () => {
  it("maps only the public pages in the llms.txt link shape", () => {
    const body = llmsTxt();
    expect(body.startsWith("# Opiniated\n")).toBe(true);
    expect(body).toContain("> Share your views through online surveys and earn rewards for the time you spend participating.");

    const links = [...body.matchAll(/^- \[(.+?)\]\((https:\/\/[^)]+)\): (.+)$/gm)];
    expect(links.map((match) => match[2])).toEqual(llmsPages().map((page) => pageUrl(page.path)));
    for (const match of links) {
      expect(match[2].startsWith("https://opiniated.vercel.app")).toBe(true);
      expect(match[3].endsWith(".")).toBe(true);
    }
    for (const path of excluded) {
      expect(body.includes(path)).toBe(false);
    }
  });

  it("answers as plain text", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toBe(llmsTxt());
  });
});
