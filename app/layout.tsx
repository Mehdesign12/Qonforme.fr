import type { Metadata } from "next";
import { DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";
import { ReduxProvider } from "@/components/shared/ReduxProvider";
import { Toaster } from "@/components/ui/sonner";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "Qonforme — Facturation électronique simplifiée",
    template: "%s | Qonforme",
  },
  description:
    "Créez et transmettez vos factures électroniques en toute conformité avec la réglementation française. Simple, rapide, conforme.",
  keywords: ["facturation électronique", "facture", "artisan", "TPE", "Factur-X", "PPF"],
  openGraph: {
    title: "Qonforme — Facturation électronique simplifiée",
    description: "Facturation électronique conforme pour artisans et TPE",
    url: "https://qonforme.fr",
    siteName: "Qonforme",
    locale: "fr_FR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${dmMono.variable} font-sans antialiased bg-[#F8FAFC] text-[#0F172A]`}
      >
        <ReduxProvider>
          {children}
          <Toaster richColors position="top-right" />
        </ReduxProvider>
      </body>
    </html>
  );
}
