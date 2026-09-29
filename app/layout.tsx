import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Divine Tarot | Book a Personal Reading with Bharti Singh",
  description:
    "India's No.1 Psychic Tarot Reader — Bharti Singh. Book a personal voice call reading covering Tarot, Astrology, Numerology, Kundli analysis, Psychic ability & more.",
  metadataBase: new URL("https://thedivinetarotonline.co.in"),
  openGraph: {
    title: "The Divine Tarot | Personal Reading Booking",
    description:
      "Book your personal Call Reading with Bharti Singh — Tarot, Astro, Numero, Kundli analysis & more.",
    type: "website",
    images: ["/logo.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#6d28d9",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
