import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { PLANS, type PlanId } from '@/lib/stripe/plans'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── Auth admin ──────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

  if (!adminEmails.includes(user.email?.toLowerCase() ?? '')) {
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

  // ── Mise à jour Stripe (si abonnement actif) ────────────────────────────
  const shouldUpdateStripe =
    sub.stripe_subscription_id &&
    (sub.status === 'active' || sub.status === 'past_due')

  if (shouldUpdateStripe) {
    const billingPeriod = sub.billing_period as 'monthly' | 'yearly'
    const newPriceId = PLANS[newPlan as PlanId].stripePriceIds[billingPeriod]

    if (!newPriceId) {
      console.warn(`[admin/plan] Price ID manquant pour ${newPlan}/${billingPeriod} — mise à jour DB seulement`)
    } else {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id as string)
        const itemId = stripeSub.items.data[0]?.id

        if (!itemId) {
          return NextResponse.json({ error: 'Stripe : item de subscription introuvable' }, { status: 500 })
        }

        await stripe.subscriptions.update(sub.stripe_subscription_id as string, {
          items: [{ id: itemId, price: newPriceId }],
          proration_behavior: 'none',
        })
      } catch (err) {
        console.error('[admin/plan] Erreur Stripe:', err)
        return NextResponse.json({ error: 'Erreur lors de la mise à jour Stripe' }, { status: 500 })
      }
    }
  }

  // ── Mise à jour DB ──────────────────────────────────────────────────────
  const { error: updateError } = await admin
    .from('subscriptions')
    .update({
      plan: newPlan,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', targetUserId)

  if (updateError) {
    console.error('[admin/plan] Erreur DB:', updateError)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }

  console.log(`[admin/plan] Plan changé pour ${targetUserId} : ${sub.plan} → ${newPlan} (par ${user.email})`)

  return NextResponse.json({ success: true, plan: newPlan })
}
