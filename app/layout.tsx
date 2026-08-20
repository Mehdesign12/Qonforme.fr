import type { Metadata } from "next";
import { DM_Sans, DM_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { ReduxProvider } from "@/components/shared/ReduxProvider";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { AutoDarkMode } from "@/components/layout/AutoDarkMode";
import { PostHogProvider } from "@/components/shared/PostHogProvider";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";
import { AppleSplashScreens } from "@/components/pwa/AppleSplashScreens";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { ThemeColorSync } from "@/components/pwa/ThemeColorSync";
import { StandaloneFlag } from "@/components/pwa/StandaloneFlag";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { NativeAppInit } from "@/components/native/NativeAppInit";
import { PrivacyScreen } from "@/components/native/PrivacyScreen";

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
    default: "Qonforme — Logiciel de facturation électronique 2026",
    template: "%s | Qonforme",
  },
  description:
    "Qonforme, le logiciel de facturation en ligne pour artisans et TPE. Créez et transmettez vos factures électroniques conformes Factur-X 2026 en quelques clics.",
  keywords: ["logiciel de facturation", "logiciel facturation en ligne", "facturation électronique", "facture", "artisan", "TPE", "Factur-X", "PPF"],
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
    title:       "Qonforme — Logiciel de facturation électronique 2026",
    description: "Le logiciel de facturation conforme pour artisans et TPE",
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
    title:       "Qonforme — Logiciel de facturation électronique 2026",
    description: "Le logiciel de facturation conforme pour artisans et TPE",
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
    /*
     * "default" : iOS réserve la barre d'état au-dessus de la webview et la
     * peint avec <meta name="theme-color">. Le contenu démarre donc sous la
     * barre, sans qu'aucun des ~20 layouts n'ait à gérer safe-area-inset-top.
     * "black-translucent" ferait passer le contenu dessous et exigerait ce
     * padding partout — un seul écran oublié masquerait l'heure.
     */
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
        {/*
         * theme-color = fond de l'app (--background), et non le bleu de marque :
         * en PWA plein écran, iOS peint la barre d'état avec cette couleur, juste
         * au-dessus d'un header clair. <ThemeColorSync /> la bascule en sombre
         * quand l'utilisateur change de thème.
         */}
        <meta name="theme-color" content="#F8FAFC" />
        {/* Empêche le zoom auto sur les inputs iOS */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        {/* Écrans de démarrage iOS — sinon l'app lancée depuis l'écran d'accueil démarre en blanc */}
        <AppleSplashScreens />
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
                    "Qonforme, le logiciel de facturation électronique pour artisans et TPE, conforme à la réglementation française 2026.",
                  contactPoint: {
                    "@type": "ContactPoint",
                    contactType: "Customer Service",
                    email: "contact@qonforme.fr",
                    availableLanguage: "French",
                  },
                  areaServed: "FR",
                },
                {
                  "@type": "SoftwareApplication",
                  name: "Qonforme",
                  url: "https://qonforme.fr",
                  applicationCategory: "BusinessApplication",
                  operatingSystem: "Web",
                  description: "Logiciel de facturation electronique pour artisans et TPE. Factures Factur-X conformes a la reforme 2026.",
                  screenshot: "https://qonforme.fr/og-image.png",
                  featureList: "Factur-X EN 16931, Devis, Factures, Avoirs, Relances automatiques, Export FEC, Envoi par email",
                  aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: "4.8",
                    ratingCount: "47",
                    bestRating: "5",
                    worstRating: "1",
                  },
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
                        "10 factures/mois, devis illimites, Factur-X EN 16931, archivage 10 ans.",
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
                        "Factures illimitees, relances automatiques, tableau de bord CA, support prioritaire.",
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
        {/* Meta Pixel — noscript fallback */}
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=1280812480690943&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AutoDarkMode />
          {/* PWA / app native — sans rendu visible sauf OfflineBanner et InstallPrompt */}
          <ThemeColorSync />
          <StandaloneFlag />
          <ServiceWorkerRegister />
          <NativeAppInit />
          <PrivacyScreen />
          <PostHogProvider>
            <ReduxProvider>
              <OfflineBanner />
              {children}
              <InstallPrompt />
              <Toaster richColors position="top-right" />
            </ReduxProvider>
          </PostHogProvider>
          <Analytics />
        </ThemeProvider>
        {/* Meta Pixel — script */}
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){
              n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;
              s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
              (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
              fbq('init','1280812480690943');
              fbq('track','PageView');
            `,
          }}
        />
      </body>
    </html>
  );
}
