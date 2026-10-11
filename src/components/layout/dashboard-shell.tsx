"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/lib/auth/actions";
import { Logo } from "@/components/layout/logo";

const items = [
  { href: "/dashboard", label: "Overview" },
  { href: "/surveys", label: "Surveys" },
  { href: "/rewards", label: "Rewards" },
  { href: "/activity", label: "Activity" },
  { href: "/account", label: "Account" },
];

export function DashboardShell({
  user,
  children,
}: {
  user: { name: string | null; email: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const label = user.name || user.email;

  return (
    <div className="min-h-screen bg-surface md:grid md:grid-cols-[220px_1fr]">
      <aside className="hidden border-r border-line bg-white md:flex md:flex-col">
        <div className="flex h-14 items-center border-b border-line px-4">
          <Logo />
        </div>
        <nav className="grid gap-1 p-3 text-sm" aria-label="Account">
          {items.map((item) => (
            <NavLink key={item.href} href={item.href} active={pathname === item.href || pathname.startsWith(`${item.href}/`)}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-line p-3 text-sm">
          <p className="truncate font-medium text-ink">{label}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
          <form action={logoutAction} className="mt-2">
            <button type="submit" className="text-sm text-muted hover:text-ink">
              Log out
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex h-14 items-center justify-between border-b border-line bg-white px-4 md:hidden">
          <Logo />
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-md border border-line px-3 text-sm"
            aria-expanded={open}
            aria-controls="dashboard-menu"
            onClick={() => setOpen((value) => !value)}
          >
            Menu
          </button>
        </header>
        {open ? (
          <nav id="dashboard-menu" className="border-b border-line bg-white px-4 py-3 md:hidden" aria-label="Account">
            <ul className="grid gap-1 text-sm">
              {items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="block py-1.5" onClick={() => setOpen(false)}>
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <form action={logoutAction}>
                  <button type="submit" className="py-1.5 text-muted">
                    Log out
                  </button>
                </form>
              </li>
            </ul>
          </nav>
        ) : null}
        <div className="mx-auto w-full max-w-4xl px-4 py-6">{children}</div>
      </div>
    </div>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-3 py-2 ${active ? "bg-success-bg font-medium text-brand" : "text-ink hover:bg-surface"}`}
    >
      {children}
    </Link>
  );
}
