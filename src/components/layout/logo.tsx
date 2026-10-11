import Image from "next/image";
import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center">
      <Image
        src="/brand/opiniated-logo-compact.svg"
        alt="Opiniated"
        width={177}
        height={30}
        loading="eager"
        className="h-7 w-auto"
      />
    </Link>
  );
}
