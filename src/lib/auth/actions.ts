"use server";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { generateReferralCode } from "@/lib/referrals/code";
import { attributeReferral } from "@/lib/referrals/attribution";
import { REFERRAL_COOKIE_NAME } from "@/lib/referrals/constants";
import { readEnv } from "@/lib/env";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { safeReturnPath } from "@/lib/auth/return-path";
import { getSession } from "@/lib/auth/session";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email/send";
import { consentWrites, outstandingDocuments } from "@/lib/legal/consent";
import { POLICY_DOCUMENTS, type PolicyDocument } from "@/lib/legal/versions";
import { allowAuthAttempt } from "@/lib/security/auth-limits";
import { assessAccount, noteEmailIdentity } from "@/lib/risk/account-check";
import { clientIpFromHeaders } from "@/lib/security/ip";
import { turnstileErrorMessage, verifyTurnstileToken } from "@/lib/security/turnstile";
import {
  forgotSchema,
  loginSchema,
  passwordChangeSchema,
  profileSchema,
  registerFormValues,
  registerSchema,
  registrationIdentity,
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
  const parsed = registerSchema.safeParse(registerFormValues(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const identity = registrationIdentity(parsed.data);
  const headerList = await headers();
  const ip = clientIpFromHeaders(headerList) ?? "local";
  if (!(await allowAuthAttempt("register", ip))) {
    return { error: "Too many registration attempts. Wait a few minutes and try again." };
  }

  const env = readEnv();
  const captcha = await verifyTurnstileToken(String(formData.get("cf-turnstile-response") ?? ""), ip, {
    secret: env.turnstileSecret,
    hostnames: env.turnstileHostnames,
    action: "signup",
  });
  if (!captcha.ok) return { error: turnstileErrorMessage(captcha.reason) };

  const existing = await prisma.user.findUnique({ where: { email: identity.email } });
  if (existing) {
    return { error: "An account could not be created with that email. If you already have an account, log in." };
  }

  const cookieStore = await cookies();
  const rawRefCode = formData.get("ref");
  const refCode = String(rawRefCode ?? cookieStore.get(REFERRAL_COOKIE_NAME)?.value ?? "").trim();

  let referralCode = generateReferralCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const codeTaken = await prisma.user.findUnique({ where: { referralCode }, select: { id: true } });
    if (!codeTaken) break;
    referralCode = generateReferralCode();
  }

  const acceptedAt = new Date();
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: identity.email,
        name: identity.name,
        passwordHash: await hashPassword(identity.password),
        referralCode,
        rewardAccount: { create: {} },
      },
    });
    await tx.consentRecord.createMany({
      data: consentWrites({
        userId: created.id,
        documents: [...POLICY_DOCUMENTS],
        action: "registration",
        acceptedAt,
        ip,
        userAgent: headerList.get("user-agent"),
      }),
    });
    if (refCode) {
      await attributeReferral(tx, {
        referredUserId: created.id,
        code: refCode,
        source: rawRefCode ? "link" : "cookie",
      });
    }
    return created;
  });

  const emailAlias = await noteEmailIdentity(user.id, user.email).catch(() => false);
  if (emailAlias) {
    await assessAccount({ stage: "register", userId: user.id, email: user.email, ip, emailAlias: true });
  }

  if (readEnv().email) {
    try {
      await issueVerificationEmail(user.id, user.email);
    } catch {
      // The account exists. The person can request another verification email from Account.
    }
  }

  const session = await getSession();
  session.userId = user.id;
  await session.save();
  redirect(safeReturnPath(formData.get("next")));
}

