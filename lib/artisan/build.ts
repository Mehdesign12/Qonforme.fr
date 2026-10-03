/**
 * Construction d'une facture de la formule Artisan (acompte, situation,
 * solde, acompte libre) à partir de l'état de facturation du devis. Pur et
 * partagé : l'écran calcule l'aperçu avec ces fonctions (application et
 * démo), la route les rejoue côté serveur avant d'écrire, sur des données
 * relues en base. Ce que montre l'aperçu est donc ce qui sera enregistré.
 */
import {
  computeDeposit, computeFinal, computeSituation, totalsOfLines,
  type BillingContext, type BillingLine, type DepositRequest, type SituationLineInput, type SourceLine,
} from "./billing"
import type { InvoiceForBilling, QuoteBillingState, QuoteForBilling } from "./quote-billing"
import { applyRetention, parseRetentionMode, parseRetentionRate, type RetentionMode } from "./retention"
import { applyReverseCharge } from "./reverse-charge"
import type { Chantier } from "./chantier"
import { fromCents, toCents } from "./money"

export interface QuoteRow extends QuoteForBilling {
  client_id: string
  chantier_id?: string | null
  subtotal_ht?: number | string | null
  valid_until?: string | null
}

export interface QuoteBilling {
  quote: QuoteRow
  invoices: InvoiceForBilling[]
  state: QuoteBillingState
  chantier: Pick<Chantier, "id" | "name" | "retention_mode" | "retention_rate" | "subcontracting"> | null
}

export type RetentionSetting = { mode: RetentionMode; rate: number }

export type CreateRequest =
  | { kind: "deposit"; deposit: DepositRequest; due_date?: string | null }
  | { kind: "situation"; progress: SituationLineInput[] | { global: number }; retention?: RetentionSetting | null; due_date?: string | null }
  | { kind: "final"; retention?: RetentionSetting | null; due_date?: string | null }

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Ajoute `days` jours à une date AAAA-MM-JJ. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10)
}

/** Lit la requête de création (corps JSON) ; erreur lisible sinon. */
export function parseCreateRequest(body: Record<string, unknown>): CreateRequest | { error: string } {
  const due = typeof body.due_date === "string" && DATE.test(body.due_date) ? body.due_date : null
  const r = body.retention as Record<string, unknown> | null | undefined
  let retention: RetentionSetting | null = null
  if (r && typeof r === "object") {
    const rate = parseRetentionRate(r.rate ?? 0)
    if (rate === null) return { error: "Le taux de retenue de garantie est de 5 % au plus (loi n° 71-584 du 16 juillet 1971)." }
    retention = { mode: parseRetentionMode(r.mode), rate }
  }

  if (body.kind === "deposit") {
    const d = body.deposit as Record<string, unknown> | undefined
    if (d?.mode === "percent") return { kind: "deposit", deposit: { mode: "percent", percent: Number(d.percent) }, due_date: due }
    if (d?.mode === "amount") return { kind: "deposit", deposit: { mode: "amount", amountTtc: Number(d.amount_ttc) }, due_date: due }
    return { error: "Indiquez un pourcentage ou un montant d'acompte." }
  }
  if (body.kind === "situation") {
    const p = body.progress as unknown
    if (p && typeof p === "object" && !Array.isArray(p) && (p as { global?: unknown }).global !== undefined) {
      return { kind: "situation", progress: { global: Number((p as { global: unknown }).global) }, retention, due_date: due }
    }
    if (Array.isArray(p) && p.length <= 500) {
      return { kind: "situation", progress: p.map((x) => ({ percent: Number((x as { percent?: unknown })?.percent) })), retention, due_date: due }
    }
    return { error: "Indiquez l'avancement des travaux." }
  }
  if (body.kind === "final") return { kind: "final", retention, due_date: due }
  return { error: "Type de facture inconnu." }
}

export interface Preview {
  kind: "deposit" | "situation" | "final"
  lines: BillingLine[]
  subtotal_ht: number
  total_vat: number
  total_ttc: number
  retention: BillingContext["retention"]
  context: BillingContext
  due_date: string
}

export type BuildError = { error: string; status: number }

/** Retenue appliquée par défaut : celle du chantier du devis, sinon aucune. */
export function defaultRetention(billing: Pick<QuoteBilling, "chantier">): RetentionSetting {
  return billing.chantier ? { mode: billing.chantier.retention_mode, rate: billing.chantier.retention_rate } : { mode: "aucune", rate: 0 }
}

/**
 * Calcule la facture demandée (aperçu ou création). Aucune écriture.
 * Retenue : celle demandée, sinon celle du chantier ; jamais sur un acompte
 * (avance versée avant les travaux, hors du champ de l'art. 1er de la loi de 1971).
 * Échéance : celle demandée (jamais avant le jour), sinon le jour même pour un
 * acompte et 30 jours pour une situation ou un solde.
 */
