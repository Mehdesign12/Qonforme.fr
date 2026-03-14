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
