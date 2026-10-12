import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

const PROTECTED = [/^\/dashboard(?:\/|$)/, /^\/surveys(?:\/|$)/, /^\/rewards(?:\/|$)/, /^\/payouts(?:\/|$)/, /^\/activity(?:\/|$)/, /^\/account(?:\/|$)/, /^\/admin(?:\/|$)/];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isProtected = PROTECTED.some((pattern) => pattern.test(pathname));

  if (isProtected && !hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if ((pathname === "/login" || pathname === "/register") && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/surveys/:path*", "/rewards/:path*", "/payouts/:path*", "/activity/:path*", "/account/:path*", "/admin/:path*", "/login", "/register"],
};
