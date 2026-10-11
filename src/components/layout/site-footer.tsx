import Link from "next/link";

export function SiteFooter({ supportEmail }: { supportEmail: string | null }) {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_auto_auto]">
        <div>
          <p className="text-base font-medium text-ink">Opiniated</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
            A survey rewards site. Survey availability depends on the provider, and a reward is added only after a
            verified completion.
          </p>
        </div>
        <nav aria-label="Product" className="grid content-start gap-2 text-sm">
          <p className="text-[13px] font-medium text-ink">Product</p>
          <FooterLink href="/how-it-works">How it works</FooterLink>
          <FooterLink href="/about">About</FooterLink>
          <FooterLink href="/help">Help</FooterLink>
          <FooterLink href="/contact">Contact</FooterLink>
        </nav>
        <nav aria-label="Account" className="grid content-start gap-2 text-sm">
          <p className="text-[13px] font-medium text-ink">Account</p>
          <FooterLink href="/register">Sign up</FooterLink>
          <FooterLink href="/login">Log in</FooterLink>
          <FooterLink href="/terms">Terms</FooterLink>
          <FooterLink href="/privacy">Privacy</FooterLink>
          {supportEmail ? (
            <a className="text-muted transition-colors duration-150 hover:text-ink" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </a>
          ) : (
            <span className="text-muted">Set NEXT_PUBLIC_SUPPORT_EMAIL to a monitored inbox before launch.</span>
          )}
        </nav>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-muted transition-colors duration-150 hover:text-ink">
      {children}
    </Link>
  );
}
