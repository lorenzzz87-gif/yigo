import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yigo 易购 - B2B订货平台",
  description: "Yigo 易购 — 意大利华人B2B订货平台",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" className="h-full">
      <body className="min-h-full bg-gray-50">{children}</body>
    </html>
  );
}
