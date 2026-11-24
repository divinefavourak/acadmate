import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
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

// Reads the saved choice (ThemeProvider writes it), else the OS preference.
const THEME_INIT = `(function(){try{var s=localStorage.getItem("acadmate-theme");var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#0874d4",
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

  // Icons come from the file conventions: app/icon.svg and app/apple-icon.png.

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
        {/* Sets the theme class before first paint, so there is no light/dark flash.
            Inline on purpose: as a separate file it cost a request, and the auth
            middleware redirected it to /login for logged-out visitors. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
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
