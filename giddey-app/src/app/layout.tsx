import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Giddey - Basketball Draft Puzzle",
  description: "The daily basketball draft puzzle game. Build the highest graded team through strategy and chemistry.",
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
