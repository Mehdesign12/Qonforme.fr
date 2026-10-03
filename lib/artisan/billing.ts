/**
 * Facturation d'un devis accepté, formule Artisan : factures d'acompte,
 * situations de travaux et facture de solde. Fonctions pures, au centime.
 *
 * ── Facture d'acompte ────────────────────────────────────────────────────
 * Tout paiement reçu avant l'exécution donne lieu à une facture d'acompte
 * (CGI, art. 289, I-1-c). La TVA est exigible à l'encaissement de l'acompte :
 * pour les prestations de services, dont les travaux immobiliers (CGI,
 * art. 269, 2-c), et pour les livraisons de biens depuis le 1er janvier 2023
 * (CGI, art. 269, 2-a, loi n° 2021-1900 du 30 décembre 2021, art. 30).
 * L'acompte porte donc la TVA du devis, ventilée par taux au prorata.
 * https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048213504
 * https://bofip.impots.gouv.fr/bofip/283-PGP.html/identifiant=BOI-TVA-BASE-20-20-20181107
 *
 * Factur-X : type de document 386 (« Facture d'acompte », liste des types
 * autorisés, DGFiP, spécifications externes v3.2, annexe 7, règle G1.01),
 * cadre de facturation S1 (prestation de services).
 *
 * ── Facture de solde ─────────────────────────────────────────────────────
 * Elle porte sur la totalité des travaux et reprend chaque acompte en ligne
 * négative, à son taux de TVA (« reprise à la ligne », méthode privilégiée par
 * la DGFiP selon la fiche « Le traitement des acomptes », FNFE-MPE, GT bonnes
 * pratiques, 2026). Elle cite les factures d'acompte (BT-25, BT-26) et porte
 * le cadre S4 (« facture définitive après acompte », annexe 7, G1.02) : la TVA
 * déjà déclarée sur l'acompte n'est pas déclarée deux fois, et le total de la
 * facture est ce qui reste dû. Additionner les factures d'un devis donne
 * donc exactement le montant du devis : jamais de double comptage.
 * https://fnfe-mpe.org/wp-content/uploads/2026/04/Fiche_Flash-Acomptes.pdf
 *
 * ── Situations de travaux ────────────────────────────────────────────────
 * Une situation facture l'avancement réel : ce ne sont pas des acomptes (des
 * travaux ont été exécutés, la facture entre dans le chiffre d'affaires,
 * même fiche FNFE-MPE). Type 380, cadre S1, numérotation continue avec les
 * autres factures. Chaque situation reprend le cumul de l'avancement par
 * ligne du devis et déduit ce que les situations précédentes ont déjà
 * facturé : seule la différence est facturée, avec sa TVA. Les acomptes du
 * devis sont repris au prorata de l'avancement cumulé (entièrement à 100 %),
 * en lignes négatives, et la situation passe alors en cadre S4.
 *
 * Aucune écriture ici : lib/artisan/server.ts lit la base et enregistre.
 */
import { allocateCents, formatPercentFr, fromCents, percentOf, prorata, roundHalfAwayFromZero, toCents, vatOfCents } from "./money"

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** Nature d'une facture. `standard` : facture ordinaire (directe ou issue d'un devis converti). */
export type InvoiceKind = "standard" | "deposit" | "situation" | "final"

export const INVOICE_KINDS: readonly InvoiceKind[] = ["standard", "deposit", "situation", "final"]

export function parseInvoiceKind(value: unknown): InvoiceKind {
  return typeof value === "string" && (INVOICE_KINDS as readonly string[]).includes(value) ? (value as InvoiceKind) : "standard"
}

/** Factures propres à la formule Artisan (création et émission réservées). */
export function isArtisanKind(kind: unknown): boolean {
  const k = parseInvoiceKind(kind)
  return k === "deposit" || k === "situation" || k === "final"
}

/** Traitement de TVA d'une ligne (même liste que lib/facturx/vat.ts). */
export type LineTreatment = "standard" | "franchise" | "autoliquidation_btp" | "intracom" | "export"

/** Ligne de devis telle qu'enregistrée (JSON `lines`). */
export interface SourceLine {
  description?: string | null
  quantity?: number | string | null
  unit?: string | null
  unit_price_ht?: number | string | null
  vat_rate?: number | string | null
  total_ht?: number | string | null
  total_vat?: number | string | null
  vat_treatment?: string | null
}

