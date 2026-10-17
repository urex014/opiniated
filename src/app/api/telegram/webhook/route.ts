import { NextResponse } from "next/server";
import { readEnv } from "@/lib/env";
import { verifyTelegramVerificationPayload } from "@/lib/tasks/telegram-token";
import {
  checkTelegramChannelMembership,
  sendTelegramDirectMessage,
} from "@/lib/tasks/telegram-api";
import { claimTask } from "@/lib/tasks/service";
import { TELEGRAM_TASK_ID } from "@/lib/tasks/constants";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const env = readEnv();

  // Validate Telegram webhook secret token header if configured
  if (env.telegramWebhookSecret) {
    const incomingSecret = request.headers.get("x-telegram-bot-api-secret-token");
    if (incomingSecret !== env.telegramWebhookSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = body?.message;
  if (!message || typeof message.text !== "string") {
    return NextResponse.json({ ok: true });
  }

  const text = message.text.trim();
  const chatId = message.chat?.id;
  const telegramUserId = message.from?.id;
  const telegramUsername = message.from?.username;

  if (!chatId || !telegramUserId) {
    return NextResponse.json({ ok: true });
  }

  // Handle deep-linked verification: /start <payload>
  const match = text.match(/^\/start\s+([A-Za-z0-9_-]+)$/);
  if (match) {
    const payload = match[1];
    if (!payload) {
      return NextResponse.json({ ok: true });
    }
    const tokenResult = verifyTelegramVerificationPayload(payload);

    if (!tokenResult.ok) {
      await sendTelegramDirectMessage(
        chatId,
        "⚠️ *Invalid or expired verification link.*\n\nPlease return to your Opiniated dashboard and click 'Verify with Bot' to generate a fresh link."
      );
      return NextResponse.json({ ok: true });
    }

    const userId = tokenResult.userId;

    // Check if user is an active member/subscriber of the channel
    const membership = await checkTelegramChannelMembership(telegramUserId);

    if (!membership.isMember) {
      await sendTelegramDirectMessage(
        chatId,
        "⚠️ *Channel membership not detected.*\n\nWe could not find your Telegram account in the official Opiniated channel (@opiniatedng).\n\n👉 **Join here first:** https://t.me/opiniatedng\n\nOnce you have joined the channel, tap /start here again to claim your **1 OPN**!"
      );
      return NextResponse.json({ ok: true });
    }

    // User is verified in the channel. Complete the one-time task claim.
    const claimResult = await claimTask(userId, TELEGRAM_TASK_ID, {
      telegramUserId: String(telegramUserId),
      telegramUsername: telegramUsername ? String(telegramUsername) : undefined,
    });

    if (claimResult.ok) {
      await sendTelegramDirectMessage(
        chatId,
        "🎉 *Verification Successful!*\n\nWe verified your membership in @opiniatedng. **1 OPN** has been added to your Opiniated balance.\n\n👉 [Return to Dashboard](https://opiniated.vercel.app/dashboard)"
      );
    } else {
      await sendTelegramDirectMessage(
        chatId,
        `ℹ️ *${claimResult.error}*\n\nThank you for being a valued member of the Opiniated community!`
      );
    }

    return NextResponse.json({ ok: true });
  }

  // Generic /start without payload
  if (text === "/start") {
    await sendTelegramDirectMessage(
      chatId,
      "👋 *Welcome to the Opiniated Verification Bot!*\n\nTo verify your membership in @opiniatedng and earn 1 OPN, please open the verification link from your Opiniated dashboard.\n\n👉 https://opiniated.vercel.app/dashboard"
    );
  }

  return NextResponse.json({ ok: true });
}
