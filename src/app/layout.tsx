import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || "https://play.mtgguessr.io"
  ),
  title: "MTG Guess the Card — A Magic: The Gathering Guessing Game",
  description:
    "A free Magic: The Gathering guessing game — ask yes/no questions to identify the mystery card. Like 20 Questions for MTG! Challenge your friends with 1,000 well-known cards.",
  keywords: ["MTG", "Magic: The Gathering", "guessing game", "quiz", "guess the card", "20 questions", "card game", "MTG quiz", "magic quiz game"],
  openGraph: {
    title: "MTG Guess the Card — A Magic: The Gathering Guessing Game",
    description: "A free Magic: The Gathering guessing game — ask yes/no questions to identify the mystery card. Like 20 Questions for MTG! Challenge your friends.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MTG Guess the Card — Magic: The Gathering Guessing Game",
    description: "A free MTG guessing game — ask yes/no questions to identify the mystery card. Like 20 Questions for Magic!",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
