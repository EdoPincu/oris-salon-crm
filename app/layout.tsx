import type { Metadata } from "next";
import { Heebo, Frank_Ruhl_Libre } from "next/font/google";
import "./globals.css";

// Hebrew-capable pairing replacing DM Sans / Libre Caslon Text, which ship
// only latin/latin-ext subsets (no Hebrew glyphs at all — Hebrew text would
// silently fall back to a system font otherwise). Frank Ruhl Libre keeps the
// same elegant-serif-display role Libre Caslon Text had; Heebo plays DM
// Sans's clean-sans-body role. Both carry Latin too, for service names,
// prices and phone numbers.
const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

const frankRuhlLibre = Frank_Ruhl_Libre({
  variable: "--font-frank-ruhl",
  weight: ["400", "700"],
  subsets: ["hebrew", "latin"],
});

export const metadata: Metadata = {
  title: "הסלון של אורי",
  description: "פגישות, לקוחות ותקבולים עבור הסלון של אורי.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} ${frankRuhlLibre.variable}`}>
        {children}
      </body>
    </html>
  );
}
