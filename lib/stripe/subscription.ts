import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import type { PlanId, BillingPeriod } from './plans'
import { canIssueInvoices, SUBSCRIPTION_REQUIRED, type SubscriptionStatus } from './access'

export interface Subscription {
  id: string
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  plan: PlanId
  billing_period: BillingPeriod
  status: SubscriptionStatus
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

  const upsertData: Record<string, unknown> = {
    user_id: params.userId,
    stripe_customer_id: params.stripeCustomerId,
    stripe_subscription_id: params.stripeSubscriptionId,
    stripe_price_id: params.stripePriceId,
    plan: params.plan,
    billing_period: params.billingPeriod,
    status: params.status,
    current_period_end: params.currentPeriodEnd?.toISOString() ?? null,
    updated_at: new Date().toISOString(),
  }
  // canceled_at n'est inclus que quand il a une valeur réelle
  // (évite PGRST204 si la colonne n'existe pas encore en DB)
  if (params.canceledAt instanceof Date) {
    upsertData.canceled_at = params.canceledAt.toISOString()
  }

  const { error } = await supabase
    .from('subscriptions')
    .upsert(upsertData, { onConflict: 'user_id' })

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
 * Mur de paiement côté serveur : à appeler dans toute route qui émet une
 * facture (envoi, passage hors brouillon) ou qui relance un client.
 *
 * Renvoie une réponse 402 `SUBSCRIPTION_REQUIRED` si le compte n'a pas de
 * formule active, sinon `null`. Masquer un bouton ne protège rien : c'est la
 * route qui refuse.
 *
 * Erreur de lecture (réseau, timeout) : 503 plutôt qu'un faux « sans formule »,
 * qui afficherait le mur de paiement à un abonné (même piège que le middleware,
 * voir CLAUDE.md).
 */
export async function requireIssuingAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<NextResponse | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[requireIssuingAccess] Lecture abonnement impossible:', error)
    return NextResponse.json(
      { error: 'Vérification de votre formule impossible pour le moment. Réessayez dans un instant.' },
      { status: 503 }
    )
  }

  if (canIssueInvoices(data?.status)) return null

  return NextResponse.json(
    {
      error: 'Choisissez une formule pour envoyer vos factures. Vos devis restent gratuits.',
      code: SUBSCRIPTION_REQUIRED,
    },
    { status: 402 }
  )
}
