"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-3xl flex-1 flex-col justify-center px-4 py-16">
      <h1 className="page-title">Something went wrong</h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-muted">
        This page could not be loaded. Try again, or return to the homepage.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/" className="btn btn-secondary">
          Homepage
        </Link>
      </div>
    </main>
  );
}
