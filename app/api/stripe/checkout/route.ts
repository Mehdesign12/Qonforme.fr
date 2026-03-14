import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
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
        { error: "Prix Stripe non configuré. Vérifie les variables d'environnement." },
        { status: 500 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://qonforme.fr'
    const admin = createAdminClient()

    // ── Récupérer ou créer le customer Stripe ───────────────────────────────
    let stripeCustomerId: string

    const existingSub = await getSubscriptionByUserId(user.id)
    if (existingSub?.stripe_customer_id) {
      stripeCustomerId = existingSub.stripe_customer_id
    } else {
      // Vérifier si un customer existe déjà dans Stripe pour cet email (évite les doublons)
      let existingCustomerId: string | null = null
      if (user.email) {
        const existing = await stripe.customers.list({ email: user.email, limit: 1 })
        if (existing.data.length > 0) {
          existingCustomerId = existing.data[0].id
          // S'assurer que les métadonnées contiennent le user_id
          await stripe.customers.update(existingCustomerId, {
            metadata: { user_id: user.id, supabase_user_id: user.id },
          })
        }
      }

      if (existingCustomerId) {
        stripeCustomerId = existingCustomerId
      } else {
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

      // ✅ CRITIQUE : sauvegarder stripe_customer_id en DB DÈS MAINTENANT
      // Même avant le paiement, ça permet à la page billing de retrouver le customer
      const { data: existingRow } = await admin
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (existingRow) {
        await admin
          .from('subscriptions')
          .update({
            stripe_customer_id: stripeCustomerId,
            plan: planId,
            billing_period: billingPeriod,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
      } else {
        // Créer la ligne avec statut 'incomplete' — sera mise à jour par le webhook
        await admin
          .from('subscriptions')
          .insert({
            user_id: user.id,
            stripe_customer_id: stripeCustomerId,
            plan: planId,
            billing_period: billingPeriod,
            status: 'incomplete',
          })
      }

      console.log(`[checkout] stripe_customer_id ${stripeCustomerId} sauvegardé pour user ${user.id}`)
    }

    // ── Créer la Checkout Session en mode embedded ──────────────────────────
    // Les params sont extraits pour pouvoir réessayer en cas de customer ID périmé
    const sessionConfig = {
      ui_mode: 'embedded' as const,
      mode: 'subscription' as const,
      payment_method_types: ['card'] as ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      // Triple filet pour récupérer user_id dans le webhook
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        plan: planId,
        billing_period: billingPeriod,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan: planId,
          billing_period: billingPeriod,
        },
      },
      // return_url = fallback Stripe si onComplete client ne se déclenche pas (ex: Safari mobile)
      // On pointe vers /pricing (route publique) : si le webhook a déjà tiré,
      // la page pricing redirige automatiquement vers /dashboard (abonnement actif).
      return_url: `${appUrl}/pricing`,
      locale: 'fr' as const,
      allow_promotion_codes: false,
      // Produit digital : on ne collecte pas l'adresse
      billing_address_collection: 'auto' as const,
    }

    let session
    try {
      session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        ...sessionConfig,
      })
    } catch (stripeErr: unknown) {
      // Si le customer ID est invalide (ex : ID test-mode en production, customer supprimé)
      // → on crée un nouveau customer et on réessaie
      const e = stripeErr as { code?: string; statusCode?: number }
      if (e?.code === 'resource_missing' || e?.statusCode === 404) {
        console.warn(`[checkout] Customer Stripe ${stripeCustomerId} invalide → création d'un nouveau customer`)
        const newCustomer = await stripe.customers.create({
          email: user.email ?? undefined,
          metadata: { user_id: user.id, supabase_user_id: user.id },
        })
        stripeCustomerId = newCustomer.id
        await admin
          .from('subscriptions')
          .update({
            stripe_customer_id: stripeCustomerId,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
        session = await stripe.checkout.sessions.create({
          customer: stripeCustomerId,
          ...sessionConfig,
        })
      } else {
        throw stripeErr
      }
    }

    // Retourner le client_secret (pas l'URL) pour l'Embedded Checkout
    return NextResponse.json({ clientSecret: session.client_secret })
  } catch (err) {
    console.error('[/api/stripe/checkout] Erreur:', err)
    return NextResponse.json(
      { error: 'Erreur serveur lors de la création du checkout' },
      { status: 500 }
    )
  }
}
