import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { CookieNotice } from "@/components/layout/cookie-notice";
import { OrganizationJsonLd } from "@/components/seo/organization-json-ld";
import { siteOrigin } from "@/lib/site/origin";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const description = "Share your views through online surveys and earn rewards for the time you spend participating.";

export const viewport: Viewport = {
  themeColor: "#247A57",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {
    default: "Opiniated",
    template: "%s · Opiniated",
  },
  description,
  applicationName: "Opiniated",
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    siteName: "Opiniated",
    locale: "en",
    description,
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "Opiniated" }],
  },
  twitter: {
    card: "summary",
    description,
    images: ["/icons/icon-512.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <head>
        <OrganizationJsonLd />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <CookieNotice />
        <Analytics />
      </body>
    </html>
  );
}
