import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { readEnv } from "@/lib/env";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-16">
        <h1 className="page-title">Page not found</h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-muted">
          That address is not a public Opiniated page. The homepage explains how survey rewards work.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/" className="btn btn-primary">
            Homepage
          </Link>
          <Link href="/help" className="btn btn-secondary">
            Help
          </Link>
        </div>
      </main>
      <SiteFooter supportEmail={readEnv().supportEmail} />
    </>
  );
}
