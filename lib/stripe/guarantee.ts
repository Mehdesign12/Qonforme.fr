/**
 * Garantie « satisfait ou remboursé » — en libre-service, sans contact humain.
 *
 * Règles (DECISIONS-STRATEGIQUES.md § 12) :
 *   - 30 jours à compter du premier paiement du client Stripe, une seule fois ;
 *   - remboursement intégral de tout ce qui a été payé, sans justification ;
 *   - l'abonnement s'arrête aussitôt, le compte repasse en version gratuite ;
 *   - chaque remboursement passe par un avoir Stripe (credit note) sur la
 *     facture d'abonnement correspondante : une facture payée ne se corrige
 *     que par un avoir, y compris celles de Qonforme ;
 *   - les factures que l'artisan a déjà émises restent émises.
 */
import type Stripe from 'stripe'
import { stripe } from './client'
import { guaranteeEndsAt, isWithinGuarantee } from './access'

/** Clé posée sur le customer Stripe quand la garantie a servi. */
const GUARANTEE_USED_KEY = 'guarantee_used_at'

export type GuaranteeState =
  | { eligible: true; endsAt: Date; amountPaid: number }
  | { eligible: false; reason: 'used' | 'expired' | 'no_payment' | 'processing'; endsAt: Date | null }

async function listPaidInvoices(customerId: string): Promise<Stripe.Invoice[]> {
  const invoices: Stripe.Invoice[] = []
  for await (const invoice of stripe.invoices.list({ customer: customerId, status: 'paid', limit: 100 })) {
    invoices.push(invoice)
  }
  return invoices
}

function paidAt(invoice: Stripe.Invoice): Date | null {
  const ts = invoice.status_transitions?.paid_at
  return ts ? new Date(ts * 1000) : null
}

/** Montant encore remboursable d'une facture payée (déduction des avoirs déjà émis). */
function refundable(invoice: Stripe.Invoice): number {
  return Math.max(0, (invoice.amount_paid ?? 0) - (invoice.post_payment_credit_notes_amount ?? 0))
}

export async function getGuaranteeState(customerId: string, now: Date = new Date()): Promise<GuaranteeState> {
  const customer = await stripe.customers.retrieve(customerId)
  if ('deleted' in customer && customer.deleted) {
    return { eligible: false, reason: 'no_payment', endsAt: null }
  }

  const paid = await listPaidInvoices(customerId)
  const paidDates = paid.map(paidAt).filter((d): d is Date => d !== null)
  const firstPaidAt = paidDates.length > 0 ? new Date(Math.min(...paidDates.map((d) => d.getTime()))) : null
  const endsAt = firstPaidAt ? guaranteeEndsAt(firstPaidAt) : null

  if ((customer as Stripe.Customer).metadata?.[GUARANTEE_USED_KEY]) {
    return { eligible: false, reason: 'used', endsAt }
  }

  if (!firstPaidAt) {
    // Premier prélèvement SEPA pas encore confirmé : rien à rembourser pour l'instant
    const open = await stripe.invoices.list({ customer: customerId, status: 'open', limit: 1 })
    return { eligible: false, reason: open.data.length > 0 ? 'processing' : 'no_payment', endsAt: null }
  }

  if (!isWithinGuarantee(firstPaidAt, now)) {
    return { eligible: false, reason: 'expired', endsAt }
  }

  const amountPaid = paid.reduce((sum, invoice) => sum + refundable(invoice), 0)
  if (amountPaid <= 0) return { eligible: false, reason: 'used', endsAt }

  return { eligible: true, endsAt: endsAt!, amountPaid }
}

/**
 * Rembourse et arrête l'abonnement. Idempotent : les clés d'idempotence Stripe
 * empêchent un double remboursement si la demande est envoyée deux fois.
 * Renvoie le montant remboursé, en centimes.
 */
export async function applyGuarantee(customerId: string): Promise<{ refunded: number; canceledSubscriptionIds: string[] }> {
  const state = await getGuaranteeState(customerId)
  if (!state.eligible) {
    throw new GuaranteeError(state.reason)
  }

  let refunded = 0
  for (const invoice of await listPaidInvoices(customerId)) {
    const amount = refundable(invoice)
    if (amount <= 0) continue
    await stripe.creditNotes.create(
      {
        invoice: invoice.id!,
        amount,
        refund_amount: amount,
        reason: 'product_unsatisfactory',
        memo: 'Garantie satisfait ou remboursé 30 jours',
      },
      { idempotencyKey: `guarantee-${invoice.id}` }
    )
    refunded += amount
  }

  // Arrêt immédiat (pas à la fin de la période) : tout a été remboursé
  const canceledSubscriptionIds: string[] = []
  for await (const sub of stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })) {
    if (sub.status === 'canceled' || sub.status === 'incomplete_expired') continue
    await stripe.subscriptions.cancel(sub.id, { prorate: false, invoice_now: false })
    canceledSubscriptionIds.push(sub.id)
  }

  await stripe.customers.update(customerId, {
    metadata: { [GUARANTEE_USED_KEY]: new Date().toISOString() },
  })

  return { refunded, canceledSubscriptionIds }
}

export class GuaranteeError extends Error {
  constructor(public reason: 'used' | 'expired' | 'no_payment' | 'processing') {
    super(GUARANTEE_MESSAGES[reason])
  }
}

export const GUARANTEE_MESSAGES: Record<'used' | 'expired' | 'no_payment' | 'processing', string> = {
  used: 'La garantie a déjà été utilisée sur ce compte.',
  expired: 'La garantie de 30 jours est terminée. Vous pouvez résilier à tout moment depuis votre espace.',
  no_payment: 'Aucun paiement à rembourser.',
  processing: 'Votre premier prélèvement est en cours de confirmation par votre banque. Vous pourrez demander le remboursement dès qu’il sera confirmé.',
}
