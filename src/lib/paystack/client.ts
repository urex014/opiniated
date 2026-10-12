export type PaystackFetch = (url: string, init: RequestInit) => Promise<Response>;

export type PaystackBank = { name: string; code: string };

export type ResolveResult = { ok: true; accountNumber: string; accountName: string } | { ok: false; message: string };

export type RecipientResult = { ok: true; recipientCode: string } | { ok: false; message: string };

export type BulkTransfer = { amount: number; reference: string; reason: string; recipient: string };

export type BulkItem = {
  reference: string;
  recipient: string;
  amount: number;
  transferCode: string | null;
  status: string | null;
};

export type BulkResult =
  | { outcome: "accepted"; message: string; items: BulkItem[] }
  | { outcome: "rejected"; message: string }
  | { outcome: "uncertain"; message: string };

export type VerifiedTransfer =
  | { outcome: "unavailable"; message: string }
  | { outcome: "not_found" }
  | {
      outcome: "found";
      status: "success" | "failed" | "reversed" | "pending" | "other";
      amount: number | null;
      currency: string | null;
      transferCode: string | null;
    };

export type BalanceResult = { ok: true; balances: { currency: string; amount: number }[] } | { ok: false; message: string };

export type BankListResult = { ok: true; banks: PaystackBank[] } | { ok: false; message: string };

export type PaystackClient = {
  listBanks: () => Promise<BankListResult>;
  resolveAccount: (accountNumber: string, bankCode: string) => Promise<ResolveResult>;
  createRecipient: (input: { name: string; accountNumber: string; bankCode: string }) => Promise<RecipientResult>;
  bulkTransfer: (transfers: BulkTransfer[]) => Promise<BulkResult>;
  verifyTransfer: (reference: string) => Promise<VerifiedTransfer>;
  getBalance: () => Promise<BalanceResult>;
};

const TIMEOUT_MS = 15_000;

