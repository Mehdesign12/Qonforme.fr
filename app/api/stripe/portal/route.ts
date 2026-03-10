import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

    if (!sub?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'Aucun abonnement actif trouvé' },
        { status: 404 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://qonforme.fr'

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
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
