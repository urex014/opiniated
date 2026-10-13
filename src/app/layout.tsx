import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { CookieNotice } from "@/components/layout/cookie-notice";
import { OrganizationJsonLd } from "@/components/seo/organization-json-ld";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#247A57",
};

export const metadata: Metadata = {
  title: {
    default: "Opiniated",
    template: "%s · Opiniated",
  },
  description: "Share your views through online surveys and earn rewards for the time you spend participating.",
  applicationName: "Opiniated",
  manifest: "/site.webmanifest",
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
      </body>
    </html>
  );
}
