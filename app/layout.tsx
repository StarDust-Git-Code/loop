import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const serif = Fraunces({ subsets: ["latin"], axes: ["opsz"], variable: "--font-serif", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

const TITLE = "Loopmates: a house full of AI helpers, living on your computer";
const DESCRIPTION =
  "Loopmates is a team of 19 AI Mates that lives on your own computer. Tell them what you need: they plan it, do it, and ask you before anything important goes out. Your keys and files stay home.";

export const metadata: Metadata = {
  metadataBase: new URL("https://loopmates.com"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://loopmates.com",
    siteName: "Loopmates",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#120e2e", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The inline script adds classes to <html> before React hydrates, hence suppressHydrationWarning.
    <html lang="en" className={`${serif.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        {/* "film" turns the page into the scroll-driven house before first paint. Without it (no JS, or
            reduced motion) the same words read as an ordinary page of stacked sections. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "var d=document.documentElement;d.classList.add('js');if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){d.classList.add('film')}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
