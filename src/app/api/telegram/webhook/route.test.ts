import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  readEnv: vi.fn(() => ({
    telegramWebhookSecret: "test-webhook-secret-token",
    telegramBotToken: "mock-bot-token",
    telegramChatId: "@opiniatedng",
    authSecret: "test-auth-secret-key-at-least-32-chars-long!",
  })),
}));

vi.mock("@/lib/tasks/telegram-api", () => ({
  checkTelegramChannelMembership: vi.fn(),
  sendTelegramDirectMessage: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/tasks/service", () => ({
  claimTask: vi.fn(),
}));

import { checkTelegramChannelMembership, sendTelegramDirectMessage } from "@/lib/tasks/telegram-api";
import { claimTask } from "@/lib/tasks/service";
import { generateTelegramVerificationPayload } from "@/lib/tasks/telegram-token";
import { POST } from "./route";

describe("telegram webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthorized webhook calls without valid secret header", async () => {
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "x-telegram-bot-api-secret-token": "wrong-secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ update_id: 1 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("handles invalid or expired payload gracefully", async () => {
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "x-telegram-bot-api-secret-token": "test-webhook-secret-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        update_id: 1,
        message: {
          chat: { id: 12345 },
          from: { id: 12345, username: "tester" },
          text: "/start invalid_payload_here",
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(sendTelegramDirectMessage).toHaveBeenCalledWith(
      12345,
      expect.stringContaining("Invalid or expired")
    );
  });

  it("rejects claim when user is NOT in the channel", async () => {
    const userId = "user-123";
    const payload = generateTelegramVerificationPayload(userId);

    vi.mocked(checkTelegramChannelMembership).mockResolvedValue({
      isMember: false,
      status: "left",
    });

    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "x-telegram-bot-api-secret-token": "test-webhook-secret-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        update_id: 1,
        message: {
          chat: { id: 12345 },
          from: { id: 12345, username: "tester" },
          text: `/start ${payload}`,
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(checkTelegramChannelMembership).toHaveBeenCalledWith(12345);
    expect(claimTask).not.toHaveBeenCalled();
    expect(sendTelegramDirectMessage).toHaveBeenCalledWith(
      12345,
      expect.stringContaining("Channel membership not detected")
    );
  });

  it("completes claim when user IS an active channel member", async () => {
    const userId = "user-123";
    const payload = generateTelegramVerificationPayload(userId);

    vi.mocked(checkTelegramChannelMembership).mockResolvedValue({
      isMember: true,
      status: "member",
    });

    vi.mocked(claimTask).mockResolvedValue({
      ok: true,
      rewardUnits: 1,
      message: "1 OPN added",
    });

    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "x-telegram-bot-api-secret-token": "test-webhook-secret-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        update_id: 1,
        message: {
          chat: { id: 12345 },
          from: { id: 12345, username: "tester" },
          text: `/start ${payload}`,
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(checkTelegramChannelMembership).toHaveBeenCalledWith(12345);
    expect(claimTask).toHaveBeenCalledWith("user-123", "telegram_join", {
      telegramUserId: "12345",
      telegramUsername: "tester",
    });

    expect(sendTelegramDirectMessage).toHaveBeenCalledWith(
      12345,
      expect.stringContaining("Verification Successful")
    );
  });
});
