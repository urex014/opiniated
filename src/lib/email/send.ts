import "server-only";
import nodemailer from "nodemailer";
import { readEnv } from "@/lib/env";

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<"sent" | "skipped"> {
  const env = readEnv();
  if (!env.smtp) {
    if (process.env.NODE_ENV !== "production") {
      console.info("Password reset email skipped because SMTP is not configured.", { resetUrl });
    }
    return "skipped";
  }

  const transport = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.password ?? "" } : undefined,
  });

  await transport.sendMail({
    from: env.smtp.from,
    to,
    subject: "Reset your Opiniated password",
    text: `Use this link to choose a new password. It expires in one hour.\n\n${resetUrl}\n\nIf you did not ask for this, you can ignore the email.`,
  });
  return "sent";
}
