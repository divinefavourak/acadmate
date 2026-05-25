import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider";

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
  title: "Acadmate CBT Practice",
  description: "Advanced CBT practice for UTME and Post-UTME exams",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Acadmate",
  },
  icons: {
    icon: "/images/logo.jpg",
    apple: "/images/logo.jpg",
    shortcut: "/images/logo.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('acadmate-theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
