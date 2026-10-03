import { withSentryConfig } from '@sentry/nextjs'

/**
 * Formule Artisan en vente : ses deux prix Stripe sont configurés. Les
 * variables de prix ne sont lues que côté serveur ; cette valeur dérivée est
 * inlinée au build pour le serveur comme pour le navigateur (même règle que
 * isArtisanOnSale, lib/stripe/plans.ts). Après avoir renseigné les prix dans
 * Vercel, redéployer.
 */
const artisanOnSale = Boolean(process.env.STRIPE_PRICE_ARTISAN_MONTHLY?.trim()) && Boolean(process.env.STRIPE_PRICE_ARTISAN_YEARLY?.trim())

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_ARTISAN_ON_SALE: artisanOnSale ? 'true' : 'false',
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lxnowrmyyaylvnognifu.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  async redirects() {
    return [
      // Pages comparatifs retirées le 02/10/2026 : elles nommaient des
      // concurrents, ce que les décisions du fondateur interdisent dans tout
      // contenu public (CLAUDE.md). Redirection permanente pour les liens indexés.
      { source: '/comparatif', destination: '/pricing', permanent: true },
      { source: '/comparatif/:slug*', destination: '/pricing', permanent: true },
    ]
  },

  async headers() {
    return [
      {
        // Le service worker ne doit jamais être servi depuis le cache HTTP,
        // sinon une version obsolète continuerait de piloter l'app.
        // `Service-Worker-Allowed: /` autorise la portée racine.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }],
      },
      {
        // Splash screens et icônes maskable sont versionnés par leur nom de fichier.
        source: '/:dir(splash|icons)/:file*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  // Variables d'environnement à configurer sur Vercel :
  //   SENTRY_ORG      → slug de ton organisation Sentry
  //   SENTRY_PROJECT  → slug du projet Sentry
  //   SENTRY_AUTH_TOKEN → token pour upload des source maps
  org:     process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Cache les source maps au navigateur (sécurité)
  hideSourceMaps: true,

  // Désactive les logs Sentry dans la console de build
  silent: true,

  // Upload les source maps pour des stack traces lisibles dans Sentry
  widenClientFileUpload: true,

  // Désactive les tree-shaking logs de Sentry (réduit la taille du bundle)
  disableLogger: true,

  // Pas besoin des cron monitors Vercel pour l'instant
  automaticVercelMonitors: false,
})
