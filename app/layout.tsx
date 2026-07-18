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
      <body className="min-h-full bg-gray-50 text-gray-900">
        <NavigationShell>{children}</NavigationShell>
      </body>
    </html>
  );
}