export function buildArtisanInvoice(billing: QuoteBilling, req: CreateRequest, today: string): Preview | BuildError {
  const { quote, state, chantier } = billing
  const allowed = req.kind === "deposit" ? state.canDeposit : req.kind === "situation" ? state.canSituation : state.canFinal
  if (!allowed.ok) return { error: allowed.reason, status: 409 }

  const lines = (quote.lines ?? []) as SourceLine[]
  const quoteRef = {
    id: quote.id, number: quote.quote_number, issue_date: String(quote.issue_date ?? "").slice(0, 10),
    total_ht: fromCents(state.contractHt), total_ttc: fromCents(state.contractTtc),
  }
  const chantierRef = chantier ? { id: chantier.id, name: chantier.name } : null
  const retentionSetting = req.kind !== "deposit" && req.retention ? req.retention : defaultRetention(billing)

  let out: { lines: BillingLine[] }
  let context: BillingContext
  if (req.kind === "deposit") {
    const r = computeDeposit(lines, req.deposit, { quoteNumber: quote.quote_number, alreadyTtc: state.depositsTtc })
    if (!r.ok) return { error: r.error, status: 422 }
    out = r
    context = {
      v: 1, kind: "deposit", quote: quoteRef, chantier: chantierRef,
      deposit: req.deposit.mode === "percent"
        ? { mode: "percent", percent: Math.round(req.deposit.percent * 100) / 100, requested_ttc: null }
        : { mode: "amount", percent: null, requested_ttc: fromCents(toCents(req.deposit.amountTtc)) },
      deductions: [], retention: null,
    }
  } else if (req.kind === "situation") {
    const r = computeSituation(lines, req.progress, state.previous, { records: state.deposits, deducted: state.deducted })
    if (!r.ok) return { error: r.error, status: 422 }
    out = r
    context = {
      v: 1, kind: "situation", quote: quoteRef, chantier: chantierRef,
      situation: {
        number: state.nextSituation, final: r.final,
        contract_ht: fromCents(r.contract_ht), previous_ht: fromCents(r.previous_ht),
        cumulative_ht: fromCents(r.cumulative_ht), amount_ht: fromCents(r.amount_ht),
        cumulative_percent: r.cumulative_percent,
      },
      deductions: r.deductions,
      retention: applyRetention(r.ttc, retentionSetting.mode, retentionSetting.rate),
    }
  } else {
    const r = computeFinal(lines, state.deposits, state.deducted)
    if (!r.ok) return { error: r.error, status: 422 }
    out = r
    context = {
      v: 1, kind: "final", quote: quoteRef, chantier: chantierRef,
      deductions: r.deductions,
      retention: applyRetention(r.ttc, retentionSetting.mode, retentionSetting.rate),
    }
  }

  const due = req.due_date && req.due_date >= today ? req.due_date : req.kind === "deposit" ? today : addDays(today, 30)
  return { kind: req.kind, lines: out.lines, ...totalsOfLines(out.lines), retention: context.retention, context, due_date: due }
}

/* ------------------------------------------------------------------ */
/* Acompte libre (sans devis)                                          */
/* ------------------------------------------------------------------ */

export interface FreeDepositInput {
  client_id: string
  chantier_id: string | null
  label: string
  amount_ttc: number
  vat_rate: number
  autoliquidation: boolean
  due_date: string | null
}

export function parseFreeDeposit(body: Record<string, unknown>): FreeDepositInput | { error: string } {
  const client_id = typeof body.client_id === "string" ? body.client_id.trim() : ""
  if (!client_id) return { error: "Choisissez le client." }
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 200) : ""
  if (!label) return { error: "Décrivez l'objet de l'acompte (commande, travaux prévus)." }
  const amount = Number(body.amount_ttc)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) return { error: "Indiquez un montant d'acompte positif." }
  const autoliquidation = body.autoliquidation === true
  const rate = autoliquidation ? 0 : Number(body.vat_rate)
  if (![0, 5.5, 10, 20].includes(rate)) return { error: "Taux de TVA inconnu." }
  const chantier_id = typeof body.chantier_id === "string" && body.chantier_id.trim() ? body.chantier_id.trim() : null
  const due_date = typeof body.due_date === "string" && DATE.test(body.due_date) ? body.due_date : null
  return { client_id, chantier_id, label, amount_ttc: amount, vat_rate: rate, autoliquidation, due_date }
}

/**
 * Acompte libre (commande sans devis enregistré) : une ligne au taux choisi,
 * TTC ramené au HT (un centime d'écart possible, affiché dans l'aperçu). Il se
 * rattache ensuite au devis signé pour être repris par le solde ou les situations.
 */
export function buildFreeDeposit(input: FreeDepositInput, chantier: { id: string; name: string } | null, today: string): Preview | BuildError {
  const ttc = toCents(input.amount_ttc)
  const ht = input.vat_rate > 0 ? Math.round((ttc * 100) / (100 + input.vat_rate)) : ttc
  const source: SourceLine[] = applyReverseCharge([{ total_ht: fromCents(ht), vat_rate: input.vat_rate, description: input.label }], input.autoliquidation)
  const r = computeDeposit(source, { mode: "percent", percent: 100 }, { label: input.label })
  if (!r.ok) return { error: r.error, status: 422 }
  const context: BillingContext = {
    v: 1, kind: "deposit", quote: null, chantier,
    deposit: { mode: "amount", percent: null, requested_ttc: fromCents(ttc) },
    deductions: [], retention: null,
  }
  const due = input.due_date && input.due_date >= today ? input.due_date : today
  return { kind: "deposit", lines: r.lines, ...totalsOfLines(r.lines), retention: null, context, due_date: due }
}
