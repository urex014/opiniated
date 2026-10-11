import { describe, expect, it, vi } from "vitest";
import { ResendDeliveryError, sendResendEmail } from "@/lib/email/resend";

const message = {
  apiKey: "re_test_secret",
  from: "Opiniated <hello@example.com>",
  to: "person@example.com",
  subject: "Reset your Opiniated password",
  text: "Use this link.\n\nhttps://example.com/reset-password?token=abc",
};

describe("Resend delivery", () => {
  it("posts the message to Resend with the server key", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "email_1" }), { status: 200 }));
    await sendResendEmail({ ...message, fetchImpl });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer re_test_secret");
    expect(JSON.parse(String(init.body))).toEqual({
      from: message.from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
    });
  });

  it("rejects a provider error without revealing the API key", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ message: "invalid" }), { status: 422 }));
    await expect(sendResendEmail({ ...message, fetchImpl })).rejects.toThrow(ResendDeliveryError);
    await expect(sendResendEmail({ ...message, fetchImpl })).rejects.toThrow("Resend rejected the message (422).");
    await expect(sendResendEmail({ ...message, fetchImpl })).rejects.not.toThrow(/re_test_secret/);
  });

  it("rejects a network failure without treating it as sent", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("socket hang up");
    });
    await expect(sendResendEmail({ ...message, fetchImpl })).rejects.toThrow("Resend could not be reached.");
  });
});
