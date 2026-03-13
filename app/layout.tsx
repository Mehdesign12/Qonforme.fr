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
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Qonforme — Facturation électronique simplifiée",
    template: "%s | Qonforme",
  },
  description:
    "Créez et transmettez vos factures électroniques en toute conformité avec la réglementation française. Simple, rapide, conforme.",
  keywords: ["facturation électronique", "facture", "artisan", "TPE", "Factur-X", "PPF"],

  /* ── Favicon & icônes ── */
  icons: {
    icon: [
      { url: "/favicon.ico",        sizes: "any"             },
      { url: "/favicon-16x16.png",  sizes: "16x16",  type: "image/png" },
      { url: "/favicon-32x32.png",  sizes: "32x32",  type: "image/png" },
    ],
    apple:   [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    other:   [{ rel: "manifest", url: "/manifest.json" }],
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
        url:    "/og-image.png",
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
    images:      ["/og-image.png"],
  },

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
