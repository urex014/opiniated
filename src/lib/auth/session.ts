import "server-only";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { requireAuthSecret } from "@/lib/env";

export type SessionData = {
  userId: string;
};

export { SESSION_COOKIE };

function options(): SessionOptions {
  return {
    cookieName: SESSION_COOKIE,
    password: requireAuthSecret(),
    ttl: 60 * 60 * 24 * 14,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), options());
}
