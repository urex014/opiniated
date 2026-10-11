"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/layout/logo";

const links = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav className="hidden items-center gap-5 text-sm text-ink md:flex" aria-label="Primary">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-brand">
              {link.label}
            </Link>
          ))}
          <Link href="/login" className="hover:text-brand">
            Log in
          </Link>
          <Link
            href="/register"
            className="inline-flex h-9 items-center rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-brand-hover"
          >
            Sign up
          </Link>
        </nav>
        <button
          type="button"
          className="inline-flex h-9 items-center rounded-md border border-line px-3 text-sm md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          Menu
        </button>
      </div>
      {open ? (
        <nav id="mobile-nav" className="border-t border-line px-4 py-3 md:hidden" aria-label="Mobile">
          <ul className="grid gap-2 text-sm">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="block py-1" onClick={() => setOpen(false)}>
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/login" className="block py-1" onClick={() => setOpen(false)}>
                Log in
              </Link>
            </li>
            <li>
              <Link href="/register" className="block py-1 font-medium text-brand" onClick={() => setOpen(false)}>
                Sign up
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
