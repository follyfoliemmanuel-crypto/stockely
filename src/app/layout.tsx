import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Stockely — Votre stock, votre commerce, sous contrôle.",
    template: "%s · Stockely",
  },
  description:
    "Stockely réunit inventaire, caisse et rapports dans un espace unique. Chaque mouvement est tracé, chaque vente vérifiée côté serveur.",
  applicationName: "Stockely",
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Stockely — Gestion de stock et de ventes",
    description:
      "Inventaire, caisse, clients, fournisseurs et rapports. Une source de vérité pour votre commerce.",
    type: "website",
    locale: "fr_FR",
    siteName: "Stockely",
  },
};

export const viewport: Viewport = {
  themeColor: "#F4F4ED",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="fr"
      data-scroll-behavior="smooth"
      className={`${manrope.variable} ${plexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
