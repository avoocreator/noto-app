import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Noto — Catatan, Tugas & Kanvas",
  description:
    "Workspace pribadi ala Obsidian: catatan Markdown, todo list pintar, kanvas kreatif, widget HP, notifikasi bersuara kustom, dan 8 tema indah. Gratis selamanya.",
  applicationName: "Noto",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Noto",
  },
};

export const viewport: Viewport = {
  themeColor: "#101013",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {/* Layar pemuatan — dirender saat HTML pertama kali tampil,
            disembunyikan mulus oleh aplikasi begitu siap (lihat page.tsx) */}
        <div id="boot-splash" aria-hidden="true">
          <div className="splash-glow" />
          <img
            src="/icons/logo-128.png"
            alt=""
            width={128}
            height={128}
            className="splash-logo"
          />
          <div className="splash-wordmark">Noto</div>
          <div className="splash-tagline">Catatan · Tugas · Kanvas</div>
          <div className="splash-track">
            <div className="splash-bar" />
          </div>
          <div className="splash-foot">Menyiapkan workspace</div>
        </div>
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
