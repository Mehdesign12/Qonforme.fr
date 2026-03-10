import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { PLANS, type PlanId, type BillingPeriod } from '@/lib/stripe/plans'
import { getSubscriptionByUserId } from '@/lib/stripe/subscription'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const { planId, billingPeriod } = body as { planId: PlanId; billingPeriod: BillingPeriod }

    // Valider les paramètres
    if (!planId || !['starter', 'pro'].includes(planId)) {
      return NextResponse.json({ error: 'Plan invalide' }, { status: 400 })
    }
    if (!billingPeriod || !['monthly', 'yearly'].includes(billingPeriod)) {
      return NextResponse.json({ error: 'Période de facturation invalide' }, { status: 400 })
    }

    const plan = PLANS[planId]
    const priceId = plan.stripePriceIds[billingPeriod]

    if (!priceId) {
      return NextResponse.json(
        { error: 'Prix Stripe non configuré. Vérifie les variables d\'environnement.' },
        { status: 500 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://qonforme.fr'

    // Récupérer ou créer le customer Stripe
    let stripeCustomerId: string | undefined

    const existingSub = await getSubscriptionByUserId(user.id)
    if (existingSub?.stripe_customer_id) {
      stripeCustomerId = existingSub.stripe_customer_id
    } else {
      // Récupérer l'email de l'utilisateur et le nom de l'entreprise
      const { data: company } = await supabase
        .from('companies')
        .select('name, email')
        .eq('user_id', user.id)
        .single()

      const customer = await stripe.customers.create({
        email: user.email ?? company?.email ?? undefined,
        name: company?.name ?? undefined,
        metadata: {
          user_id: user.id,
          supabase_user_id: user.id,
        },
      })
      stripeCustomerId = customer.id
    }

    // Créer la Checkout Session — paiement immédiat, sans trial
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // Pas de trial : accès uniquement après paiement confirmé
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan: planId,
          billing_period: billingPeriod,
        },
      },
      success_url: `${appUrl}/dashboard?welcome=1`,
      cancel_url: `${appUrl}/pricing`,
      locale: 'fr',
      allow_promotion_codes: false,
      billing_address_collection: 'required',
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[/api/stripe/checkout] Erreur:', err)
    return NextResponse.json(
      { error: 'Erreur serveur lors de la création du checkout' },
      { status: 500 }
    )
  }
}
