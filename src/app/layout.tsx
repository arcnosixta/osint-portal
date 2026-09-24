import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import SmoothScroll from "@/components/SmoothScroll";
import { AnyaPortal } from "@/components/anya/AnyaPortal";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "OSINT Portal — Unified Open Source Intelligence",
  description:
    "Every OSINT tool in one place. Sherlock, netcat, nmap and dozens more — installed locally, orchestrated through one clean interface. Open source.",
  keywords: ["osint", "sherlock", "netcat", "nmap", "intelligence", "open source"],
  openGraph: {
    title: "OSINT Portal",
    description:
      "Unified open-source intelligence platform. Every tool, one interface.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-background font-sans text-foreground">
        <LanguageProvider>
          <SmoothScroll />
          <div id="top" />
          {children}
          <AnyaPortal />
        </LanguageProvider>
      </body>
    </html>
  );
}