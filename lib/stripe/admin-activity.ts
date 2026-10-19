/**
 * Activité Stripe de l'admin (Admin › Paiements) : encaissements, remboursements
 * et abonnements, lus chez Stripe dans le mode choisi (production ou bac à sable).
 * Lecture seule, serveur seulement : aucune donnée de carte, jamais de clé.
 *
 * Les montants sont en centimes. Les chiffres du résumé portent sur les 100
 * dernières factures de la fenêtre de 30 jours : `truncated` le dit quand il y
 * en a davantage.
 */
import type Stripe from 'stripe'
import { getStripe, isStripeConfigured, type StripeMode } from './mode'
import { getPlanByPriceId, PLANS } from './plans'
import { invoiceBadge, type InvoiceBadge } from './invoice-status'

export const ACTIVITY_WINDOW_DAYS = 30
const PAGE = 100
const ROWS_SHOWN = 25

export interface PaymentRow {
  id: string
  number: string | null
  /** Date ISO de la facture. */
  date: string
  email: string | null
  /** « Essentiel · mensuel », « Artisan · annuel »… */
  label: string
  amount: number
  refunded: number
  badge: InvoiceBadge
}

export interface RefundRow {
  id: string
  number: string | null
  date: string
  amount: number
  invoiceNumber: string | null
  email: string | null
  reason: string | null
}

export interface ActivitySummary {
  /** Encaissé sur la fenêtre (factures payées), avant remboursements. */
  collected: number
  refunded: number
  net: number
  activeSubscriptions: number
  scheduledCancellations: number
  failedPayments: number
}

export type ActivityResult =
  | { ok: true; summary: ActivitySummary; payments: PaymentRow[]; refunds: RefundRow[]; truncated: boolean }
  | { ok: false; reason: 'not_configured' | 'error'; message: string }

function priceIdOf(line: Stripe.InvoiceLineItem | undefined): string | null {
  if (!line) return null
  // API 2025 : pricing.price_details.price ; anciennes versions : price.id
  const pricing = (line as unknown as { pricing?: { price_details?: { price?: string } } }).pricing
  const legacy = (line as unknown as { price?: { id?: string } | null }).price
  return pricing?.price_details?.price ?? legacy?.id ?? null
}

/** « Essentiel · mensuel » d'après le prix de la première ligne ; la description Stripe à défaut. */
export function planLabelOf(invoice: Stripe.Invoice): string {
  const line = invoice.lines?.data?.[0]
  const info = getPlanByPriceId(priceIdOf(line) ?? '')
  if (info) return `${PLANS[info.plan].name} · ${info.period === 'yearly' ? 'annuel' : 'mensuel'}`
  return line?.description ? line.description.slice(0, 60) : 'Abonnement'
}

export function paymentRowOf(invoice: Stripe.Invoice): PaymentRow {
  const amount = invoice.amount_paid > 0 ? invoice.amount_paid : (invoice.total ?? 0)
  const refunded = invoice.post_payment_credit_notes_amount ?? 0
  let badge = invoiceBadge(invoice.status ?? 'open', amount, refunded)
  // Facture ouverte dont le prélèvement a déjà été tenté : le paiement a été refusé
  if (invoice.status === 'open' && (invoice.attempt_count ?? 0) > 0) badge = { label: 'Paiement refusé', tone: 'danger' }
  return {
    id: invoice.id ?? invoice.number ?? String(invoice.created),
    number: invoice.number ?? null,
    date: new Date(invoice.created * 1000).toISOString(),
    email: invoice.customer_email ?? null,
    label: planLabelOf(invoice),
    amount,
    refunded,
    badge,
  }
}

export function summarize(invoices: Stripe.Invoice[], subscriptions: Stripe.Subscription[], since: number): ActivitySummary {
  let collected = 0
  let refunded = 0
  let failedPayments = 0
  for (const inv of invoices) {
    if (inv.created < since || inv.status === 'draft' || inv.status === 'void') continue
    if (inv.status === 'paid') {
      collected += inv.amount_paid ?? 0
      refunded += inv.post_payment_credit_notes_amount ?? 0
    } else if (inv.status === 'open' && (inv.attempt_count ?? 0) > 0) {
      failedPayments += 1
    }
  }
  const live = subscriptions.filter((s) => s.status === 'active' || s.status === 'trialing' || s.status === 'past_due')
  return {
    collected,
    refunded,
    net: collected - refunded,
    activeSubscriptions: live.length,
    scheduledCancellations: live.filter((s) => s.cancel_at_period_end || s.cancel_at).length,
    failedPayments,
  }
}

export async function loadActivity(
  mode: StripeMode,
  options: { now?: Date; stripe?: Stripe } = {},
): Promise<ActivityResult> {
  if (!options.stripe && !isStripeConfigured(mode)) {
    return { ok: false, reason: 'not_configured', message: `La clé secrète ${mode === 'test' ? 'du bac à sable' : 'de production'} n'est pas configurée dans Vercel.` }
  }
  try {
    const stripe = options.stripe ?? getStripe(mode)
    const since = Math.floor(((options.now ?? new Date()).getTime() - ACTIVITY_WINDOW_DAYS * 86_400_000) / 1000)

    const [invoices, subscriptions, creditNotes] = await Promise.all([
      stripe.invoices.list({ limit: PAGE }),
      stripe.subscriptions.list({ status: 'all', limit: PAGE }),
      stripe.creditNotes.list({ limit: ROWS_SHOWN }),
    ])

    const byId = new Map(invoices.data.map((inv) => [inv.id, inv]))
    const refunds: RefundRow[] = creditNotes.data
      .filter((cn) => cn.status === 'issued')
      .map((cn) => {
        const invoice = byId.get(typeof cn.invoice === 'string' ? cn.invoice : cn.invoice?.id ?? '')
        return {
          id: cn.id,
          number: cn.number ?? null,
          date: new Date(cn.created * 1000).toISOString(),
          amount: cn.total ?? cn.amount ?? 0,
          invoiceNumber: invoice?.number ?? null,
          email: invoice?.customer_email ?? null,
          reason: cn.memo ?? null,
        }
      })

    return {
      ok: true,
      summary: summarize(invoices.data, subscriptions.data, since),
      payments: invoices.data.filter((inv) => inv.status !== 'draft').slice(0, ROWS_SHOWN).map(paymentRowOf),
      refunds,
      truncated: invoices.has_more || subscriptions.has_more,
    }
  } catch (err) {
    console.error('[admin/payments] Lecture Stripe impossible:', err)
    return { ok: false, reason: 'error', message: "Stripe n'a pas répondu. Réessayez dans un instant." }
  }
}
