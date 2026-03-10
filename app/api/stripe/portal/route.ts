import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { getSubscriptionByUserId } from '@/lib/stripe/subscription'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const sub = await getSubscriptionByUserId(user.id)
    let stripeCustomerId = sub?.stripe_customer_id ?? null

    // Fallback : chercher le customer Stripe par email si absent en DB
    if (!stripeCustomerId && user.email) {
      try {
        const customers = await stripe.customers.list({ email: user.email, limit: 5 })
        for (const customer of customers.data) {
          // Vérifier qu'il a au moins une subscription
          const subs = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'all',
            limit: 1,
          })
          if (subs.data.length > 0) {
            stripeCustomerId = customer.id
            // Sauvegarder en DB pour les prochains appels
            const admin = createAdminClient()
            await admin
              .from('subscriptions')
              .update({
                stripe_customer_id: customer.id,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', user.id)
            console.log(`[portal] Customer trouvé par email et sauvegardé: ${customer.id}`)
            break
          }
        }
      } catch (err) {
        console.error('[portal] Erreur recherche customer par email:', err)
      }
    }

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: 'Aucun abonnement actif trouvé' },
        { status: 404 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://qonforme.fr'

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