/** Ligne de facture produite (format du JSON `lines` des factures). */
export interface BillingLine {
  id: string
  description: string
  quantity: number
  unit: string | null
  unit_price_ht: number
  vat_rate: number
  total_ht: number
  total_vat: number
  total_ttc: number
  vat_treatment?: LineTreatment
  /** Ligne d'une situation : avancement de la ligne du devis (aperçu, PDF). */
  progress?: {
    quote_line: number
    contract_ht: number
    previous_percent: number
    percent: number
    previous_ht: number
    cumulative_ht: number
  }
  /** Ligne de reprise d'un acompte. */
  deposit_of?: { invoice_id: string; number: string }
}

/** Groupe de TVA (taux et traitement), en centimes. */
export interface VatGroup {
  rate: number
  treatment: LineTreatment
  ht: number
  vat: number
}

/** Facture d'acompte émise, telle que la reprise la voit. */
export interface DepositRecord {
  invoice_id: string
  number: string
  issue_date: string
  /** HT et TVA par groupe de TVA (lignes de l'acompte). */
  groups: VatGroup[]
}

/** Ce qui a déjà été repris d'un acompte (situations précédentes), par groupe. */
export interface DeductedRecord {
  invoice_id: string
  groups: VatGroup[]
}

/** Contexte de facturation enregistré avec la facture (`billing_context`), figé à l'émission. */
export interface BillingContext {
  v: 1
  kind: Exclude<InvoiceKind, "standard">
  /** Devis d'origine ; absent pour un acompte libre (sans devis). */
  quote: { id: string; number: string; issue_date: string; total_ht: number; total_ttc: number } | null
  chantier: { id: string; name: string } | null
  deposit?: { mode: "percent" | "amount"; percent: number | null; requested_ttc: number | null }
  situation?: {
    number: number
    /** Décompte final : toutes les lignes du devis à 100 %. */
    final: boolean
    contract_ht: number
    previous_ht: number
    cumulative_ht: number
    amount_ht: number
    /** Avancement cumulé global, en % du montant HT du devis. */
    cumulative_percent: number
  }
  /** Acomptes repris sur cette facture (montants repris ici, positifs). */
  deductions: { invoice_id: string; number: string; issue_date: string; ht: number; vat: number; ttc: number; groups: VatGroup[] }[]
  retention: RetentionApplied | null
}

export interface RetentionApplied {
  /** Taux en % (5 au plus, loi n° 71-584 du 16 juillet 1971, art. 1er). */
  rate: number
  /** « retenue » : montant retenu ; « caution » : remplacée par une caution bancaire (rien n'est retenu). */
  mode: "retenue" | "caution"
  /** Montant retenu TTC, en euros. */
  amount: number
  /** Base : montant TTC de la facture, en euros. */
  base_ttc: number
}

/* ------------------------------------------------------------------ */
/* Lecture des lignes                                                  */
/* ------------------------------------------------------------------ */

const TREATMENTS = new Set<LineTreatment>(["standard", "franchise", "autoliquidation_btp", "intracom", "export"])

function lineTreatment(l: SourceLine): LineTreatment {
  const t = l.vat_treatment
  return typeof t === "string" && TREATMENTS.has(t as LineTreatment) ? (t as LineTreatment) : "standard"
}

function lineRate(l: SourceLine): number {
  const r = Number(l.vat_rate)
  return Number.isFinite(r) && r > 0 ? Math.round(r * 100) / 100 : 0
}

/** HT et TVA d'une ligne en centimes (TVA enregistrée, sinon recalculée ; jamais de TVA hors taux > 0). */
export function lineCents(l: SourceLine): { ht: number; vat: number } {
  const ht = toCents(l.total_ht)
  const rate = lineRate(l)
  if (rate === 0) return { ht, vat: 0 }
  const vat = l.total_vat == null || l.total_vat === "" ? vatOfCents(ht, rate) : toCents(l.total_vat)
  return { ht, vat }
}

const groupKey = (rate: number, treatment: LineTreatment) => `${rate}|${rate > 0 ? "standard" : treatment}`

