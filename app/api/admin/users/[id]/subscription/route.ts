import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { isAdminAuthenticated } from '@/lib/admin-require'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── Auth admin ──────────────────────────────────────────────────────────
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // ── Validation input ────────────────────────────────────────────────────
  const { id: targetUserId } = await params
  const body = await request.json()
  const { action } = body as { action: unknown }

  if (action !== 'cancel' && action !== 'extend') {
    return NextResponse.json({ error: 'Action invalide (cancel | extend)' }, { status: 400 })
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

  // ── Action : prolonger de 30 jours ─────────────────────────────────────
  if (action === 'extend') {
    if (sub.status === 'canceled') {
      return NextResponse.json({ error: 'Impossible de prolonger un abonnement annulé' }, { status: 400 })
    }

    const base = sub.current_period_end ? new Date(sub.current_period_end) : new Date()
    base.setDate(base.getDate() + 30)
    const newPeriodEnd = base.toISOString()

    const { error: updateError } = await admin
      .from('subscriptions')
      .update({ current_period_end: newPeriodEnd, updated_at: new Date().toISOString() })
      .eq('user_id', targetUserId)

    if (updateError) {
      console.error('[admin/subscription] Erreur DB extend:', updateError)
      return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
    }

    console.log(`[admin/subscription] Abonnement ${targetUserId} prolongé de 30 jours → ${newPeriodEnd} (par admin)`)
    return NextResponse.json({ success: true, newPeriodEnd })
  }

  // ── Action : annuler ────────────────────────────────────────────────────
  if (action === 'cancel') {
    if (sub.status === 'canceled') {
      return NextResponse.json({ error: 'L\'abonnement est déjà annulé' }, { status: 400 })
    }

    // Résoudre le Stripe subscription ID
    let resolvedSubId: string | null = sub.stripe_subscription_id ?? null

    if (!resolvedSubId && sub.stripe_customer_id) {
      try {
        const list = await stripe.subscriptions.list({
          customer: sub.stripe_customer_id,
          status: 'active',
          limit: 1,
        })
        if (list.data.length > 0) {
          resolvedSubId = list.data[0].id
        }
      } catch (err) {
        console.error('[admin/subscription] Erreur recherche Stripe:', err)
      }
    }

    // Annuler dans Stripe si possible
    if (resolvedSubId) {
      try {
        await stripe.subscriptions.cancel(resolvedSubId)
        console.log(`[admin/subscription] Stripe subscription ${resolvedSubId} annulée`)
      } catch (err) {
        console.error('[admin/subscription] Erreur annulation Stripe:', err)
        return NextResponse.json({ error: 'Erreur lors de l\'annulation Stripe' }, { status: 500 })
      }
    }

    // Mettre à jour la DB
    const dbUpdate: Record<string, unknown> = {
      status: 'canceled',
      updated_at: new Date().toISOString(),
    }
    if (resolvedSubId && !sub.stripe_subscription_id) {
      dbUpdate.stripe_subscription_id = resolvedSubId
    }

    const { error: updateError } = await admin
      .from('subscriptions')
      .update(dbUpdate)
      .eq('user_id', targetUserId)

    if (updateError) {
      console.error('[admin/subscription] Erreur DB cancel:', updateError)
      return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
    }

    console.log(`[admin/subscription] Abonnement ${targetUserId} annulé (par admin)`)
    return NextResponse.json({ success: true })
  }
}
