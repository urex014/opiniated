"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";
import { sendPasswordResetEmail } from "@/lib/email/send";
import { clientIpFromHeaders } from "@/lib/security/ip";
import { rateLimit } from "@/lib/security/rate-limit";
import {
  forgotSchema,
  loginSchema,
  passwordChangeSchema,
  profileSchema,
  registerSchema,
  resetSchema,
} from "@/lib/validation/auth";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  message?: string;
};

async function requestIp(): Promise<string> {
  const headerList = await headers();
  return clientIpFromHeaders(headerList) ?? "local";
}

export async function registerAction(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const ip = await requestIp();
  if (!rateLimit(`register:${ip}`, 8, 15 * 60 * 1000)) {
    return { error: "Too many registration attempts. Wait a few minutes and try again." };
  }

  const name = parsed.data.name?.trim() ? parsed.data.name.trim() : null;
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { error: "An account with that email already exists." };

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name,
      passwordHash: await hashPassword(parsed.data.password),
      rewardAccount: { create: {} },
    },
  });
  const session = await getSession();
  session.userId = user.id;
  await session.save();
  redirect("/dashboard");
}

export async function loginAction(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const ip = await requestIp();
  if (!rateLimit(`login:${ip}:${parsed.data.email}`, 10, 15 * 60 * 1000)) {
    return { error: "Too many sign-in attempts. Wait a few minutes and try again." };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Email or password is incorrect." };
  }
  const session = await getSession();
  session.userId = user.id;
  await session.save();
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  session.destroy();
  await session.save();
  redirect("/");
}

export async function forgotPasswordAction(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = forgotSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const ip = await requestIp();
  if (!rateLimit(`forgot:${ip}`, 6, 15 * 60 * 1000)) {
    return { error: "Too many reset requests. Wait a few minutes and try again." };
  }

  const generic = "If an account exists for that email and mail delivery is configured, a reset link is on its way.";
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const env = readEnv();
  if (user && env.smtp) {
    const token = randomBytes(32).toString("base64url");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await sendPasswordResetEmail(user.email, `${env.appUrl}/reset-password?token=${token}`);
  }
  return { message: generic };
}

export async function resetPasswordAction(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const token = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
  });
  if (!token || token.usedAt || token.expiresAt.getTime() < Date.now()) {
    return { error: "This reset link is invalid or has expired." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: token.userId },
      data: { passwordHash: await hashPassword(parsed.data.password) },
    }),
    prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
  ]);
  redirect("/login");
}

export async function updateProfileAction(_state: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const parsed = profileSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  await prisma.user.update({
    where: { id: session.userId },
    data: { name: parsed.data.name || null },
  });
  return { message: "Name saved." };
}

export async function changePasswordAction(_state: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const parsed = passwordChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return { error: "Current password is incorrect." };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });
  return { message: "Password updated." };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