/** Ventilation des lignes par taux et traitement de TVA (ordre : taux décroissant). */
export function vatGroupsOf(lines: SourceLine[]): VatGroup[] {
  const groups = new Map<string, VatGroup>()
  for (const l of lines) {
    const rate = lineRate(l)
    const treatment: LineTreatment = rate > 0 ? "standard" : lineTreatment(l)
    const key = groupKey(rate, treatment)
    const { ht, vat } = lineCents(l)
    const g = groups.get(key) ?? { rate, treatment, ht: 0, vat: 0 }
    g.ht += ht
    g.vat += vat
    groups.set(key, g)
  }
  return Array.from(groups.values()).sort((a, b) => b.rate - a.rate || a.treatment.localeCompare(b.treatment))
}

export function sumGroups(groups: VatGroup[]): { ht: number; vat: number; ttc: number } {
  const ht = groups.reduce((s, g) => s + g.ht, 0)
  const vat = groups.reduce((s, g) => s + g.vat, 0)
  return { ht, vat, ttc: ht + vat }
}

/** Totaux d'une liste de lignes produites, en euros. */
export function totalsOfLines(lines: BillingLine[]): { subtotal_ht: number; total_vat: number; total_ttc: number } {
  const ht = lines.reduce((s, l) => s + toCents(l.total_ht), 0)
  const vat = lines.reduce((s, l) => s + toCents(l.total_vat), 0)
  return { subtotal_ht: fromCents(ht), total_vat: fromCents(vat), total_ttc: fromCents(ht + vat) }
}

/* ------------------------------------------------------------------ */
/* Libellés                                                            */
/* ------------------------------------------------------------------ */

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]

/** « 12 septembre 2026 » d'une date AAAA-MM-JJ (texte brut sinon). */
export function longDateFr(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "")
  if (!m) return iso ?? ""
  const d = Number(m[3])
  return `${d === 1 ? "1er" : d} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`
}

function groupSuffix(g: Pick<VatGroup, "rate" | "treatment">, several: boolean): string {
  if (g.treatment === "autoliquidation_btp") return " — autoliquidation"
  if (!several) return ""
  return g.rate > 0 ? ` — TVA ${formatPercentFr(g.rate)} %` : " — sans TVA"
}

