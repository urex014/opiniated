"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

export const COOKIE_NOTICE_NAME = "opiniated_cookie_notice";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const listeners = new Set<() => void>();

export function hasAcceptedCookies(cookieHeader: string): boolean {
  return cookieHeader.split("; ").includes(`${COOKIE_NOTICE_NAME}=accepted`);
}

export function acceptedCookie(secure: boolean): string {
  const secureFlag = secure ? "; Secure" : "";
  return `${COOKIE_NOTICE_NAME}=accepted; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secureFlag}`;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const timer = setTimeout(listener, 0);
  return () => {
    clearTimeout(timer);
    listeners.delete(listener);
  };
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function CookieNotice() {
  const accepted = useSyncExternalStore(subscribe, () => hasAcceptedCookies(document.cookie), () => true);

  function accept() {
    document.cookie = acceptedCookie(window.location.protocol === "https:");
    notify();
  }

  if (accepted) return <div data-cookie-notice="hidden" hidden />;

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-ink">
          Opiniated uses a cookie to keep you signed in. It is not used for advertising.{" "}
          <Link href="/privacy" className="font-medium text-brand transition-colors duration-150 hover:text-brand-hover">
            Privacy
          </Link>
        </p>
        <button type="button" className="btn btn-primary" onClick={accept}>
          Accept
        </button>
      </div>
    </div>
  );
}
