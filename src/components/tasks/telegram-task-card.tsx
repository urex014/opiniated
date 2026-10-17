"use client";

import { useState, useTransition } from "react";
import { TELEGRAM_GROUP_URL } from "@/lib/tasks/constants";
import { checkTelegramTaskStatusAction } from "@/lib/tasks/actions";

export function TelegramTaskCard({
  initialClaimed,
  verificationLink,
}: {
  initialClaimed: boolean;
  verificationLink?: string;
}) {
  const [isClaimed, setIsClaimed] = useState(initialClaimed);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isChecking, startTransition] = useTransition();

  const handleCheckStatus = () => {
    setStatusMessage(null);
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const result = await checkTelegramTaskStatusAction();
        if (result.isClaimed) {
          setIsClaimed(true);
          setStatusMessage("1 OPN has been added to your balance.");
        } else {
          setErrorMessage(
            "Membership not detected yet. Please ensure you have joined @opiniatedng, then click 'Start' in the verification bot."
          );
        }
      } catch {
        setErrorMessage("Unable to verify status at this moment. Please try again.");
      }
    });
  };

  if (isClaimed) {
    return (
      <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-line bg-white px-4 py-3 text-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-wash text-brand">
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <span className="font-medium text-ink">Telegram task completed</span>
            <span className="text-muted"> · 1 OPN claimed</span>
            {statusMessage && (
              <span className="block text-xs font-medium text-brand mt-0.5">
                {statusMessage}
              </span>
            )}
          </div>
        </div>
        <a
          href={TELEGRAM_GROUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand transition-colors hover:text-brand-hover"
        >
          <span>Open Telegram channel</span>
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z"
              clipRule="evenodd"
            />
          </svg>
        </a>
      </div>
    );
  }

  const botUrl = verificationLink ?? `https://t.me/updatedadminbot`;

  return (
    <div className="mt-8 overflow-hidden rounded-lg border border-line bg-white shadow-xs">
      <div className="border-l-4 border-brand p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#229ED9]/10 text-[#229ED9]">
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.12.03-1.99 1.27-5.62 3.72-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.05-.49-.83-.27-1.49-.42-1.43-.88.03-.24.37-.49 1.02-.75 3.98-1.73 6.64-2.87 7.97-3.44 3.8-1.58 4.59-1.85 5.11-1.86.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.16-.04.26z" />
              </svg>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-brand-wash px-2.5 py-0.5 text-xs font-semibold text-brand">
                  One-time task
                </span>
                <span className="rounded-full bg-[#eef7ff] px-2.5 py-0.5 text-xs font-semibold text-[#1677b0]">
                  +1 OPN
                </span>
              </div>
              <h2 className="mt-1 text-base font-semibold text-ink">
                Join our Telegram community
              </h2>
              <p className="mt-1 text-sm leading-5 text-muted">
                Join <strong>@opiniatedng</strong> and verify your channel membership with our automated bot to earn <strong>1 OPN</strong>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:self-center">
            <a
              href={TELEGRAM_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary h-9 text-xs"
            >
              1. Join @opiniatedng
            </a>
            <a
              href={botUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary h-9 text-xs"
            >
              2. Verify with Bot
            </a>
            <button
              type="button"
              onClick={handleCheckStatus}
              disabled={isChecking}
              className="btn btn-secondary h-9 text-xs"
              title="Click after tapping Start in the Telegram bot"
            >
              {isChecking ? "Checking..." : "Check status"}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-3 rounded-md bg-danger-bg p-2.5 text-xs text-danger">
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}
