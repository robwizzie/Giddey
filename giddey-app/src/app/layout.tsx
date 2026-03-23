import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = "https://playgiddey.com";
const SITE_NAME = "Giddey";
const DESCRIPTION =
  "The daily basketball draft puzzle. Draft 9 players, build chemistry, and score big. Inspired by 2K MyTeam.";

export const metadata: Metadata = {
  title: {
    default: "Giddey — Basketball Draft Puzzle",
    template: "%s | Giddey",
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "basketball",
    "draft",
    "puzzle",
    "NBA",
    "2K",
    "MyTeam",
    "daily game",
    "chemistry",
    "Giddey",
    "sports game",
  ],
  authors: [{ name: "Giddey" }],
  creator: "Giddey",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "Giddey — Basketball Draft Puzzle",
    description: DESCRIPTION,
    url: SITE_URL,
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "Giddey logo" }],
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Giddey — Basketball Draft Puzzle",
    description: DESCRIPTION,
    images: ["/logo.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "512x512", type: "image/png" }],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0e17",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
