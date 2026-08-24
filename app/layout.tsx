import type { Metadata } from "next";
import { DM_Sans, Libre_Caslon_Text } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const libreCaslon = Libre_Caslon_Text({
  variable: "--font-libre-caslon",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ori's Salon",
  description: "Appointments, clients and takings for Ori's Salon.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${libreCaslon.variable}`}>
        {children}
      </body>
    </html>
  );
}
