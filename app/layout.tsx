import type { Metadata } from "next";
import { DM_Sans, DM_Mono, Bricolage_Grotesque, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { ReduxProvider } from "@/components/shared/ReduxProvider";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { AutoDarkMode } from "@/components/layout/AutoDarkMode";
import { PostHogProvider } from "@/components/shared/PostHogProvider";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AppleSplashScreens } from "@/components/pwa/AppleSplashScreens";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { ThemeColorSync } from "@/components/pwa/ThemeColorSync";
import { StandaloneFlag } from "@/components/pwa/StandaloneFlag";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { PLANS, VAT_COLLECTED } from "@/lib/stripe/plans";
import { PUBLISHER } from "@/lib/legal/publisher";
import { SentryReplay } from "@/components/shared/SentryReplay";
import { CookieBanner } from "@/components/consent/CookieBanner";
import { TrackingLoader } from "@/components/consent/TrackingLoader";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

/* Références et numéros (application) : jamais au-dessus de la ligne de flottaison
   des pages publiques, donc pas préchargée sur chaque page (LCP mobile, PushRank). */
const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
  preload: false,
});

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

/* Seconde voix des titres publics (« titres en deux voix », DECISIONS § 6) : un mot en italique. */
const instrumentSerif = Instrument_Serif({
  variable: "--font-serif-accent",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://qonforme.fr"),
  title: {
    // Accueil : requête visée d'abord (« logiciel devis facturation », 1 600 recherches/mois), marque à la fin
    default: "Logiciel de devis et facturation pour artisans du bâtiment | Qonforme",
    template: "%s | Qonforme",
  },
  description:
    "Le logiciel de devis et de facturation des artisans du bâtiment : devis gratuits et illimités, factures aux mentions obligatoires, relances automatiques.",
  keywords: ["logiciel de facturation", "logiciel facturation en ligne", "facturation électronique", "facture", "artisan", "TPE", "Factur-X", "PPF"],
  // Pas de canonical ici : chaque page déclare le sien. Un canonical « / » dans le layout
  // racine était hérité par toute page qui n'en avait pas (les sous-pages de la démo se
  // présentaient à Google comme l'accueil). Celui de l'accueil est dans app/page.tsx.

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
    title:       "Qonforme — Logiciel de facturation des artisans du bâtiment",
    description: "Devis gratuits et illimités. Vous payez quand vous facturez.",
    url:         "https://qonforme.fr",
    siteName:    "Qonforme",
    locale:      "fr_FR",
    type:        "website",
    images: [
      {
        url:    "/api/og?title=La%20facturation%20des%20artisans%20du%20b%C3%A2timent&subtitle=Devis%20gratuits%20et%20illimit%C3%A9s%20%E2%80%94%20Vous%20payez%20quand%20vous%20facturez",
        width:  1200,
        height: 630,
        alt:    "Qonforme — La facturation des artisans du bâtiment",
      },
    ],
  },

  /* ── Twitter Card ── */
  twitter: {
    card:        "summary_large_image",
    title:       "Qonforme — Logiciel de facturation des artisans du bâtiment",
    description: "Devis gratuits et illimités. Vous payez quand vous facturez.",
    images:      ["/api/og?title=La%20facturation%20des%20pros%20du%20b%C3%A2timent&subtitle=Devis%20gratuits%20et%20illimit%C3%A9s%20%E2%80%94%20Vous%20payez%20quand%20vous%20facturez"],
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
        <meta name="theme-color" content="#F6F8FB" />
        {/* Empêche le zoom auto sur les inputs iOS */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        {/* Écrans de démarrage iOS — sinon l'app lancée depuis l'écran d'accueil démarre en blanc */}
        <AppleSplashScreens />
        {/* Pas de hreflang : le site n'a qu'une langue. Les deux liens fixes qui étaient ici
            disaient sur chaque page que sa version française était l'accueil. */}
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
                  legalName: PUBLISHER.name,
                  url: "https://qonforme.fr",
                  logo: "https://qonforme.fr/og-image.png",
                  description:
                    "Qonforme, le logiciel de devis et de facturation des artisans du bâtiment.",
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
                  description: "Logiciel de devis et de facturation pour les artisans du batiment. Devis gratuits et illimites.",
                  screenshot: "https://qonforme.fr/og-image.png",
                  featureList: "Devis, Factures, Avoirs, Bons de commande, Relances automatiques, Export FEC, Envoi par email",
                  // Aucune note ni nombre d'avis : Qonforme n'a pas d'avis vérifiables
                  // à publier (règle « aucune affirmation invérifiable », CLAUDE.md).
                  offers: [
                    {
                      "@type": "Offer",
                      name: "Devis",
                      price: "0",
                      priceCurrency: "EUR",
                      description: "Devis illimites, sans carte bancaire.",
                    },
                    {
                      "@type": "Offer",
                      name: "Essentiel",
                      price: String(PLANS.starter.monthlyPrice),
                      priceCurrency: "EUR",
                      priceSpecification: {
                        "@type": "UnitPriceSpecification",
                        price: String(PLANS.starter.monthlyPrice),
                        priceCurrency: "EUR",
                        unitText: "MONTH",
                        // Sans TVA collectée, le prix affiché est le prix payé
                        ...(VAT_COLLECTED ? { valueAddedTaxIncluded: false } : {}),
                      },
                      description: `Factures et avoirs illimites, envoi par email, relances automatiques, export FEC. ${PLANS.starter.yearlyMonthlyEquivalent} EUR par mois a l'annee.`,
                    },
                  ],
                },
              ],
            }),
          }}
        />
      </head>
      <body
        className={`${dmSans.variable} ${dmMono.variable} ${bricolageGrotesque.variable} ${instrumentSerif.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AutoDarkMode />
          {/* PWA — sans rendu visible sauf OfflineBanner et InstallPrompt */}
          <ThemeColorSync />
          <StandaloneFlag />
          <ServiceWorkerRegister />
          <SentryReplay />
          <PostHogProvider>
            <ReduxProvider>
              <OfflineBanner />
              {children}
              <InstallPrompt />
              <Toaster richColors position="top-right" />
            </ReduxProvider>
          </PostHogProvider>
          <Analytics />
          <SpeedInsights />
          {/*
           * Traceurs publicitaires (pixel Meta) : chargés seulement après l'accord du
           * visiteur, jamais sur les pages des clients de l'artisan (lib/consent.ts).
           * Pas de balise <noscript> de suivi : sans JavaScript, aucun traceur ne part.
           */}
          <TrackingLoader />
          <CookieBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
