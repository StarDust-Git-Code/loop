import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://loopdots.com"),
  title: "Loop — a workspace for your fluffy agents",
  description:
    "Loop is an agentic workspace. Specialist agents (Dots) plan, research, browse and build together while you stay in control.",
  openGraph: {
    title: "Loop — a workspace for your fluffy agents",
    description:
      "Specialist agents plan, research, browse and build together — while you stay in control.",
    url: "https://loopdots.com",
    siteName: "Loop",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Marks JS as available so GSAP-controlled elements can start hidden without a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "document.documentElement.classList.add('js');if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('rm')}",
          }}
        />
        <noscript>
          <style>{`.js [data-reveal],.js .hero-h1{opacity:1!important;visibility:visible!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body>{children}</body>
    </html>
  );
}
