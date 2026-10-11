import "server-only";
import { sendResendEmail } from "@/lib/email/resend";
import { readEnv } from "@/lib/env";

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<"sent" | "skipped"> {
  const env = readEnv();
  if (!env.email) {
    if (process.env.NODE_ENV !== "production") {
      console.info("Password reset email skipped because Resend is not configured.", { resetUrl });
    }
    return "skipped";
  }

  await sendResendEmail({
    apiKey: env.email.apiKey,
    from: env.email.from,
    to,
    subject: "Reset your Opiniated password",
    text: `Use this link to choose a new password. It expires in one hour.\n\n${resetUrl}\n\nIf you did not ask for this, you can ignore the email.`,
  });
  return "sent";
}

export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<"sent" | "skipped"> {
  const email = readEnv().email;
  if (!email) return "skipped";

  await sendResendEmail({
    apiKey: email.apiKey,
    from: email.from,
    to,
    subject: "Verify your Opiniated email",
    text: `Confirm this email address for your Opiniated account. The link expires in one day.\n\n${verifyUrl}\n\nIf you did not create an account, you can ignore the email.`,
  });
  return "sent";
}
