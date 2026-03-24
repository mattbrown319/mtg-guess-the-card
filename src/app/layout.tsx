import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MTG Guess the Card",
  description:
    "Can you guess the Magic: The Gathering card by asking yes/no questions?",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
