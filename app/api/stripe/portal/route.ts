import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { getSubscriptionByUserId } from '@/lib/stripe/subscription'
import { PLANS } from '@/lib/stripe/plans'
import type Stripe from 'stripe'

// action = 'manage' | 'upgrade'
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const action: 'manage' | 'upgrade' = body?.action ?? 'manage'

    const sub = await getSubscriptionByUserId(user.id)
    let stripeCustomerId = sub?.stripe_customer_id ?? null
    let stripeSubscriptionId = sub?.stripe_subscription_id ?? null

    // ── Fallback : chercher customer + subscription par email ─────────────
    if ((!stripeCustomerId || !stripeSubscriptionId) && user.email) {
      try {
        const customers = await stripe.customers.list({ email: user.email, limit: 5 })
        for (const customer of customers.data) {
          const subs = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'all',
            limit: 1,
          })
          if (subs.data.length > 0) {
            stripeCustomerId = customer.id
            stripeSubscriptionId = subs.data[0].id
            // Mettre à jour la DB
            const admin = createAdminClient()
            await admin
              .from('subscriptions')
              .update({
                stripe_customer_id: customer.id,
                stripe_subscription_id: subs.data[0].id,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', user.id)
            console.log(`[portal] Customer ${customer.id} + sub ${subs.data[0].id} sauvegardés`)
            break
          }
        }
      } catch (err) {
        console.error('[portal] Erreur recherche par email:', err)
      }
    }

    if (!stripeCustomerId) {
      return NextResponse.json({ error: 'Aucun abonnement actif trouvé' }, { status: 404 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://qonforme.fr'

    // ── Action "upgrade" : flow direct vers changement de plan ────────────
    if (action === 'upgrade' && stripeSubscriptionId) {
      // Récupérer la billing_period actuelle pour proposer le bon prix Pro
      const currentPeriod = sub?.billing_period ?? 'monthly'
      const proPriceId = PLANS.pro.stripePriceIds[currentPeriod]

      if (proPriceId) {
        try {
          // Récupérer l'item de la subscription pour le subscription_update flow
          const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId)
          const subscriptionItemId = stripeSub.items.data[0]?.id

          if (subscriptionItemId) {
            const sessionParams: Stripe.BillingPortal.SessionCreateParams = {
              customer: stripeCustomerId,
              return_url: `${appUrl}/settings/billing`,
              flow_data: {
                type: 'subscription_update_confirm',
                subscription_update_confirm: {
                  subscription: stripeSubscriptionId,
                  items: [
                    {
                      id: subscriptionItemId,
                      price: proPriceId,
                      quantity: 1,
                    },
                  ],
                },
              },
            }

            const portalSession = await stripe.billingPortal.sessions.create(sessionParams)
            return NextResponse.json({ url: portalSession.url })
          }
        } catch (err) {
          console.error('[portal] Erreur flow upgrade, fallback manage:', err)
          // Fallback sur manage si le flow upgrade échoue
        }
      }
    }

    // ── Action "manage" (ou fallback) : portail standard ─────────────────
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${appUrl}/settings/billing`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (err) {
    console.error('[/api/stripe/portal] Erreur:', err)
    return NextResponse.json(
      { error: 'Erreur serveur lors de la création du portail' },
      { status: 500 }
    )
  }
}

// Garder GET pour compatibilité (redirige vers manage)
export async function GET() {
  return POST(new NextRequest('http://localhost/api/stripe/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'manage' }),
  }))
}
