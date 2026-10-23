import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import { buildSubscriptionActivatedEmail } from '@/lib/email/templates/subscription-activated'
import type { BillingPeriod, PlanId } from './plans'

/**
 * Envoie l'email de confirmation d'abonnement. Ne lève jamais : un email
 * manquant ne doit pas faire échouer l'activation de la formule.
 */
export async function sendActivationEmail(params: {
  userId: string
  plan: PlanId
  period: BillingPeriod
  nextPaymentAt: Date | null
}): Promise<void> {
  try {
    const { data } = await createAdminClient().auth.admin.getUserById(params.userId)
    const to = data?.user?.email
    if (!to) return
    const { subject, html } = buildSubscriptionActivatedEmail(params)
    await sendEmail({ to, subject, html })
  } catch (err) {
    console.error('[activation-email] Envoi impossible:', err)
  }
}
