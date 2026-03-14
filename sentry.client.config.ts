import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Trace 10 % des requêtes en prod pour les performances (pas de surcharge)
  tracesSampleRate: 0.1,

  // Session replay uniquement sur erreur (économise le quota)
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.0,

  integrations: [Sentry.replayIntegration()],

  // Désactivé hors production
  enabled: process.env.NODE_ENV === 'production',
})
