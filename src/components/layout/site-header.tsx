"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/layout/logo";

const links = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/about", label: "About" },
  { href: "/help", label: "Help" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm md:flex" aria-label="Primary">
          {links.map((link) => (
            <HeaderLink key={link.href} href={link.href} active={pathname === link.href}>
              {link.label}
            </HeaderLink>
          ))}
          <HeaderLink href="/login" active={pathname === "/login"}>
            Log in
          </HeaderLink>
          <Link href="/register" className="btn btn-primary">
            Sign up
          </Link>
        </nav>
        <button
          type="button"
          className="btn btn-secondary desktop-only-hidden md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      <div className={`menu-panel desktop-only-hidden md:hidden ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden" inert={open ? undefined : true}>
          <nav id="mobile-nav" className="border-t border-line px-4 py-3" aria-label="Mobile">
            <ul className="grid gap-1 text-sm">
              {links.map((link) => (
                <li key={link.href}>
                  <MobileLink href={link.href} active={pathname === link.href} onClick={() => setOpen(false)}>
                    {link.label}
                  </MobileLink>
                </li>
              ))}
              <li>
                <MobileLink href="/login" active={pathname === "/login"} onClick={() => setOpen(false)}>
                  Log in
                </MobileLink>
              </li>
              <li className="pt-1">
                <Link href="/register" className="btn btn-primary w-full" onClick={() => setOpen(false)}>
                  Sign up
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}

function HeaderLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`border-b-2 py-1 transition-[color,border-color] duration-150 ${active ? "border-brand font-medium text-brand" : "border-transparent text-ink hover:text-brand"}`}
    >
      {children}
    </Link>
  );
}

function MobileLink({
  href,
  active,
  onClick,
  children,
}: {
  href: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={`block border-l-2 px-3 py-2 transition-colors duration-150 ${active ? "border-brand bg-brand-wash font-medium text-brand" : "border-transparent text-ink"}`}
    >
      {children}
    </Link>
  );
}