export function createPaystackClient(options: {
  secretKey: string;
  baseUrl: string;
  fetchImpl?: PaystackFetch;
}): PaystackClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const headers = {
    Authorization: `Bearer ${options.secretKey}`,
    "Content-Type": "application/json",
  };

  async function call(path: string, init: RequestInit): Promise<{ kind: "response"; status: number; body: unknown } | { kind: "uncertain" }> {
    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        ...init,
        headers: { ...headers, ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const text = await response.text();
      let body: unknown = null;
      if (text) {
        try {
          body = JSON.parse(text) as unknown;
        } catch {
          body = null;
        }
      }
      return { kind: "response", status: response.status, body };
    } catch {
      return { kind: "uncertain" };
    }
  }

  return {
    async listBanks() {
      const banks: PaystackBank[] = [];
      const seen = new Set<string>();
      for (let page = 1; page <= 20; page += 1) {
        const result = await call(`/bank?currency=NGN&perPage=100&page=${page}`, { method: "GET" });
        if (result.kind === "uncertain" || result.status >= 500 || result.status === 429) {
          return { ok: false, message: "Paystack bank list is unavailable." };
        }
        if (result.status >= 400 || !statusTrue(result.body)) {
          return { ok: false, message: messageOf(result.body, "Banks could not be loaded.") };
        }
        const rows = arrayData(result.body);
        if (rows.length === 0) break;
        let added = 0;
        for (const row of rows) {
          const bank = parseBank(row);
          if (!bank || seen.has(bank.code)) continue;
          seen.add(bank.code);
          banks.push(bank);
          added += 1;
        }
        if (rows.length < 100 || added === 0) break;
      }
      banks.sort((a, b) => a.name.localeCompare(b.name));
      return { ok: true, banks };
    },

    async resolveAccount(accountNumber, bankCode) {
      const query = new URLSearchParams({ account_number: accountNumber, bank_code: bankCode });
      const result = await call(`/bank/resolve?${query.toString()}`, { method: "GET" });
      if (result.kind === "uncertain" || result.status >= 500 || result.status === 429) {
        return { ok: false, message: "Account verification is unavailable. Try again in a few minutes." };
      }
      if (result.status >= 400 || !statusTrue(result.body)) {
        return { ok: false, message: messageOf(result.body, "That account could not be verified.") };
      }
      const data = objectData(result.body);
      const resolvedNumber = data?.account_number;
      const accountName = data?.account_name;
      if (typeof resolvedNumber !== "string" || typeof accountName !== "string" || !accountName.trim()) {
        return { ok: false, message: "Paystack did not return an account name." };
      }
      return { ok: true, accountNumber: resolvedNumber, accountName: accountName.trim() };
    },

    async createRecipient(input) {
      const result = await call("/transferrecipient", {
        method: "POST",
        body: JSON.stringify({
          type: "nuban",
          name: input.name,
          account_number: input.accountNumber,
          bank_code: input.bankCode,
          currency: "NGN",
        }),
      });
      if (result.kind === "uncertain" || result.status >= 500 || result.status === 429) {
        return { ok: false, message: "The payout account could not be saved. Try again in a few minutes." };
      }
      if (result.status >= 400 || !statusTrue(result.body)) {
        return { ok: false, message: messageOf(result.body, "Paystack did not create a transfer recipient.") };
      }
      const data = objectData(result.body);
      const recipientCode = data?.recipient_code;
      if (typeof recipientCode !== "string" || !recipientCode.startsWith("RCP_")) {
        return { ok: false, message: "Paystack did not return a recipient code." };
      }
      return { ok: true, recipientCode };
    },

    async bulkTransfer(transfers) {
      const result = await call("/transfer/bulk", {
        method: "POST",
        body: JSON.stringify({
          currency: "NGN",
          source: "balance",
          transfers: transfers.map((transfer) => ({
            amount: transfer.amount,
            reference: transfer.reference,
            reason: transfer.reason,
            recipient: transfer.recipient,
          })),
        }),
      });
      if (result.kind === "uncertain") return { outcome: "uncertain", message: "Paystack did not respond. The batch was not retried." };
      if (result.status >= 500 || result.status === 429) {
        return { outcome: "uncertain", message: "Paystack did not accept the batch. The transfers were left for reconciliation." };
      }
      if (result.status >= 400 || !statusTrue(result.body)) {
        return { outcome: "rejected", message: messageOf(result.body, "Paystack rejected the batch.") };
      }
      const items = arrayData(result.body).flatMap((row) => {
        const item = parseBulkItem(row);
        return item ? [item] : [];
      });
      return { outcome: "accepted", message: messageOf(result.body, "Transfers queued."), items };
    },

    async verifyTransfer(reference) {
      const result = await call(`/transfer/verify/${encodeURIComponent(reference)}`, { method: "GET" });
      if (result.kind === "uncertain" || result.status >= 500 || result.status === 429) {
        return { outcome: "unavailable", message: "Paystack verification is unavailable." };
      }
      if (result.status === 404 || (result.status >= 400 && /not found/i.test(messageOf(result.body, "")))) {
        return { outcome: "not_found" };
      }
      if (!statusTrue(result.body)) {
        const message = messageOf(result.body, "");
        if (/not found/i.test(message)) return { outcome: "not_found" };
        return { outcome: "unavailable", message: message || "Paystack verification failed." };
      }
      const data = objectData(result.body);
      const status = typeof data?.status === "string" ? normalizeStatus(data.status) : "other";
      return {
        outcome: "found",
        status,
        amount: typeof data?.amount === "number" && Number.isInteger(data.amount) ? data.amount : null,
        currency: typeof data?.currency === "string" ? data.currency : null,
        transferCode: typeof data?.transfer_code === "string" ? data.transfer_code : null,
      };
    },

    async getBalance() {
      const result = await call("/balance", { method: "GET" });
      if (result.kind === "uncertain" || result.status >= 500 || result.status === 429) {
        return { ok: false, message: "Paystack balance is unavailable." };
      }
      if (result.status >= 400 || !statusTrue(result.body)) {
        return { ok: false, message: messageOf(result.body, "Paystack balance could not be read.") };
      }
      const balances = arrayData(result.body).flatMap((row) => {
        if (!row || typeof row !== "object") return [];
        const record = row as Record<string, unknown>;
        if (typeof record.currency !== "string" || typeof record.balance !== "number" || !Number.isInteger(record.balance)) {
          return [];
        }
        return [{ currency: record.currency, amount: record.balance }];
      });
      return { ok: true, balances };
    },
  };
}

function statusTrue(body: unknown): boolean {
  return Boolean(body && typeof body === "object" && "status" in body && (body as { status: unknown }).status === true);
}

function messageOf(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in body && typeof (body as { message: unknown }).message === "string") {
    return (body as { message: string }).message.slice(0, 300);
  }
  return fallback;
}

function objectData(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const data = (body as { data: unknown }).data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
}

function arrayData(body: unknown): unknown[] {
  if (!body || typeof body !== "object" || !("data" in body)) return [];
  const data = (body as { data: unknown }).data;
  return Array.isArray(data) ? data : [];
}

function parseBank(row: unknown): PaystackBank | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  if (record.active === false || record.is_deleted === true) return null;
  if (record.currency !== "NGN" || record.type !== "nuban") return null;
  if (typeof record.name !== "string" || typeof record.code !== "string" || !/^\d{3,6}$/.test(record.code)) return null;
  return { name: record.name, code: record.code };
}

function parseBulkItem(row: unknown): BulkItem | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  if (typeof record.reference !== "string" || typeof record.recipient !== "string") return null;
  if (typeof record.amount !== "number" || !Number.isInteger(record.amount)) return null;
  return {
    reference: record.reference,
    recipient: record.recipient,
    amount: record.amount,
    transferCode: typeof record.transfer_code === "string" ? record.transfer_code : null,
    status: typeof record.status === "string" ? record.status : null,
  };
}

function normalizeStatus(value: string): "success" | "failed" | "reversed" | "pending" | "other" {
  const status = value.toLowerCase();
  if (status === "success" || status === "failed" || status === "reversed" || status === "pending") return status;
  if (status === "otp") return "pending";
  return "other";
}
