import type { Metadata, Viewport } from "next";
import NavigationShell from "@/components/layout/NavigationShell";
import { MapsProvider } from "@/components/providers/MapsProvider";
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
  // Read the Maps API key server-side. The key is passed to the MapsProvider
  // Client Component, making it available to the browser via context.
  // It will be visible in the browser (required by Maps JavaScript).
  const mapsApiKey =
    process.env.NEXT_PUBLIC_MAPS_PLATFORM_API_KEY ||
    process.env.Maps_Platform_API_Key ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    '';

  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased font-sans">
      <body className="min-h-full">
        <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
          <MapsProvider apiKey={mapsApiKey}>
            <div className="gradient-mesh"></div>
            <NavigationShell>{children}</NavigationShell>
          </MapsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
