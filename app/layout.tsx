import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider";
import VisitTracker from "./components/VisitTracker";
import RouteTitle from "./components/RouteTitle";
import {
  SITE_NAME,
  SITE_URL,
  SITE_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  canonicalUrl,
} from "@/lib/seo";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#6366f1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  // ── Core ────────────────────────────────────────────────────────────────
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} – Free JAMB CBT Practice & Post-UTME Past Questions in Nigeria`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "JAMB past questions",
    "JAMB CBT practice",
    "UTME practice",
    "Post-UTME past questions",
    "JAMB preparation Nigeria",
    "free JAMB practice",
    "Post-UTME UNILAG",
    "Post-UTME UI",
    "Post-UTME OAU",
    "Nigerian student exam prep",
    "JAMB study tips",
    "scholarships Nigeria",
  ],
  authors: [{ name: "Acadmate Business Consult", url: SITE_URL }],
  creator: "Acadmate Business Consult",
  publisher: "Acadmate Business Consult",

  // ── Canonical & alternates ──────────────────────────────────────────────
  alternates: { canonical: SITE_URL },

  // ── Robots ──────────────────────────────────────────────────────────────
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1 },
  },

  // ── PWA ─────────────────────────────────────────────────────────────────
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_NAME,
  },

  // ── Icons ────────────────────────────────────────────────────────────────
  icons: {
    icon: "/images/logo.jpg",
    apple: "/images/logo.jpg",
    shortcut: "/images/logo.jpg",
  },

  // ── Open Graph defaults ─────────────────────────────────────────────────
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} – Free JAMB CBT Practice & Post-UTME Past Questions`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: canonicalUrl(DEFAULT_OG_IMAGE),
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} – JAMB CBT Practice for Nigerian Students`,
      },
    ],
  },

  // ── Twitter / X card defaults ────────────────────────────────────────────
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} – Free JAMB CBT Practice`,
    description: SITE_DESCRIPTION,
    images: [canonicalUrl(DEFAULT_OG_IMAGE)],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  // Extract origin for preconnect (e.g. "https://api.acadmate.com.ng")
  let apiOrigin = "";
  try {
    if (apiUrl) apiOrigin = new URL(apiUrl).origin;
  } catch {
    // malformed env var — skip preconnect
  }

  return (
    <html
      lang="en-NG"
      className={`${outfit.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <Script id="theme-init" strategy="beforeInteractive" src="/theme-init.js" />
        {/* Resource hints — reduces latency for API and image CDN */}
        {apiOrigin && (
          <>
            <link rel="preconnect" href={apiOrigin} />
            <link rel="dns-prefetch" href={apiOrigin} />
          </>
        )}
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
      </head>
      <body className="min-h-full flex flex-col">
        <Analytics />
        <VisitTracker />
        <RouteTitle />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
