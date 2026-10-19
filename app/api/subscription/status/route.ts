import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserSubscription } from '@/lib/stripe/subscription'
import { artisanOnSaleFor } from '@/lib/stripe/availability'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const sub = await getUserSubscription()
  // La formule Artisan est-elle vendable à ce compte ? (un compte d'essai la voit en vente avant le public)
  const artisanOnSale = await artisanOnSaleFor(user?.id)
  if (!sub) {
    return NextResponse.json({ status: null, plan: null, artisanOnSale })
  }
  return NextResponse.json({ status: sub.status, plan: sub.plan, artisanOnSale })
}
