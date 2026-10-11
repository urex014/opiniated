import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 text-[15px] font-medium text-ink">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <rect width="22" height="22" rx="4" fill="#247A57" />
        <path d="M6 11.2 9.2 14.5 16.2 7.5" fill="none" stroke="white" strokeWidth="1.8" />
      </svg>
      Opiniated
    </Link>
  );
}
