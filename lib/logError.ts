import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/server'

export type ErrorType =
  | 'webhook_stripe'
  | 'invoice_create'
  | 'invoice_send'
  | 'invoice_pdf'
  | 'auth_signup'
  | 'company_create'
  | 'payment_failed'
  | 'subscription_check'
  | (string & Record<never, never>) // autocomplétion tout en acceptant les string libres

interface LogErrorOptions {
  type: ErrorType
  message: string
  userId?: string
  context?: Record<string, unknown>
  /** Passe l'erreur originale pour avoir la stack trace dans Sentry */
  error?: unknown
}

/**
 * Double logging :
 * - Sentry   : alertes, stack traces, dashboard développeur
 * - Supabase : erreurs métier persistantes, consultables dans Supabase Studio
 *
 * Ne lève jamais d'exception — le logging ne doit jamais faire planter l'app.
 */
export async function logError({
  type,
  message,
  userId,
  context,
  error,
}: LogErrorOptions): Promise<void> {
  // ── 1. Sentry ──────────────────────────────────────────────────
  Sentry.withScope((scope) => {
    if (userId) scope.setUser({ id: userId })
    scope.setTag('error_type', type)
    if (context) scope.setExtras(context as Record<string, unknown>)

    if (error instanceof Error || (error && typeof error === 'object')) {
      Sentry.captureException(error)
    } else {
      Sentry.captureMessage(message, 'error')
    }
  })

  // ── 2. Supabase error_logs ──────────────────────────────────────
  try {
    const admin = createAdminClient()
    await admin.from('error_logs').insert({
      type,
      message,
      user_id: userId ?? null,
      context: context ?? null,
    })
  } catch {
    // Ne jamais propager une erreur du logger
    console.error('[logError] Échec écriture error_log:', { type, message })
  }
}
