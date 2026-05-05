import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DungeonMaster AI",
  description: "MVP RPG text-based cu 2 agenti Claude si reguli deterministe de joc.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro" className={`${displayFont.variable} ${monoFont.variable}`}>
      <body className="bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