let idCounter = 0
/** Identifiant de ligne stable dans un même calcul (les lignes n'ont besoin que d'être uniques). */
function lineId(prefix: string): string {
  idCounter = (idCounter + 1) % 1_000_000
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`
}

function makeLine(
  prefix: string,
  description: string,
  quantity: number,
  unitPriceCents: number,
  htCents: number,
  vatCents: number,
  g: Pick<VatGroup, "rate" | "treatment">,
  extra: Partial<BillingLine> = {},
): BillingLine {
  return {
    id: lineId(prefix),
    description,
    quantity,
    unit: null,
    unit_price_ht: fromCents(unitPriceCents),
    vat_rate: g.rate,
    total_ht: fromCents(htCents),
    total_vat: fromCents(vatCents),
    total_ttc: fromCents(htCents + vatCents),
    ...(g.treatment !== "standard" ? { vat_treatment: g.treatment } : {}),
    ...extra,
  }
}

/* ------------------------------------------------------------------ */
/* Acompte                                                             */
/* ------------------------------------------------------------------ */

export type DepositRequest =
  | { mode: "percent"; percent: number }
  | { mode: "amount"; amountTtc: number }

export interface DepositResult {
  ok: true
  lines: BillingLine[]
  groups: VatGroup[]
  ht: number
  vat: number
  ttc: number
}

export type BillingError = { ok: false; error: string }

/**
 * Montant d'un acompte, ventilé par taux de TVA au prorata du devis.
 * - en pourcentage : chaque taux reçoit ce pourcentage de sa base HT ;
 * - en montant TTC : réparti au prorata du TTC de chaque taux, puis ramené au
 *   HT ; un centime d'écart possible, corrigé sur le taux principal.
 * `alreadyTtc` : acomptes déjà facturés sur ce devis (centimes) ; le total
 * des acomptes ne dépasse jamais le montant du devis.
 */
export function computeDeposit(
  quoteLines: SourceLine[],
  request: DepositRequest,
  opts: { quoteNumber?: string | null; quoteDate?: string | null; alreadyTtc?: number; label?: string | null } = {},
): DepositResult | BillingError {
  const contract = vatGroupsOf(quoteLines).filter((g) => g.ht !== 0)
  const total = sumGroups(contract)
  if (contract.length === 0 || total.ttc <= 0) return { ok: false, error: "Le devis n'a pas de montant à facturer." }
  if (contract.some((g) => g.ht < 0)) return { ok: false, error: "Un taux de TVA du devis est négatif : facturez cet acompte à la main." }

  let groups: VatGroup[]
  if (request.mode === "percent") {
    const p = Math.round(Number(request.percent) * 100) / 100
    if (!Number.isFinite(p) || p <= 0 || p > 100) return { ok: false, error: "Indiquez un pourcentage entre 0 et 100 %." }
    groups = contract.map((g) => {
      const ht = percentOf(g.ht, p)
      return { ...g, ht, vat: g.rate > 0 ? vatOfCents(ht, g.rate) : 0 }
    })
  } else {
    const wanted = toCents(request.amountTtc)
    if (wanted <= 0) return { ok: false, error: "Indiquez un montant d'acompte positif." }
    const shares = allocateCents(wanted, contract.map((g) => g.ht + g.vat))
    groups = contract.map((g, i) => {
      const ht = g.rate > 0 ? roundHalfAwayFromZero((shares[i] * 100) / (100 + g.rate)) : shares[i]
      return { ...g, ht, vat: g.rate > 0 ? vatOfCents(ht, g.rate) : 0 }
    })
    // Écart d'arrondi : on ajuste le HT du groupe le plus important, au centime près
    const main = groups.reduce((best, g, i) => (g.ht > groups[best].ht ? i : best), 0)
    for (let k = 0; k < 4; k++) {
      const diff = wanted - sumGroups(groups).ttc
      if (diff === 0) break
      const g = groups[main]
      const step = diff > 0 ? 1 : -1
      const next = { ...g, ht: g.ht + step, vat: g.rate > 0 ? vatOfCents(g.ht + step, g.rate) : 0 }
      if (Math.abs(wanted - (sumGroups(groups).ttc - g.ht - g.vat + next.ht + next.vat)) >= Math.abs(diff)) break
      groups[main] = next
    }
  }

  groups = groups.filter((g) => g.ht !== 0)
  const sum = sumGroups(groups)
  if (sum.ttc <= 0) return { ok: false, error: "Le montant de l'acompte est trop faible." }
  const already = opts.alreadyTtc ?? 0
  if (already + sum.ttc > total.ttc) {
    return { ok: false, error: `Les acomptes dépasseraient le montant du devis (reste possible : ${fromCents(Math.max(0, total.ttc - already)).toFixed(2).replace(".", ",")} € TTC).` }
  }

  // Date du devis : imprimée dans les références du document (et BT-12 du XML), pas dans la ligne
  const ref = opts.quoteNumber ? ` sur le devis ${opts.quoteNumber}` : ""
  const base = opts.label?.trim()
    || (request.mode === "percent" ? `Acompte de ${formatPercentFr(request.percent)} %${ref}` : `Acompte${ref}`)
  const several = groups.length > 1
  const lines = groups.map((g) => makeLine("acompte", `${base}${groupSuffix(g, several)}`, 1, g.ht, g.ht, g.vat, g))
  return { ok: true, lines, groups, ...sum }
}

/** Groupes de TVA d'une facture d'acompte enregistrée (ses lignes). */
export function depositGroups(lines: SourceLine[] | null | undefined): VatGroup[] {
  return vatGroupsOf(lines ?? []).filter((g) => g.ht !== 0)
}

/* ------------------------------------------------------------------ */
/* Reprise des acomptes                                                */
/* ------------------------------------------------------------------ */

export interface DeductionResult {
  lines: BillingLine[]
  deductions: BillingContext["deductions"]
}

/**
 * Lignes de reprise des acomptes, au prorata de l'avancement cumulé
 * (`num / den`, en HT ; 1 / 1 pour une facture de solde) moins ce qui a déjà
 * été repris. À 100 %, chaque acompte est repris exactement, TVA comprise.
 */
export function deductDeposits(
  deposits: DepositRecord[],
  already: DeductedRecord[],
  ratio: { num: number; den: number },
): DeductionResult {
  const lines: BillingLine[] = []
  const deductions: BillingContext["deductions"] = []
  const full = ratio.den !== 0 && ratio.num >= ratio.den

  for (const dep of deposits) {
    const done = already.filter((a) => a.invoice_id === dep.invoice_id).flatMap((a) => a.groups)
    const several = dep.groups.length > 1
    const taken: VatGroup[] = []
    for (const g of dep.groups) {
      const prevHt = done.filter((d) => d.rate === g.rate && d.treatment === g.treatment).reduce((s, d) => s + d.ht, 0)
      const prevVat = done.filter((d) => d.rate === g.rate && d.treatment === g.treatment).reduce((s, d) => s + d.vat, 0)
      const targetHt = full ? g.ht : prorata(g.ht, ratio.num, ratio.den)
      const ht = Math.max(0, Math.min(g.ht, targetHt) - prevHt)
      if (ht === 0) continue
      // TVA : exacte à la reprise complète, sinon recalculée sur la part reprise
      const vat = g.rate === 0 ? 0 : full || prevHt + ht >= g.ht ? g.vat - prevVat : vatOfCents(ht, g.rate)
      taken.push({ ...g, ht, vat })
      lines.push(makeLine(
        "reprise",
        `Reprise de l'acompte ${dep.number}${groupSuffix(g, several)}`,
        -1, ht, -ht, -vat, g,
        { deposit_of: { invoice_id: dep.invoice_id, number: dep.number } },
      ))
    }
    if (taken.length) {
      const s = sumGroups(taken)
      deductions.push({ invoice_id: dep.invoice_id, number: dep.number, issue_date: dep.issue_date, ht: fromCents(s.ht), vat: fromCents(s.vat), ttc: fromCents(s.ttc), groups: taken })
    }
  }
  return { lines, deductions }
}

