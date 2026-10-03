import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { PLANS, isPlanId, type BillingPeriod } from '@/lib/stripe/plans'
import { getSubscriptionByUserId } from '@/lib/stripe/subscription'
import { canIssueInvoices, safeNextPath, GUARANTEE_DAYS } from '@/lib/stripe/access'

/**
 * POST /api/stripe/checkout — ouvre le paiement d'une formule (Checkout intégré).
 *
 * Appelé depuis la page de choix de formule ou depuis le mur de paiement qui
 * s'affiche à l'envoi de la première facture. `next` ramène l'artisan à cette
 * facture une fois le paiement confirmé.
 *
 * Moyens de paiement : carte et prélèvement SEPA. Le prélèvement met quelques
 * jours ouvrés à être confirmé ; l'accès est ouvert dès la fin du paiement
 * (l'abonnement est actif chez Stripe) et retiré si le prélèvement est rejeté
 * (webhook : checkout.session.async_payment_failed, invoice.payment_failed).
 *
 * TVA : les prix sont hors taxes, le taux Stripe STRIPE_TAX_RATE_ID (20 %) est
 * ajouté à l'abonnement. Sans lui, on refuse de vendre plutôt que de facturer
 * sans TVA un prix annoncé hors taxes.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const planId: unknown = body?.planId
    const billingPeriod: unknown = body?.billingPeriod
    const next = safeNextPath(body?.next)

    if (!isPlanId(planId)) {
      return NextResponse.json({ error: 'Formule invalide' }, { status: 400 })
    }
    if (billingPeriod !== 'monthly' && billingPeriod !== 'yearly') {
      return NextResponse.json({ error: 'Période de facturation invalide' }, { status: 400 })
    }

    const plan = PLANS[planId]
    if (!plan.available) {
      return NextResponse.json({ error: `La formule ${plan.name} n'est pas encore disponible.` }, { status: 400 })
    }

    const priceId = plan.stripePriceIds[billingPeriod as BillingPeriod]
    const taxRateId = process.env.STRIPE_TAX_RATE_ID ?? ''

    if (!priceId || !taxRateId) {
      console.error('[checkout] Configuration Stripe incomplète', {
        priceId: Boolean(priceId),
        taxRateId: Boolean(taxRateId),
      })
      return NextResponse.json(
        { error: 'Le paiement est momentanément indisponible. Réessayez plus tard.' },
        { status: 500 }
      )
    }

    // Déjà abonné : on n'ouvre pas un second abonnement. Passage d'Essentiel à
    // Artisan : changement de formule au prorata dans le portail Stripe
    // (POST /api/stripe/portal, action « upgrade »), pas un nouvel abonnement.
    const existingSub = await getSubscriptionByUserId(user.id)
    if (existingSub && canIssueInvoices(existingSub.status) && existingSub.stripe_subscription_id) {
      if (planId === 'pro' && existingSub.plan !== 'pro') {
        return NextResponse.json({ alreadySubscribed: true, upgrade: true, next: next ?? '/settings/billing' })
      }
      return NextResponse.json({ alreadySubscribed: true, next: next ?? '/settings/billing' })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://qonforme.fr'
    const admin = createAdminClient()

    // ── Coordonnées de facturation : celles de l'entreprise de l'artisan ─────
    // Elles apparaissent sur les factures d'abonnement émises par Stripe,
    // SIREN compris (mention obligatoire de la réforme de la facturation).
    const { data: company } = await supabase
      .from('companies')
      .select('name, email, siren, address, zip_code, city')
      .eq('user_id', user.id)
      .maybeSingle()

    const customerDetails: Stripe.CustomerUpdateParams = {
      name: company?.name || undefined,
      preferred_locales: ['fr'],
      metadata: { user_id: user.id, supabase_user_id: user.id },
      ...(company?.address && company?.zip_code && company?.city
        ? { address: { line1: company.address, postal_code: company.zip_code, city: company.city, country: 'FR' } }
        : {}),
      ...(company?.siren
        ? { invoice_settings: { custom_fields: [{ name: 'SIREN', value: String(company.siren) }] } }
        : {}),
    }

    // ── Récupérer ou créer le customer Stripe ───────────────────────────────
    let stripeCustomerId: string | null = existingSub?.stripe_customer_id ?? null

    if (!stripeCustomerId && user.email) {
      // Évite les doublons : un customer peut exister pour cet email
      const existing = await stripe.customers.list({ email: user.email, limit: 1 })
      stripeCustomerId = existing.data[0]?.id ?? null
    }

    const createCustomer = async () => {
      const customer = await stripe.customers.create({
        ...(customerDetails as Stripe.CustomerCreateParams),
        email: user.email ?? company?.email ?? undefined,
      })
      return customer.id
    }

    if (stripeCustomerId) {
      try {
        await stripe.customers.update(stripeCustomerId, customerDetails)
      } catch (err: unknown) {
        // Customer supprimé ou d'un autre mode (test/production) : on en recrée un
        const e = err as { code?: string; statusCode?: number }
        if (e?.code === 'resource_missing' || e?.statusCode === 404) {
          console.warn(`[checkout] Customer Stripe ${stripeCustomerId} invalide → création d'un nouveau`)
          stripeCustomerId = await createCustomer()
        } else {
          throw err
        }
      }
    } else {
      stripeCustomerId = await createCustomer()
    }

    // Enregistré tout de suite : la page Abonnement retrouve le customer même
    // si le paiement n'aboutit pas. Statut 'incomplete' tant que Stripe n'a pas
    // confirmé — un compte sans formule reste un compte gratuit.
    if (existingSub) {
      await admin
        .from('subscriptions')
        .update({
          stripe_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
    } else {
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

    const returnParams = new URLSearchParams({ session_id: '{CHECKOUT_SESSION_ID}' })
    if (next) returnParams.set('next', next)
    // URLSearchParams encode les accolades : Stripe attend le littéral {CHECKOUT_SESSION_ID}
    const returnQuery = returnParams.toString().replace('%7BCHECKOUT_SESSION_ID%7D', '{CHECKOUT_SESSION_ID}')

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      ui_mode: 'embedded',
      mode: 'subscription',
      payment_method_types: ['card', 'sepa_debit'],
      line_items: [{ price: priceId, quantity: 1 }],
      // Triple filet pour retrouver le user_id dans le webhook
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        plan: planId,
        billing_period: billingPeriod,
      },
      subscription_data: {
        default_tax_rates: [taxRateId],
        metadata: {
          user_id: user.id,
          plan: planId,
          billing_period: billingPeriod,
        },
      },
      // Filet si onComplete ne se déclenche pas côté navigateur (Safari mobile) :
      // /pricing/return vérifie la session, active la formule, puis renvoie vers `next`.
      return_url: `${appUrl}/pricing/return?${returnQuery}`,
      locale: 'fr',
      allow_promotion_codes: false,
      billing_address_collection: 'auto',
      custom_text: {
        submit: {
          message: `Satisfait ou remboursé pendant ${GUARANTEE_DAYS} jours après votre premier paiement. Sans engagement : résiliable à tout moment depuis votre espace.`,
        },
      },
    })

    return NextResponse.json({ clientSecret: session.client_secret })
  } catch (err) {
    console.error('[/api/stripe/checkout] Erreur:', err)
    return NextResponse.json(
      { error: 'Erreur serveur lors de la création du paiement' },
      { status: 500 }
    )
  }
}
