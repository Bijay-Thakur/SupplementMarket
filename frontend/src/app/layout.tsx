import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { publicEnv } from "@/lib/env/public";
import { DEFAULT_STORE_CONFIG } from "@/lib/config/store";
import { AppProviders } from "@/components/providers";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"],
});

function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return publicEnv.siteUrl;
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${DEFAULT_STORE_CONFIG.name} — Local Health Food & Supplements`,
    template: `%s · ${DEFAULT_STORE_CONFIG.name}`,
  },
  description:
    "Bronxville Natural Market — vitamins, supplements, and natural wellness products with store pickup and local delivery in Bronxville, NY.",
  applicationName: DEFAULT_STORE_CONFIG.name,
  openGraph: {
    type: "website",
    siteName: DEFAULT_STORE_CONFIG.name,
    locale: "en_US",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
