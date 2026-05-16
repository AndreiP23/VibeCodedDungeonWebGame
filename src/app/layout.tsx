import type { Metadata } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";
import "./globals.css";

const displayFont = Press_Start_2P({
  variable: "--font-display",
  weight: ["400"],
  subsets: ["latin"],
});

const bodyFont = VT323({
  variable: "--font-body",
  weight: ["400"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DungeonMaster AI",
  description: "MVP text-based RPG with 2 Claude agents and deterministic game rules.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="bg-background text-foreground antialiased">
        <div className="torch-glow top-left" aria-hidden />
        <div className="torch-glow top-right" aria-hidden />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