/* ------------------------------------------------------------------ */
/* Situation de travaux                                                */
/* ------------------------------------------------------------------ */

export interface SituationLineInput {
  /** Avancement cumulé demandé pour cette ligne du devis, en % (deux décimales). */
  percent: number
}

export interface SituationPrevious {
  /** Avancement cumulé déjà facturé, par ligne du devis (en %). */
  percents: number[]
  /** HT déjà facturé, par ligne du devis (centimes). */
  billedHt: number[]
  /** TVA déjà facturée, par ligne du devis (centimes). */
  billedVat: number[]
}

export interface SituationLineState {
  quote_line: number
  description: string
  contract_ht: number
  previous_percent: number
  percent: number
  previous_ht: number
  cumulative_ht: number
  amount_ht: number
  /** TVA de cette situation sur la ligne : cumul moins déjà facturé (exacte à 100 %). */
  amount_vat: number
  vat_rate: number
  treatment: LineTreatment
}

export interface SituationResult {
  ok: true
  lines: BillingLine[]
  state: SituationLineState[]
  final: boolean
  contract_ht: number
  previous_ht: number
  cumulative_ht: number
  amount_ht: number
  cumulative_percent: number
  deductions: BillingContext["deductions"]
  ht: number
  vat: number
  ttc: number
}

const clampPercent = (p: number) => Math.round(Math.min(100, Math.max(0, Number(p) || 0)) * 100) / 100

/** Avancement des situations déjà émises, par ligne du devis. */
export function previousProgress(quoteLineCount: number, situations: { lines?: BillingLine[] | SourceLine[] | null }[]): SituationPrevious {
  const percents = Array.from({ length: quoteLineCount }, () => 0)
  const billedHt = Array.from({ length: quoteLineCount }, () => 0)
  const billedVat = Array.from({ length: quoteLineCount }, () => 0)
  for (const s of situations) {
    for (const raw of (s.lines ?? []) as BillingLine[]) {
      const p = raw?.progress
      if (!p || !Number.isInteger(p.quote_line) || p.quote_line < 0 || p.quote_line >= quoteLineCount) continue
      percents[p.quote_line] = Math.max(percents[p.quote_line], clampPercent(p.percent))
      billedHt[p.quote_line] += toCents(raw.total_ht)
      billedVat[p.quote_line] += toCents(raw.total_vat)
    }
  }
  return { percents, billedHt, billedVat }
}

/**
 * Situation n : avancement cumulé par ligne (ou global : même % partout),
 * moins ce que les situations précédentes ont facturé ; reprise des acomptes
 * au prorata de l'avancement cumulé.
 */
