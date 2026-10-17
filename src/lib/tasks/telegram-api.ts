import { readEnv } from "@/lib/env";

export type MembershipCheckResult = {
  isMember: boolean;
  status?: string;
  error?: string;
};

export async function checkTelegramChannelMembership(
  telegramUserId: number | string
): Promise<MembershipCheckResult> {
  const env = readEnv();
  const token = env.telegramBotToken;
  const chatId = env.telegramChatId;

  if (!token || !chatId) {
    return { isMember: false, error: "Telegram bot not configured" };
  }

  try {
    const url = `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(
      chatId
    )}&user_id=${encodeURIComponent(telegramUserId)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const data = await res.json();
    if (!data.ok || !data.result) {
      return { isMember: false, error: data.description ?? "Participant not found" };
    }

    const status = String(data.result.status);
    const isMember = status === "member" || status === "administrator" || status === "creator";

    return { isMember, status };
  } catch (error) {
    return { isMember: false, error: error instanceof Error ? error.message : "Network error" };
  }
}

export async function sendTelegramDirectMessage(
  chatId: number | string,
  text: string
): Promise<boolean> {
  const env = readEnv();
  const token = env.telegramBotToken;
  if (!token) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });
    const data = await res.json();
    return Boolean(data.ok);
  } catch {
    return false;
  }
}

export async function configureTelegramWebhook(
  webhookUrl: string,
  secretToken: string
): Promise<{ ok: boolean; description?: string }> {
  const env = readEnv();
  const token = env.telegramBotToken;
  if (!token) return { ok: false, description: "Missing TELEGRAM_BOT_TOKEN" };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secretToken,
        allowed_updates: ["message"],
      }),
    });
    const data = await res.json();
    return { ok: Boolean(data.ok), description: data.description };
  } catch (error) {
    return { ok: false, description: error instanceof Error ? error.message : "Network error" };
  }
}
