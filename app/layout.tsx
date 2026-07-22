import type { Metadata, Viewport } from "next";
import NavigationShell from "@/components/layout/NavigationShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agri-Data Hub | Unified Agricultural Intelligence",
  description:
    "A unified agricultural information infrastructure connecting farmers, logistics carriers, and market administrators with real-time data analytics.",
  keywords: [
    "agriculture",
    "logistics",
    "IoT",
    "analytics",
    "supply chain",
    "farming",
  ]
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

import { ThemeProvider } from "@/components/providers/ThemeProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased font-sans">
      <body className="min-h-full">
        <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
          <div className="gradient-mesh"></div>
          <NavigationShell>{children}</NavigationShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
