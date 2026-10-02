import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSubscriptionByUserId, updateSubscriptionStatus } from '@/lib/stripe/subscription'
import { applyGuarantee, GuaranteeError } from '@/lib/stripe/guarantee'

/**
 * POST /api/stripe/guarantee — « satisfait ou remboursé » en libre-service.
 * Rembourse tout ce qui a été payé (par avoir Stripe), arrête l'abonnement et
 * remet le compte en version gratuite. Les documents émis restent accessibles.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const sub = await getSubscriptionByUserId(user.id)
    if (!sub?.stripe_customer_id) {
      return NextResponse.json({ error: 'Aucun paiement à rembourser.' }, { status: 404 })
    }

    const { refunded, canceledSubscriptionIds } = await applyGuarantee(sub.stripe_customer_id)

    // Le webhook customer.subscription.deleted fera de même ; on n'attend pas
    // pour que la page Abonnement affiche tout de suite la version gratuite.
    for (const id of canceledSubscriptionIds) {
      await updateSubscriptionStatus(id, 'canceled', { canceledAt: new Date() })
    }

    console.log(`[guarantee] Remboursement de ${refunded / 100} € pour user ${user.id}`)
    return NextResponse.json({ refunded })
  } catch (err) {
    if (err instanceof GuaranteeError) {
      return NextResponse.json({ error: err.message, reason: err.reason }, { status: 409 })
    }
    console.error('[/api/stripe/guarantee] Erreur:', err)
    return NextResponse.json(
      { error: 'Le remboursement n’a pas pu aboutir. Réessayez dans un instant.' },
      { status: 500 }
    )
  }
}