export function computeSituation(
  quoteLines: SourceLine[],
  progress: SituationLineInput[] | { global: number },
  previous: SituationPrevious,
  deposits: { records: DepositRecord[]; deducted: DeductedRecord[] } = { records: [], deducted: [] },
): SituationResult | BillingError {
  if (quoteLines.length === 0) return { ok: false, error: "Le devis n'a aucune ligne." }
  const wanted = "global" in progress
    ? quoteLines.map(() => clampPercent(progress.global))
    : quoteLines.map((_, i) => clampPercent(progress[i]?.percent ?? previous.percents[i] ?? 0))

  const state: SituationLineState[] = []
  for (let i = 0; i < quoteLines.length; i++) {
    const l = quoteLines[i]
    const contract = toCents(l.total_ht)
    const prevPercent = clampPercent(previous.percents[i] ?? 0)
    const prevHt = previous.billedHt[i] ?? 0
    let percent = wanted[i]
    // En mode global, une ligne déjà plus avancée garde son avancement
    if ("global" in progress && percent < prevPercent) percent = prevPercent
    if (percent < prevPercent) {
      return { ok: false, error: `Ligne ${i + 1} : l'avancement ne peut pas baisser (${formatPercentFr(prevPercent)} % déjà facturés). Pour corriger, émettez un avoir.` }
    }
    const cumulative = percent >= 100 ? contract : percentOf(contract, percent)
    const rate = lineRate(l)
    // TVA cumulée de la ligne : celle du devis à 100 %, sinon celle du cumul ;
    // la situation facture la différence avec ce qui a déjà été facturé, pour
    // que la somme des situations retombe exactement sur la TVA du devis
    const cumulativeVat = rate === 0 ? 0 : percent >= 100 ? lineCents(l).vat : vatOfCents(cumulative, rate)
    state.push({
      quote_line: i,
      description: (l.description ?? "").trim() || `Ligne ${i + 1}`,
      contract_ht: contract,
      previous_percent: prevPercent,
      percent,
      previous_ht: prevHt,
      cumulative_ht: cumulative,
      amount_ht: cumulative - prevHt,
      amount_vat: cumulativeVat - (previous.billedVat?.[i] ?? 0),
      vat_rate: rate,
      treatment: rate > 0 ? "standard" : lineTreatment(l),
    })
  }

  if (state.every((s) => s.amount_ht === 0 && s.amount_vat === 0)) {
    return { ok: false, error: "Rien à facturer : l'avancement est identique à la situation précédente." }
  }

  const lines: BillingLine[] = []
  for (const s of state) {
    if (s.amount_ht === 0 && s.amount_vat === 0) continue
    const label = `${s.description} — avancement ${formatPercentFr(s.percent)} %${s.previous_percent > 0 ? ` (précédent ${formatPercentFr(s.previous_percent)} %)` : ""}`
    const vat = s.amount_vat
    lines.push(makeLine("situation", label, 1, s.amount_ht, s.amount_ht, vat, { rate: s.vat_rate, treatment: s.treatment }, {
      progress: {
        quote_line: s.quote_line,
        contract_ht: fromCents(s.contract_ht),
        previous_percent: s.previous_percent,
        percent: s.percent,
        previous_ht: fromCents(s.previous_ht),
        cumulative_ht: fromCents(s.cumulative_ht),
      },
    }))
  }

  const contractHt = state.reduce((t, s) => t + s.contract_ht, 0)
  const cumulativeHt = state.reduce((t, s) => t + s.cumulative_ht, 0)
  const previousHt = state.reduce((t, s) => t + s.previous_ht, 0)
  const final = state.every((s) => s.percent >= 100)
  const ded = deductDeposits(deposits.records, deposits.deducted, final ? { num: 1, den: 1 } : { num: cumulativeHt, den: contractHt })
  const all = [...lines, ...ded.lines]
  const ht = all.reduce((t, l) => t + toCents(l.total_ht), 0)
  const vat = all.reduce((t, l) => t + toCents(l.total_vat), 0)
  if (ht + vat < 0) return { ok: false, error: "La reprise des acomptes dépasse le montant de cette situation." }

  return {
    ok: true,
    lines: all,
    state,
    final,
    contract_ht: contractHt,
    previous_ht: previousHt,
    cumulative_ht: cumulativeHt,
    amount_ht: cumulativeHt - previousHt,
    cumulative_percent: contractHt === 0 ? 0 : Math.round((cumulativeHt / contractHt) * 10_000) / 100,
    deductions: ded.deductions,
    ht,
    vat,
    ttc: ht + vat,
  }
}

/* ------------------------------------------------------------------ */
/* Facture de solde                                                    */
/* ------------------------------------------------------------------ */

export interface FinalResult {
  ok: true
  lines: BillingLine[]
  deductions: BillingContext["deductions"]
  ht: number
  vat: number
  ttc: number
}

