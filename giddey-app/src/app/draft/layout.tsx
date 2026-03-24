import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Draft",
  description:
    "Draft 9 NBA players onto your grid. Build chemistry through shared teams, divisions, and draft years to maximize your score.",
  openGraph: {
    title: "Draft | Giddey",
    description:
      "Draft 9 NBA players onto your grid. Build chemistry through shared teams, divisions, and draft years to maximize your score.",
  },
};

export default function DraftLayout({ children }: { children: React.ReactNode }) {
  return children;
}
