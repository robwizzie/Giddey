import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Versus",
  description:
    "Head-to-head NBA 2K27 draft night. Draft balanced squads from real 2K27 ratings — modern, all-time or both — then spin for quarter length, rule twists and challenges.",
  openGraph: {
    title: "Versus | Giddey",
    description:
      "Head-to-head NBA 2K27 draft night. Draft balanced squads from real 2K27 ratings, then spin for the rules.",
  },
  // installable on its own: "Add to Home Screen" opens straight into Versus
  manifest: "/versus.webmanifest",
  icons: {
    icon: [{ url: "/versus-icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/versus-icons/apple-180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Versus",
    statusBarStyle: "black",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0e17",
};

export default function VersusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
