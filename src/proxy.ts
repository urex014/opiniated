import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { isValidReferralCode } from "@/lib/referrals/code";
import { REFERRAL_COOKIE_MAX_AGE_SECONDS, REFERRAL_COOKIE_NAME } from "@/lib/referrals/constants";

const PROTECTED = [
  /^\/dashboard(?:\/|$)/,
  /^\/surveys(?:\/|$)/,
  /^\/rewards(?:\/|$)/,
  /^\/referrals(?:\/|$)/,
  /^\/payouts(?:\/|$)/,
  /^\/activity(?:\/|$)/,
  /^\/account(?:\/|$)/,
  /^\/admin(?:\/|$)/,
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isProtected = PROTECTED.some((pattern) => pattern.test(pathname));

  let response: NextResponse;

  if (isProtected && !hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    response = NextResponse.redirect(url);
  } else if ((pathname === "/login" || pathname === "/register") && hasSession) {
    response = NextResponse.redirect(new URL("/dashboard", request.url));
  } else {
    response = NextResponse.next();
  }

  const ref = request.nextUrl.searchParams.get("ref");
  if (ref && isValidReferralCode(ref)) {
    response.cookies.set(REFERRAL_COOKIE_NAME, ref.trim().toUpperCase(), {
      maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false,
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/surveys/:path*",
    "/rewards/:path*",
    "/referrals/:path*",
    "/payouts/:path*",
    "/activity/:path*",
    "/account/:path*",
    "/admin/:path*",
    "/login",
    "/register",
  ],
};