export async function loginAction(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const ip = await requestIp();
  if (!(await allowAuthAttempt("login", ip, parsed.data.email))) {
    return { error: "Too many sign-in attempts. Wait a few minutes and try again." };
  }

  const env = readEnv();
  const captcha = await verifyTurnstileToken(String(formData.get("cf-turnstile-response") ?? ""), ip, {
    secret: env.turnstileSecret,
    hostnames: env.turnstileHostnames,
    action: "login",
  });
  if (!captcha.ok) return { error: turnstileErrorMessage(captcha.reason) };

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || user.deletedAt || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Email or password is incorrect." };
  }
  const emailAlias = await noteEmailIdentity(user.id, user.email).catch(() => false);
  if (emailAlias) {
    await assessAccount({ stage: "login", userId: user.id, email: user.email, ip, emailAlias: true });
  }
  const session = await getSession();
  session.userId = user.id;
  await session.save();
  redirect(safeReturnPath(formData.get("next")));
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
  if (!(await allowAuthAttempt("forgot", ip))) {
    return { error: "Too many reset requests. Wait a few minutes and try again." };
  }

  const generic = "If an account exists for that email and mail delivery is configured, a reset link is on its way.";
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const env = readEnv();
  if (user && !user.deletedAt && env.email) {
    const token = randomBytes(32).toString("base64url");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    try {
      await sendPasswordResetEmail(user.email, `${env.appUrl}/reset-password?token=${token}`);
    } catch {
      console.error("Password reset email failed.");
    }
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
  if (!(await allowAuthAttempt("reset", await requestIp()))) {
    return { error: "Too many reset attempts. Wait a few minutes and try again." };
  }

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

export async function renewConsentAction(_state: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session.userId) redirect("/login?next=/account/consent");
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, deletedAt: true } });
  if (!user || user.deletedAt) redirect("/login");

  const records = await prisma.consentRecord.findMany({
    where: { userId: user.id },
    select: { document: true, version: true, acceptedAt: true },
  });
  const needed = outstandingDocuments(records);
  if (needed.length === 0) return { message: "The current Privacy Policy and Terms of Service are already accepted." };

  const missing = needed.filter((document) => formData.get(consentField(document)) !== "on");
  if (missing.length > 0) {
    return {
      fieldErrors: Object.fromEntries(missing.map((document) => [consentField(document), ["Accept the current version to continue."]])),
    };
  }

  const headerList = await headers();
  await prisma.consentRecord.createMany({
    data: consentWrites({
      userId: user.id,
      documents: needed,
      action: "renewal",
      acceptedAt: new Date(),
      ip: clientIpFromHeaders(headerList),
      userAgent: headerList.get("user-agent"),
    }),
  });
  redirect(safeReturnPath(formData.get("next")));
}

export async function deleteAccountAction(_state: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session.userId) redirect("/login?next=/account");
  const ip = await requestIp();
  if (!(await allowAuthAttempt("verify", ip, session.userId))) {
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }
  const password = String(formData.get("password") ?? "");
  if (!password) return { fieldErrors: { password: ["Enter your password to delete the account."] } };

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.deletedAt || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Password is incorrect." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        email: `deleted-${user.id}@users.invalid`,
        name: null,
        passwordHash: await hashPassword(`${randomBytes(32).toString("hex")}!a1`),
        emailVerifiedAt: null,
        deletedAt: new Date(),
      },
    }),
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } }),
    prisma.payoutAccount.deleteMany({ where: { userId: user.id } }),
  ]);
  session.destroy();
  await session.save();
  redirect("/");
}

export async function sendVerificationAction(): Promise<FormState> {
  const session = await getSession();
  if (!session.userId) redirect("/login?next=/account");
  if (!(await allowAuthAttempt("verify", await requestIp(), session.userId))) {
    return { error: "Too many verification requests. Wait a few minutes and try again." };
  }
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.deletedAt) redirect("/login");
  if (user.emailVerifiedAt) return { message: "This email is already verified." };
  if (!readEnv().email) {
    return { error: "Email delivery is not configured, so a verification message cannot be sent." };
  }
  try {
    await issueVerificationEmail(user.id, user.email);
  } catch {
    return { error: "The verification email could not be sent. Try again in a few minutes." };
  }
  return { message: "Verification email sent." };
}

export async function verifyEmailAction(_state: FormState, formData: FormData): Promise<FormState> {
  if (!(await allowAuthAttempt("verify", await requestIp()))) {
    return { error: "Too many verification attempts. Wait a few minutes and try again." };
  }
  const result = await consumeEmailVerificationToken(String(formData.get("token") ?? ""));
  if (result === "verified") return { message: "This email address is verified." };
  return { error: "This verification link is invalid or has expired." };
}

async function consumeEmailVerificationToken(token: string): Promise<"verified" | "invalid"> {
  if (token.length < 20) return "invalid";
  const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) return "invalid";
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  return "verified";
}

async function issueVerificationEmail(userId: string, email: string): Promise<void> {
  const env = readEnv();
  const token = randomBytes(32).toString("base64url");
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  await sendVerificationEmail(email, `${env.appUrl}/verify-email?token=${token}`);
}

function consentField(document: PolicyDocument): string {
  return document === "privacy" ? "acceptPrivacy" : "acceptTerms";
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
