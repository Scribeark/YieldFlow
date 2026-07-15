import type { Metadata, Viewport } from "next";
import NavigationShell from "@/components/layout/NavigationShell";
import OfflineBanner from "@/components/ui/OfflineBanner";
import ErrorBoundary from "@/components/ErrorBoundary";
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
  ],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Agri-Data Hub",
  },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased font-sans"
    >
      <body className="min-h-full">
        <OfflineBanner />
        <ErrorBoundary>
          <NavigationShell>{children}</NavigationShell>
        </ErrorBoundary>
      </body>
    </html>
  );
}