/** Facture de solde : toutes les lignes du devis, moins chaque acompte repris en ligne. */
export function computeFinal(quoteLines: SourceLine[], deposits: DepositRecord[], deducted: DeductedRecord[] = []): FinalResult | BillingError {
  if (quoteLines.length === 0) return { ok: false, error: "Le devis n'a aucune ligne." }
  if (deposits.length === 0) return { ok: false, error: "Aucun acompte à reprendre : convertissez simplement le devis en facture." }
  const copied: BillingLine[] = quoteLines.map((l, i) => {
    const { ht, vat } = lineCents(l)
    const rate = lineRate(l)
    const qty = Number(l.quantity)
    return {
      id: lineId("solde"),
      description: (l.description ?? "").trim() || `Ligne ${i + 1}`,
      quantity: Number.isFinite(qty) ? qty : 1,
      unit: l.unit ?? null,
      unit_price_ht: fromCents(toCents(l.unit_price_ht)),
      vat_rate: rate,
      total_ht: fromCents(ht),
      total_vat: fromCents(vat),
      total_ttc: fromCents(ht + vat),
      ...(rate === 0 && lineTreatment(l) !== "standard" ? { vat_treatment: lineTreatment(l) } : {}),
    }
  })
  const ded = deductDeposits(deposits, deducted, { num: 1, den: 1 })
  const all = [...copied, ...ded.lines]
  const ht = all.reduce((t, l) => t + toCents(l.total_ht), 0)
  const vat = all.reduce((t, l) => t + toCents(l.total_vat), 0)
  if (ht + vat < 0) return { ok: false, error: "Les acomptes dépassent le montant du devis : émettez un avoir sur l'acompte." }
  return { ok: true, lines: all, deductions: ded.deductions, ht, vat, ttc: ht + vat }
}

/* ------------------------------------------------------------------ */
/* Titres                                                              */
/* ------------------------------------------------------------------ */

/**
 * Nature et retenue d'une facture pour les emails (envoi, relances) :
 * « facture d'acompte », « situation de travaux n° 2 »… et la retenue de
 * garantie, à régler à sa libération. Facture ordinaire : rien.
 */
export function artisanEmailExtras(invoice: { invoice_kind?: unknown; billing_context?: unknown }): {
  docLabel: string | null
  retention: { rate: number; amount: number } | null
} {
  const ctx = parseBillingContext(invoice.billing_context)
  const kind = ctx?.kind ?? parseInvoiceKind(invoice.invoice_kind)
  if (kind === "standard") return { docLabel: null, retention: null }
  const title = invoiceTitle(kind, ctx)
  const r = ctx?.retention
  return {
    docLabel: title.charAt(0).toLowerCase() + title.slice(1),
    retention: r && r.mode === "retenue" && r.amount > 0 ? { rate: r.rate, amount: r.amount } : null,
  }
}

/** Titre imprimé sur le document (PDF, aperçu). */
export function invoiceTitle(kind: InvoiceKind, ctx?: Pick<BillingContext, "situation"> | null): string {
  if (kind === "deposit") return "Facture d'acompte"
  if (kind === "final") return "Facture de solde"
  if (kind === "situation") {
    const n = ctx?.situation?.number
    const base = n ? `Situation de travaux n° ${n}` : "Situation de travaux"
    return ctx?.situation?.final ? `${base} — décompte final` : base
  }
  return "Facture"
}

/** Libellé court (pastilles, listes). */
export function invoiceKindLabel(kind: InvoiceKind, ctx?: Pick<BillingContext, "situation"> | null): string | null {
  if (kind === "deposit") return "Acompte"
  if (kind === "final") return "Solde"
  if (kind === "situation") return ctx?.situation?.number ? `Situation n° ${ctx.situation.number}` : "Situation"
  return null
}

/** Lit un `billing_context` venu de la base (forme inconnue → null). */
export function parseBillingContext(value: unknown): BillingContext | null {
  if (!value || typeof value !== "object") return null
  const v = value as Partial<BillingContext>
  if (v.v !== 1 || !v.kind || !["deposit", "situation", "final"].includes(v.kind)) return null
  return {
    v: 1,
    kind: v.kind,
    quote: v.quote ?? null,
    chantier: v.chantier ?? null,
    deposit: v.deposit,
    situation: v.situation,
    deductions: Array.isArray(v.deductions) ? v.deductions : [],
    retention: v.retention ?? null,
  }
}
