import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import type { PlanId, BillingPeriod } from './plans'

export interface Subscription {
  id: string
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  plan: PlanId
  billing_period: BillingPeriod
  status: 'active' | 'past_due' | 'canceled' | 'incomplete'
  current_period_end: string | null
  canceled_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Récupère l'abonnement de l'utilisateur connecté (côté serveur, avec cookies)
 * Retourne null si aucun abonnement trouvé
 */
export async function getUserSubscription(): Promise<Subscription | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error || !data) return null
  return data as Subscription
}

/**
 * Récupère l'abonnement par user_id (admin, utilisé dans les webhooks)
 */
export async function getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) return null
  return data as Subscription
}

/**
 * Récupère l'abonnement par stripe_customer_id (admin, utilisé dans les webhooks)
 */
export async function getSubscriptionByCustomerId(customerId: string): Promise<Subscription | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single()

  if (error || !data) return null
  return data as Subscription
}

/**
 * Crée ou met à jour un abonnement (admin, utilisé dans les webhooks)
 */
export async function upsertSubscription(params: {
  userId: string
  stripeCustomerId: string
  stripeSubscriptionId: string
  stripePriceId: string
  plan: PlanId
  billingPeriod: BillingPeriod
  status: Subscription['status']
  currentPeriodEnd: Date | null
  canceledAt?: Date | null
}): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('subscriptions')
    .upsert(
      {
        user_id: params.userId,
        stripe_customer_id: params.stripeCustomerId,
        stripe_subscription_id: params.stripeSubscriptionId,
        stripe_price_id: params.stripePriceId,
        plan: params.plan,
        billing_period: params.billingPeriod,
        status: params.status,
        current_period_end: params.currentPeriodEnd?.toISOString() ?? null,
        canceled_at: params.canceledAt?.toISOString() ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) {
    console.error('[upsertSubscription] Erreur:', error)
    throw new Error(`Impossible de sauvegarder l'abonnement: ${error.message}`)
  }
}

/**
 * Met à jour uniquement le statut d'un abonnement (admin)
 */
export async function updateSubscriptionStatus(
  stripeSubscriptionId: string,
  status: Subscription['status'],
  extra?: { currentPeriodEnd?: Date; canceledAt?: Date }
): Promise<void> {
  const supabase = createAdminClient()

  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (extra?.currentPeriodEnd) {
    updateData.current_period_end = extra.currentPeriodEnd.toISOString()
  }
  if (extra?.canceledAt) {
    updateData.canceled_at = extra.canceledAt.toISOString()
  }

  const { error } = await supabase
    .from('subscriptions')
    .update(updateData)
    .eq('stripe_subscription_id', stripeSubscriptionId)

  if (error) {
    console.error('[updateSubscriptionStatus] Erreur:', error)
    throw new Error(`Impossible de mettre à jour le statut: ${error.message}`)
  }
}

/**
 * Vérifie si l'utilisateur a un accès actif (abonnement active)
 */
export function isSubscriptionActive(sub: Subscription | null): boolean {
  if (!sub) return false
  return sub.status === 'active'
}

/**
 * Vérifie si la création de facture est autorisée
 * Retourne true si autorisé, false si bloqué (limite starter atteinte)
 */
export async function canCreateInvoice(userId: string, sub: Subscription | null): Promise<{
  allowed: boolean
  reason?: string
  invoicesThisMonth?: number
  limit?: number
}> {
  if (!sub || sub.status !== 'active') {
    return { allowed: false, reason: 'no_active_subscription' }
  }

  // Plan Pro : aucune restriction
  if (sub.plan === 'pro') {
    return { allowed: true }
  }

  // Plan Starter : max 10 factures/mois
  const supabase = createAdminClient()
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count, error } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString())

  if (error) {
    console.error('[canCreateInvoice] Erreur count:', error)
    return { allowed: true } // fail open pour ne pas bloquer l'utilisateur sur erreur technique
  }

  const invoicesThisMonth = count ?? 0
  const limit = 10

  if (invoicesThisMonth >= limit) {
    return {
      allowed: false,
      reason: 'starter_limit_reached',
      invoicesThisMonth,
      limit,
    }
  }

  return { allowed: true, invoicesThisMonth, limit }
}
