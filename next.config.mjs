import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lxnowrmyyaylvnognifu.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
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
