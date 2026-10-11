import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { readEnv } from "@/lib/env";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const supportEmail = readEnv().supportEmail;
  return (
    <>
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <SiteHeader />
      <main id="content" className="flex-1">
        {children}
      </main>
      <SiteFooter supportEmail={supportEmail} />
    </>
  );
}
