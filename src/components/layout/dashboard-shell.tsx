"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/lib/auth/actions";
import { Logo } from "@/components/layout/logo";

const baseItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/surveys", label: "Surveys" },
  { href: "/rewards", label: "Rewards" },
  { href: "/referrals", label: "Referrals" },
  { href: "/payouts", label: "Payouts" },
  { href: "/activity", label: "Activity" },
  { href: "/account", label: "Account" },
];

export function DashboardShell({
  user,
  showAdmin = false,
  children,
}: {
  user: { name: string | null; email: string };
  showAdmin?: boolean;
  children: React.ReactNode;
}) {
  const items = showAdmin
    ? [
        ...baseItems,
        { href: "/admin/payouts", label: "Payout admin" },
        { href: "/admin/risk", label: "Risk review" },
        { href: "/admin/surveys", label: "Survey providers" },
        { href: "/admin/referrals", label: "Referrals admin" },
      ]
    : baseItems;
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const label = user.name || user.email;
  const initial = (user.name?.trim() || user.email).slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen bg-surface md:grid md:grid-cols-[232px_1fr]">
      <aside className="hidden border-r border-line bg-white md:flex md:flex-col">
        <div className="flex h-16 items-center border-b border-line px-4">
          <Logo />
        </div>
        <nav className="grid gap-0.5 p-3 text-sm" aria-label="Account">
          {items.map((item) => (
            <NavLink key={item.href} href={item.href} active={isActive(pathname, item.href)}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <AccountBlock label={label} email={user.email} initial={initial} />
      </aside>
      <div className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-line bg-white px-4 md:hidden">
          <Logo />
          <button
            type="button"
            className="btn btn-secondary desktop-only-hidden md:hidden"
            aria-expanded={open}
            aria-controls="dashboard-menu"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </header>
        <div className={`menu-panel desktop-only-hidden md:hidden ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
          <div className="overflow-hidden" inert={open ? undefined : true}>
            <nav id="dashboard-menu" className="border-b border-line bg-white px-3 py-3" aria-label="Account">
              <ul className="grid gap-0.5 text-sm">
                {items.map((item) => (
                  <li key={item.href}>
                    <NavLink href={item.href} active={isActive(pathname, item.href)} onClick={() => setOpen(false)}>
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-line pt-3">
                <AccountSummary label={label} email={user.email} initial={initial} />
                <form action={logoutAction} className="mt-2">
                  <button type="submit" className="px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:text-ink">
                    Log out
                  </button>
                </form>
                <p className="mt-2 flex flex-wrap gap-x-3 px-3 text-xs text-muted">
                  <Link href="/privacy" className="hover:text-ink">Privacy</Link>
                  <Link href="/terms" className="hover:text-ink">Terms</Link>
                  <Link href="/contact" className="hover:text-ink">Contact</Link>
                </p>
              </div>
            </nav>
          </div>
        </div>
        <div className="mx-auto w-full max-w-4xl px-4 py-6 md:py-8">{children}</div>
      </div>
    </div>
  );
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  active,
  onClick,
  children,
}: {
  href: string;
  active: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={`border-l-2 px-3 py-2 transition-[background-color,color,border-color] duration-150 ${active ? "border-brand bg-brand-wash font-medium text-brand" : "border-transparent text-ink hover:bg-surface"}`}
    >
      {children}
    </Link>
  );
}

function AccountBlock({ label, email, initial }: { label: string; email: string; initial: string }) {
  return (
    <div className="mt-auto border-t border-line p-3">
      <AccountSummary label={label} email={email} initial={initial} />
      <form action={logoutAction} className="mt-3">
        <button type="submit" className="px-1 text-sm text-muted transition-colors duration-150 hover:text-ink">
          Log out
        </button>
      </form>
      <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs text-muted">
        <Link href="/privacy" className="hover:text-ink">Privacy</Link>
        <Link href="/terms" className="hover:text-ink">Terms</Link>
        <Link href="/contact" className="hover:text-ink">Contact</Link>
      </p>
    </div>
  );
}

function AccountSummary({ label, email, initial }: { label: string; email: string; initial: string }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-wash text-sm font-medium text-brand" aria-hidden="true">
        {initial}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{label}</p>
        {label !== email ? <p className="truncate text-xs text-muted">{email}</p> : null}
      </div>
    </div>
  );
}
