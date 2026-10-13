import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Versus",
  description:
    "Head-to-head NBA 2K27 draft night. Draft balanced squads from real 2K27 ratings — modern, all-time or both — then spin for quarter length, rule twists and challenges.",
  openGraph: {
    title: "Versus | Giddey",
    description:
      "Head-to-head NBA 2K27 draft night. Draft balanced squads from real 2K27 ratings, then spin for the rules.",
  },
};

export default function VersusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
