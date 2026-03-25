import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || "https://play.mtgguessr.io"
  ),
  title: "MTG Guess the Card",
  description:
    "Can you guess the Magic: The Gathering card by asking yes/no questions?",
  openGraph: {
    title: "MTG Guess the Card",
    description: "Ask yes/no questions to identify the mystery Magic: The Gathering card. Challenge your friends!",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MTG Guess the Card",
    description: "Ask yes/no questions to identify the mystery Magic: The Gathering card.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <div className="flex-1">{children}</div>
        <footer className="text-center text-xs text-[var(--text-secondary)] py-4 px-6 opacity-60">
          Card data from <a href="https://scryfall.com" className="underline" target="_blank" rel="noopener noreferrer">Scryfall</a>. Not affiliated with Wizards of the Coast. &bull; v0.17
        </footer>
      </body>
    </html>
  );
}
