/**
 * POST /api/admin/stripe-test-accounts/purge
 * Efface tous les abonnements du bac à sable Stripe (livemode = false), avant
 * l'ouverture de la vente par exemple. Ne touche jamais un abonnement de production.
 */
import { NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-require'
import { purgeTestSubscriptions } from '@/lib/stripe/test-accounts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const result = await purgeTestSubscriptions()
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result.data)
}
