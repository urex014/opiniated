import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPaystackClient, type PaystackFetch } from "@/lib/paystack/client";
import { verifyPaystackSignature } from "@/lib/paystack/signature";

const secret = "sk_test_example";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("Paystack signature", () => {
  it("accepts the HMAC SHA512 hex of the raw body and rejects a different body", () => {
    const raw = '{"event":"transfer.success","data":{"reference":"wd_aaaaaaaaaaaaaaaaaaaaaaaa_1"}}';
    const signature = createHmac("sha512", secret).update(raw, "utf8").digest("hex");
    expect(verifyPaystackSignature(raw, signature, secret)).toBe(true);
    expect(verifyPaystackSignature(`${raw} `, signature, secret)).toBe(false);
    expect(verifyPaystackSignature(raw, `${signature.slice(0, -1)}0`, secret)).toBe(false);
    expect(verifyPaystackSignature(raw, "zz", secret)).toBe(false);
    expect(verifyPaystackSignature(raw, null, secret)).toBe(false);
  });
});

describe("Paystack client", () => {
  it("lists Nigerian nuban banks, resolves an account, and creates a nuban recipient", async () => {
    const calls: { url: string; body: string | undefined }[] = [];
    const fetchImpl: PaystackFetch = async (url, init) => {
      calls.push({ url, body: typeof init.body === "string" ? init.body : undefined });
      if (url.includes("/bank?")) {
        return jsonResponse({
          status: true,
          data: [
            { name: "Guaranty Trust Bank", code: "058", currency: "NGN", type: "nuban", active: true },
            { name: "Skip", code: "999", currency: "USD", type: "nuban", active: true },
            { name: "Inactive", code: "001", currency: "NGN", type: "nuban", active: false },
          ],
        });
      }
      if (url.includes("/bank/resolve")) {
        return jsonResponse({ status: true, message: "Account number resolved", data: { account_number: "0123456789", account_name: "ADA LOVELACE" } });
      }
      return jsonResponse({ status: true, data: { recipient_code: "RCP_example" } });
    };
    const client = createPaystackClient({ secretKey: secret, baseUrl: "https://api.paystack.co", fetchImpl });
    const banks = await client.listBanks();
    expect(banks).toEqual({ ok: true, banks: [{ name: "Guaranty Trust Bank", code: "058" }] });
    const resolved = await client.resolveAccount("0123456789", "058");
    expect(resolved).toEqual({ ok: true, accountNumber: "0123456789", accountName: "ADA LOVELACE" });
    const recipient = await client.createRecipient({ name: "ADA LOVELACE", accountNumber: "0123456789", bankCode: "058" });
    expect(recipient).toEqual({ ok: true, recipientCode: "RCP_example" });
    expect(JSON.parse(calls[2]?.body ?? "")).toEqual({
      type: "nuban",
      name: "ADA LOVELACE",
      account_number: "0123456789",
      bank_code: "058",
      currency: "NGN",
    });
    expect(calls[0]?.url).toContain("currency=NGN");
  });

  it("sends the documented bulk transfer body and does not treat the queue response as final", async () => {
    let body = "";
    const fetchImpl: PaystackFetch = async (_url, init) => {
      body = typeof init.body === "string" ? init.body : "";
      return jsonResponse({
        status: true,
        message: "1 transfer queued.",
        data: [{ reference: "wd_aaaaaaaaaaaaaaaaaaaaaaaa_1", recipient: "RCP_example", amount: 10000, transfer_code: "TRF_example", currency: "NGN", status: "success" }],
      });
    };
    const client = createPaystackClient({ secretKey: secret, baseUrl: "https://api.paystack.co", fetchImpl });
    const result = await client.bulkTransfer([
      { amount: 10000, reference: "wd_aaaaaaaaaaaaaaaaaaaaaaaa_1", reason: "Opiniated withdrawal", recipient: "RCP_example" },
    ]);
    expect(JSON.parse(body)).toEqual({
      currency: "NGN",
      source: "balance",
      transfers: [{ amount: 10000, reference: "wd_aaaaaaaaaaaaaaaaaaaaaaaa_1", reason: "Opiniated withdrawal", recipient: "RCP_example" }],
    });
    expect(result.outcome).toBe("accepted");
    if (result.outcome === "accepted") expect(result.items[0]?.status).toBe("success");
  });

  it("classifies timeouts, rejection, balance, and a missing transfer", async () => {
    const fetchImpl: PaystackFetch = async (url) => {
      if (url.endsWith("/transfer/bulk")) throw new Error("timed out");
      if (url.endsWith("/balance")) return jsonResponse({ status: true, data: [{ currency: "NGN", balance: 250000 }] });
      return jsonResponse({ status: false, message: "Transfer not found" }, 404);
    };
    const client = createPaystackClient({ secretKey: secret, baseUrl: "https://api.paystack.co", fetchImpl });
    expect((await client.bulkTransfer([])).outcome).toBe("uncertain");
    expect(await client.getBalance()).toEqual({ ok: true, balances: [{ currency: "NGN", amount: 250000 }] });
    expect(await client.verifyTransfer("wd_aaaaaaaaaaaaaaaaaaaaaaaa_1")).toEqual({ outcome: "not_found" });
  });
});
