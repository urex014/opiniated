import Link from "next/link";

export function SiteFooter({ supportEmail }: { supportEmail: string | null }) {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 text-sm text-muted sm:grid-cols-[1fr_auto]">
        <div>
          <p className="font-medium text-ink">Opiniated</p>
          <p className="mt-1 max-w-md">
            A survey rewards site. Survey availability depends on the provider, and a reward is added only after a
            verified completion.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/how-it-works">How it works</Link>
          <Link href="/help">Help</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          {supportEmail ? (
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
          ) : (
            <span>Support contact is set by the site operator.</span>
          )}
        </nav>
      </div>
    </footer>
  );
}
