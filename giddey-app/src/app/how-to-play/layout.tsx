import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How to Play",
  description:
    "Learn how to play Giddey — the daily basketball draft puzzle. Understand talent tiers, chemistry lines, grid positions, and draft odds.",
  openGraph: {
    title: "How to Play | Giddey",
    description:
      "Learn how to play Giddey — the daily basketball draft puzzle. Understand talent tiers, chemistry lines, grid positions, and draft odds.",
  },
};

export default function HowToPlayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
