import type { Metadata } from "next";
import { DM_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "700"],
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-space-mono",
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Pulse Live Dashboard",
  description: "Real-time AI industry dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${dmSans.variable} ${spaceMono.variable} font-[family-name:var(--font-dm-sans)] antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
