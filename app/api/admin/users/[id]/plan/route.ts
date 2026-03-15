import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { PLANS, type PlanId } from '@/lib/stripe/plans'
import { isAdminAuthenticated } from '@/lib/admin-require'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── Auth admin ──────────────────────────────────────────────────────────
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // ── Validation input ────────────────────────────────────────────────────
  const { id: targetUserId } = await params
  const body = await request.json()
  const { newPlan } = body as { newPlan: unknown }

  if (newPlan !== 'starter' && newPlan !== 'pro') {
    return NextResponse.json({ error: 'Plan invalide' }, { status: 400 })
  }

  // ── Charger l'abonnement cible ──────────────────────────────────────────
  const admin = createAdminClient()
  const { data: sub, error: subError } = await admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', targetUserId)
    .single()

  if (subError || !sub) {
    return NextResponse.json({ error: 'Abonnement introuvable' }, { status: 404 })
  }

  if (sub.plan === newPlan) {
    return NextResponse.json({ error: 'Le plan est déjà ' + newPlan }, { status: 400 })
  }

  const billingPeriod = (sub.billing_period ?? 'monthly') as 'monthly' | 'yearly'
  const newPriceId = PLANS[newPlan as PlanId].stripePriceIds[billingPeriod]

  // ── Résoudre la subscription Stripe ────────────────────────────────────
  // Cas 1 : stripe_subscription_id présent en DB → utilisation directe
  // Cas 2 : manquant mais stripe_customer_id présent → recherche via API Stripe
  let resolvedSubId: string | null = sub.stripe_subscription_id ?? null

  if (!resolvedSubId && sub.stripe_customer_id) {
    try {
      const list = await stripe.subscriptions.list({
        customer: sub.stripe_customer_id,
        status: 'active',
        limit: 1,
      })
      if (list.data.length > 0) {
        resolvedSubId = list.data[0].id
        console.log(`[admin/plan] stripe_subscription_id trouvé via customer_id: ${resolvedSubId}`)
      }
    } catch (err) {
      console.error('[admin/plan] Erreur recherche Stripe par customer_id:', err)
    }
  }

  // ── Mise à jour Stripe ──────────────────────────────────────────────────
  const shouldUpdateStripe =
    resolvedSubId &&
    (sub.status === 'active' || sub.status === 'past_due' || sub.status === 'trialing' || sub.status === 'incomplete')

  if (shouldUpdateStripe && resolvedSubId) {
    if (!newPriceId) {
      console.warn(`[admin/plan] Price ID manquant pour ${newPlan}/${billingPeriod} — mise à jour DB seulement`)
    } else {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(resolvedSubId)
        const itemId = stripeSub.items.data[0]?.id

        if (!itemId) {
          return NextResponse.json({ error: 'Stripe : item de subscription introuvable' }, { status: 500 })
        }

        await stripe.subscriptions.update(resolvedSubId, {
          items: [{ id: itemId, price: newPriceId }],
          proration_behavior: 'none',
        })
        console.log(`[admin/plan] Stripe subscription ${resolvedSubId} mis à jour → ${newPlan}`)
      } catch (err) {
        console.error('[admin/plan] Erreur Stripe:', err)
        return NextResponse.json({ error: 'Erreur lors de la mise à jour Stripe' }, { status: 500 })
      }
    }
  }

  // ── Mise à jour DB ──────────────────────────────────────────────────────
  const dbUpdate: Record<string, unknown> = {
    plan: newPlan,
    updated_at: new Date().toISOString(),
  }
  // Sauvegarder le stripe_subscription_id si on vient de le découvrir
  if (resolvedSubId && !sub.stripe_subscription_id) {
    dbUpdate.stripe_subscription_id = resolvedSubId
  }

  const { error: updateError } = await admin
    .from('subscriptions')
    .update(dbUpdate)
    .eq('user_id', targetUserId)

  if (updateError) {
    console.error('[admin/plan] Erreur DB:', updateError)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }

  console.log(`[admin/plan] Plan changé pour ${targetUserId} : ${sub.plan} → ${newPlan} (par admin)`)

  return NextResponse.json({ success: true, plan: newPlan })
}
