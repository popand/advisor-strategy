// app/layout.tsx
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Advisor Strategy — Claude Cost/Quality Demo",
  description:
    "Compare Sonnet solo, Sonnet + Opus advisor, and Opus solo on any research query. Real token costs and quality scores.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
    >
      <body className="bg-canvas text-content min-h-screen">
        {children}
      </body>
    </html>
  );
}
