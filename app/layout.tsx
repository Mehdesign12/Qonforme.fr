import type { Metadata } from "next";
import { DM_Sans, DM_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { ReduxProvider } from "@/components/shared/ReduxProvider";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { AutoDarkMode } from "@/components/layout/AutoDarkMode";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://qonforme.fr"),
  title: {
    default: "Qonforme — Facturation électronique simplifiée",
    template: "%s | Qonforme",
  },
  description:
    "Créez et transmettez vos factures électroniques en toute conformité avec la réglementation française. Simple, rapide, conforme.",
  keywords: ["facturation électronique", "facture", "artisan", "TPE", "Factur-X", "PPF"],
  alternates: {
    canonical: "/",
  },

  /* ── Favicon & icônes ── */
  icons: {
    icon: [
      { url: "/favicon.ico",        sizes: "16x16 32x32", type: "image/x-icon" },
      { url: "/favicon-16x16.png",  sizes: "16x16",  type: "image/png" },
      { url: "/favicon-32x32.png",  sizes: "32x32",  type: "image/png" },
      { url: "/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/web-app-manifest-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple:   [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },

  /* ── Open Graph ── */
  openGraph: {
    title:       "Qonforme — Facturation électronique simplifiée",
    description: "Facturation électronique conforme pour artisans et TPE",
    url:         "https://qonforme.fr",
    siteName:    "Qonforme",
    locale:      "fr_FR",
    type:        "website",
    images: [
      {
        url:    "/api/og?title=Facturation%20%C3%A9lectronique%20simplifi%C3%A9e&subtitle=Conforme%20Factur-X%20EN%2016931%20%E2%80%94%20Pour%20artisans%20et%20TPE",
        width:  1200,
        height: 630,
        alt:    "Qonforme — Facturation électronique",
      },
    ],
  },

  /* ── Twitter Card ── */
  twitter: {
    card:        "summary_large_image",
    title:       "Qonforme — Facturation électronique simplifiée",
    description: "Facturation électronique conforme pour artisans et TPE",
    images:      ["/api/og?title=Facturation%20%C3%A9lectronique%20simplifi%C3%A9e&subtitle=Conforme%20Factur-X%20EN%2016931%20%E2%80%94%20Pour%20artisans%20et%20TPE"],
  },

  /* ── Google Search Console ── */
  ...(process.env.NEXT_PUBLIC_GSC_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GSC_VERIFICATION } }
    : {}),

  /* ── PWA / mobile ── */
  manifest: "/manifest.json",
  appleWebApp: {
    capable:    true,
    title:      "Qonforme",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* theme-color pour Chrome Android et Safari iOS */}
        <meta name="theme-color" content="#2563EB" />
        {/* Empêche le zoom auto sur les inputs iOS */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        {/* Hreflang — site monolingue FR */}
        <link rel="alternate" hrefLang="fr" href="https://qonforme.fr/" />
        <link rel="alternate" hrefLang="x-default" href="https://qonforme.fr/" />
        {/* JSON-LD — Organization + WebApplication */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  name: "Qonforme",
                  url: "https://qonforme.fr",
                  logo: "https://qonforme.fr/og-image.png",
                  description:
                    "Facturation électronique simplifiée pour artisans et TPE, conforme à la réglementation française 2026.",
                  contactPoint: {
                    "@type": "ContactPoint",
                    contactType: "Customer Service",
                    email: "contact@qonforme.fr",
                    availableLanguage: "French",
                  },
                  areaServed: "FR",
                },
                {
                  "@type": "WebApplication",
                  name: "Qonforme",
                  url: "https://qonforme.fr",
                  applicationCategory: "BusinessApplication",
                  operatingSystem: "All",
                  offers: [
                    {
                      "@type": "Offer",
                      name: "Starter",
                      price: "9",
                      priceCurrency: "EUR",
                      priceSpecification: {
                        "@type": "UnitPriceSpecification",
                        price: "9",
                        priceCurrency: "EUR",
                        unitText: "MONTH",
                      },
                      description:
                        "10 factures/mois, devis illimités, Factur-X EN 16931, archivage 10 ans.",
                    },
                    {
                      "@type": "Offer",
                      name: "Pro",
                      price: "19",
                      priceCurrency: "EUR",
                      priceSpecification: {
                        "@type": "UnitPriceSpecification",
                        price: "19",
                        priceCurrency: "EUR",
                        unitText: "MONTH",
                      },
                      description:
                        "Factures illimitées, relances automatiques, tableau de bord CA, support prioritaire.",
                    },
                  ],
                },
              ],
            }),
          }}
        />
      </head>
      <body
        className={`${dmSans.variable} ${dmMono.variable} ${bricolageGrotesque.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AutoDarkMode />
          <ReduxProvider>
            {children}
            <Toaster richColors position="top-right" />
          </ReduxProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
