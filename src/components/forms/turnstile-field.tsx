"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          action: string;
          "expired-callback": () => void;
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export function TurnstileField({ siteKey, resetKey = 0 }: { siteKey: string | null; resetKey?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef("");

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let cancelled = false;

    const render = () => {
      if (cancelled || !ref.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        action: "signup",
        "expired-callback": () => {
          if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
        },
      });
    };

    if (window.turnstile) {
      render();
    } else {
      let script = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
      if (!script) {
        script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.dataset.turnstile = "true";
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
    }

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = "";
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetKey === 0 || !widgetId.current || !window.turnstile) return;
    window.turnstile.reset(widgetId.current);
  }, [resetKey]);

  if (!siteKey) {
    return (
      <p className="rounded-md border border-line bg-surface px-3 py-2 text-sm leading-5 text-muted">
        Signup protection is not configured. Accounts cannot be created until NEXT_PUBLIC_TURNSTILE_SITE_KEY,
        TURNSTILE_SECRET_KEY, and TURNSTILE_HOSTNAMES are set.
      </p>
    );
  }

  return <div ref={ref} className="min-h-16" />;
}
