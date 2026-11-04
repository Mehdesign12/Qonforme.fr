/**
 * Remises des devis, factures, bons de commande et avoirs.
 *
 * Deux remises, cumulables :
 * - **par ligne** : en % ou en € sur le montant de la ligne (quantité × prix
 *   unitaire HT). Elle reste sur la ligne (`discount_kind`, `discount_value`,
 *   `discount_amount`) ; `total_ht` de la ligne est le montant **après** remise.
 * - **globale** : en % ou en € sur le total HT des lignes (après leurs propres
 *   remises), avant TVA. Elle est enregistrée comme des lignes
 *   `kind: "document_discount"`, une par taux de TVA, au prorata des bases de
 *   chaque taux (la TVA est due sur la base après remise, CGI art. 267, et la
 *   facture électronique veut une remise de pied par taux, BG-20).
 *
 * Ainsi la somme des `total_ht` / `total_vat` / `total_ttc` de toutes les
 * lignes reste le total du document : tous les calculs existants (totaux
 * enregistrés, FEC, tableau de bord, avoirs, situations) restent justes sans
 * rien connaître des remises.
 *
 * Tous les montants sont calculés en centimes entiers, arrondis au plus proche
 * (moitié vers le haut en valeur absolue), sans erreur de virgule flottante.
 * Testé par __tests__/discounts.test.ts (cas limites et milliers de documents
 * tirés au hasard).
 */

export type DiscountKind = "pct" | "eur"

export const DOCUMENT_DISCOUNT = "document_discount" as const

/** Libellé par défaut de la remise globale. */
export const DEFAULT_GLOBAL_LABEL = "Remise commerciale"

/** Remise globale telle que saisie. */
export interface GlobalDiscount {
  kind: DiscountKind
  value: number
  label: string
}

/** Ligne telle que la reçoivent les calculs (champs du JSON `lines`). */
export interface DiscountableLine {
  kind?: string | null
  description?: string | null
  quantity?: number | string | null
  unit_price_ht?: number | string | null
  vat_rate?: number | string | null
  vat_treatment?: string | null
  total_ht?: number | string | null
  total_vat?: number | string | null
  total_ttc?: number | string | null
  discount_kind?: string | null
  discount_value?: number | string | null
  discount_amount?: number | string | null
  discount_label?: string | null
}

/* ------------------------------------------------------------------ */
/* Arithmétique en centimes                                            */
/* ------------------------------------------------------------------ */

const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Arrondi au plus proche, moitié vers le haut en valeur absolue, sans l'erreur
 * de virgule flottante (1,005 × 100 = 100,4999… donnerait 100 au lieu de 101).
 */
export function roundHalfUp(x: number): number {
  if (!Number.isFinite(x)) return 0
  const r = Math.round(Math.abs(x) + 1e-7) * Math.sign(x)
  return r === 0 ? 0 : r
}

/** Euros → centimes entiers. */
export const toCents = (euros: unknown): number => roundHalfUp(num(euros) * 100)
/** Centimes → euros (deux décimales exactes). */
export const fromCents = (cents: number): number => cents / 100

/** TVA d'un montant HT en centimes, au taux donné (en %). */
export function vatCents(htCents: number, rate: number): number {
  return roundHalfUp((htCents * num(rate)) / 100)
}

/* ------------------------------------------------------------------ */
/* Lecture                                                             */
/* ------------------------------------------------------------------ */

export function isDocumentDiscountLine(line: DiscountableLine | null | undefined): boolean {
  return line?.kind === DOCUMENT_DISCOUNT
}

export function parseDiscountKind(v: unknown): DiscountKind | null {
  return v === "pct" || v === "eur" ? v : null
}

/** Lignes de prestations (sans les lignes de remise globale). */
export function itemLines<T extends DiscountableLine>(lines: T[] | null | undefined): T[] {
  return (lines ?? []).filter((l) => !isDocumentDiscountLine(l))
}

/* ------------------------------------------------------------------ */
/* Remise d'une ligne                                                  */
/* ------------------------------------------------------------------ */

export interface LineAmounts {
  /** Quantité × prix unitaire HT, en centimes. */
  grossCents: number
  /** Remise de la ligne, en centimes (≥ 0). */
  discountCents: number
  /** Montant HT après remise, en centimes. */
  netCents: number
  /** TVA de la ligne, en centimes. */
  vatCents: number
  /** Erreur de saisie de la remise, s'il y en a une. */
  error: string | null
}

/**
 * Montants d'une ligne de prestation. Le taux de TVA est celui de la ligne,
 * ou 0 (autoliquidation, franchise) si `forceZeroVat`.
 */
export function lineAmounts(line: DiscountableLine, forceZeroVat = false): LineAmounts {
  const grossCents = roundHalfUp(num(line.quantity) * num(line.unit_price_ht) * 100)
  const kind = parseDiscountKind(line.discount_kind)
  const value = num(line.discount_value)
  let discountCents = 0
  let error: string | null = null
  if (kind && value !== 0) {
    if (value < 0) error = "La remise ne peut pas être négative."
    else if (kind === "pct") {
      if (value > 100) error = "La remise ne peut pas dépasser 100 %."
      else discountCents = roundHalfUp((grossCents * value) / 100)
    } else {
      const wanted = roundHalfUp(value * 100)
      if (grossCents >= 0 && wanted > grossCents) error = "La remise dépasse le montant de la ligne."
      else discountCents = wanted
    }
    if (grossCents < 0 && discountCents > 0) {
      error = "Pas de remise sur une ligne négative."
      discountCents = 0
    }
  }
  if (error) discountCents = 0
  const netCents = grossCents - discountCents
  const rate = forceZeroVat ? 0 : num(line.vat_rate)
  return { grossCents, discountCents, netCents, vatCents: vatCents(netCents, rate), error }
}

/**
 * Montants d'une ligne déjà enregistrée : une ligne remisée est recalculée ;
 * une ligne sans remise garde ses totaux enregistrés (lignes de situation,
 * reprises d'acompte…), recalculés seulement s'ils manquent.
 */
export function storedLineAmounts(line: DiscountableLine, forceZeroVat = false): LineAmounts {
  const discounted = parseDiscountKind(line.discount_kind) && num(line.discount_value) !== 0
  if (discounted || line.total_ht == null || line.total_ht === "") return lineAmounts(line, forceZeroVat)
  const net = toCents(line.total_ht)
  const vat = forceZeroVat ? 0 : line.total_vat == null || line.total_vat === "" ? vatCents(net, num(line.vat_rate)) : toCents(line.total_vat)
  return { grossCents: net, discountCents: 0, netCents: net, vatCents: vat, error: null }
}

/** « −10 % », « −50,00 € » (colonne Remise des PDF et aperçus). */
export function lineDiscountLabel(line: DiscountableLine): string | null {
  const kind = parseDiscountKind(line.discount_kind)
  const value = num(line.discount_value)
  if (!kind || value <= 0) return null
  if (kind === "pct") return `−${formatPercent(value)} %`
  return `−${formatEuro(value)}`
}

/* ------------------------------------------------------------------ */
/* Remise globale                                                      */
/* ------------------------------------------------------------------ */

export interface DiscountGroup {
  rate: number
  /** Traitement de TVA (autoliquidation…) quand le taux est 0. */
  treatment: string | null
  /** Base HT du groupe avant la remise globale, en centimes. */
  baseCents: number
  /** Somme des TVA des lignes du groupe, en centimes. */
  vatCents: number
}

const groupKey = (rate: number, treatment: string | null) => `${rate}|${rate > 0 ? "" : treatment ?? ""}`

/** Bases HT par taux (et traitement) des lignes de prestation, après leurs remises. */
export function discountGroups(lines: DiscountableLine[], forceZeroVat = false): DiscountGroup[] {
  const groups = new Map<string, DiscountGroup>()
  for (const l of itemLines(lines)) {
    const rate = forceZeroVat ? 0 : num(l.vat_rate)
    const treatment = rate > 0 ? null : (l.vat_treatment ?? null)
    const key = groupKey(rate, treatment)
    const g = groups.get(key) ?? { rate, treatment, baseCents: 0, vatCents: 0 }
    const a = storedLineAmounts(l, forceZeroVat)
    g.baseCents += a.netCents
    g.vatCents += a.vatCents
    groups.set(key, g)
  }
  return Array.from(groups.values()).sort((a, b) => b.rate - a.rate)
}

/** Montant de la remise globale, en centimes, sur une base totale (positive). */
export function globalDiscountCents(discount: GlobalDiscount | null | undefined, baseCents: number): { cents: number; error: string | null } {
  if (!discount) return { cents: 0, error: null }
  const value = num(discount.value)
  if (value === 0) return { cents: 0, error: null }
  if (value < 0) return { cents: 0, error: "La remise ne peut pas être négative." }
  if (discount.kind === "pct") {
    if (baseCents <= 0) return { cents: 0, error: null }
    if (value > 100) return { cents: 0, error: "La remise ne peut pas dépasser 100 %." }
    return { cents: roundHalfUp((baseCents * value) / 100), error: null }
  }
  const wanted = roundHalfUp(value * 100)
  if (wanted > Math.max(0, baseCents)) return { cents: 0, error: "La remise dépasse le total HT." }
  return { cents: wanted, error: null }
}

/**
 * Répartit `amount` centimes sur les groupes au prorata de leur base positive
 * (méthode du plus grand reste) : la somme des parts vaut exactement `amount`,
 * aucune part ne dépasse la base de son groupe.
 */
export function allocate(amount: number, bases: number[]): number[] {
  const positive = bases.map((b) => Math.max(0, b))
  const total = positive.reduce((s, b) => s + b, 0)
  if (amount <= 0 || total <= 0) return bases.map(() => 0)
  const capped = Math.min(amount, total)
  const exact = positive.map((b) => (capped * b) / total)
  const shares = exact.map((e) => Math.floor(e + 1e-9))
  let rest = capped - shares.reduce((s, x) => s + x, 0)
  const order = exact
    .map((e, i) => ({ i, frac: e - shares[i], base: positive[i] }))
    .sort((a, b) => b.frac - a.frac || b.base - a.base || a.i - b.i)
  for (const o of order) {
    if (rest <= 0) break
    if (shares[o.i] < positive[o.i]) { shares[o.i] += 1; rest -= 1 }
  }
  return shares
}

/** Lignes de remise globale (une par taux), à ajouter après les prestations. */
export function buildGlobalDiscountLines(
  lines: DiscountableLine[],
  discount: GlobalDiscount | null | undefined,
  forceZeroVat = false,
): { lines: DocumentDiscountLine[]; cents: number; error: string | null } {
  if (!discount) return { lines: [], cents: 0, error: null }
  const groups = discountGroups(lines, forceZeroVat)
  const base = groups.reduce((s, g) => s + Math.max(0, g.baseCents), 0)
  const { cents, error } = globalDiscountCents(discount, base)
  if (error || cents === 0) return { lines: [], cents: 0, error }
  const shares = allocate(cents, groups.map((g) => g.baseCents))
  const label = (discount.label ?? "").trim() || DEFAULT_GLOBAL_LABEL
  const withRate = groups.filter((_, i) => shares[i] > 0).length > 1
  const out: DocumentDiscountLine[] = []
  groups.forEach((g, i) => {
    const share = shares[i]
    if (share <= 0) return
    const ht = 0 - share
    // TVA de la remise : ce qu'il faut retirer pour que la TVA du taux soit
    // exactement celle de la base après remise (TVA par taux, BR-CO-17) ;
    // une remise de 100 % ramène ainsi la TVA à 0, sans centime résiduel.
    const vat = vatCents(g.baseCents - share, g.rate) - g.vatCents
    out.push({
      kind: DOCUMENT_DISCOUNT,
      description: withRate ? `${label} (TVA ${formatPercent(g.rate)} %)` : label,
      quantity: 1,
      unit_price_ht: fromCents(ht),
      vat_rate: g.rate,
      total_ht: fromCents(ht),
      total_vat: fromCents(vat),
      total_ttc: fromCents(ht + vat),
      discount_kind: discount.kind,
      discount_value: num(discount.value),
      discount_label: label,
      ...(g.treatment ? { vat_treatment: g.treatment } : {}),
    })
  })
  return { lines: out, cents, error: null }
}

export interface DocumentDiscountLine {
  kind: typeof DOCUMENT_DISCOUNT
  description: string
  quantity: 1
  unit_price_ht: number
  vat_rate: number
  total_ht: number
  total_vat: number
  total_ttc: number
  discount_kind: DiscountKind
  discount_value: number
  discount_label: string
  vat_treatment?: string
}

/** Remise globale d'un document enregistré (pour la rouvrir dans l'éditeur). */
export function readGlobalDiscount(lines: DiscountableLine[] | null | undefined): GlobalDiscount | null {
  const first = (lines ?? []).find(isDocumentDiscountLine)
  if (!first) return null
  const kind = parseDiscountKind(first.discount_kind) ?? "eur"
  const value = kind === "eur"
    ? fromCents(-(lines ?? []).filter(isDocumentDiscountLine).reduce((s, l) => s + toCents(l.total_ht), 0))
    : num(first.discount_value)
  return { kind, value, label: (first.discount_label ?? "").trim() || DEFAULT_GLOBAL_LABEL }
}

/* ------------------------------------------------------------------ */
/* Document complet                                                    */
/* ------------------------------------------------------------------ */

export interface ComputedItem {
  grossCents: number
  discountCents: number
  netCents: number
  vatCents: number
  error: string | null
}

export interface DocumentComputation {
  items: ComputedItem[]
  discountLines: DocumentDiscountLine[]
  /** Somme des quantités × prix, avant toute remise. */
  grossCents: number
  /** Somme des remises de ligne. */
  lineDiscountCents: number
  /** Remise globale. */
  globalDiscountCents: number
  /** Total HT après remises. */
  htCents: number
  vatCents: number
  ttcCents: number
  /** Erreur de la remise globale, s'il y en a une. */
  globalError: string | null
}

/**
 * Calcule un document : chaque ligne avec sa remise, puis la remise globale
 * répartie par taux, puis les totaux (somme des lignes, TVA arrondie ligne
 * par ligne comme le reste de l'application).
 */
export function computeDocument(
  lines: DiscountableLine[],
  discount: GlobalDiscount | null | undefined,
  forceZeroVat = false,
): DocumentComputation {
  const items = itemLines(lines).map((l) => storedLineAmounts(l, forceZeroVat))
  const global = buildGlobalDiscountLines(lines, discount, forceZeroVat)
  const grossCents = items.reduce((s, i) => s + i.grossCents, 0)
  const lineDiscountCents = items.reduce((s, i) => s + i.discountCents, 0)
  const htCents = items.reduce((s, i) => s + i.netCents, 0) + global.lines.reduce((s, l) => s + toCents(l.total_ht), 0)
  const vat = items.reduce((s, i) => s + i.vatCents, 0) + global.lines.reduce((s, l) => s + toCents(l.total_vat), 0)
  return {
    items,
    discountLines: global.lines,
    grossCents,
    lineDiscountCents,
    globalDiscountCents: global.cents,
    htCents,
    vatCents: vat,
    ttcCents: htCents + vat,
    globalError: global.error,
  }
}

/* ------------------------------------------------------------------ */
/* Affichage (PDF, aperçus, fiches)                                    */
/* ------------------------------------------------------------------ */

export interface DiscountSummary {
  /** Total HT avant toute remise. */
  gross: number
  /** Somme des remises de ligne (positive). */
  lineDiscount: number
  /** Remise globale (positive) et son libellé (« Remise commerciale 5 % »). */
  global: { label: string; amount: number } | null
  /** Au moins une ligne a une remise : colonne « Remise » à afficher. */
  hasLineDiscount: boolean
}

/**
 * Lignes de récapitulatif à placer avant « Total HT », ou null si le document
 * n'a aucune remise (rendu inchangé).
 */
export function discountSummary(lines: DiscountableLine[] | null | undefined): DiscountSummary | null {
  const all = lines ?? []
  const items = itemLines(all)
  const lineDiscount = items.reduce((s, l) => s + Math.max(0, toCents(l.discount_amount)), 0)
  const globals = all.filter(isDocumentDiscountLine)
  const globalCents = -globals.reduce((s, l) => s + toCents(l.total_ht), 0)
  if (lineDiscount === 0 && globalCents === 0) return null
  const gross = items.reduce((s, l) => s + toCents(l.total_ht) + Math.max(0, toCents(l.discount_amount)), 0)
  let global: DiscountSummary["global"] = null
  if (globals.length > 0 && globalCents !== 0) {
    const g = readGlobalDiscount(all)!
    global = {
      label: g.kind === "pct" ? `${g.label} ${formatPercent(g.value)} %` : g.label,
      amount: fromCents(globalCents),
    }
  }
  return { gross: fromCents(gross), lineDiscount: fromCents(lineDiscount), global, hasLineDiscount: lineDiscount > 0 }
}

/* ------------------------------------------------------------------ */
/* Contrôle côté serveur                                               */
/* ------------------------------------------------------------------ */

/**
 * Vérifie et recalcule les remises reçues d'un navigateur : chaque ligne
 * remisée reprend son montant net exact, les lignes de remise globale sont
 * reconstruites à partir de la remise demandée. Les lignes sans remise ne sont
 * pas touchées (même calcul qu'avant). Rend une erreur lisible si une remise
 * est impossible (plus de 100 %, plus que la ligne, négative…).
 */
export function normalizeDiscountLines<T extends DiscountableLine>(
  lines: T[] | null | undefined,
): { ok: true; lines: (T | DocumentDiscountLine)[] } | { ok: false; error: string } {
  const list = lines ?? []
  const items = itemLines(list)
  const hasGlobal = list.some(isDocumentDiscountLine)
  const hasLineDiscount = items.some((l) => parseDiscountKind(l.discount_kind) && num(l.discount_value) !== 0)
  const reverseCharge = items.length > 0 && items.every((l) => l.vat_treatment === "autoliquidation_btp")
  // Sans remise : lignes inchangées, seuls les totaux absents sont calculés
  if (!hasGlobal && !hasLineDiscount) {
    return {
      ok: true,
      lines: list.map((l) => {
        if (l.total_ht != null && l.total_ht !== "") return l
        const a = lineAmounts(l, reverseCharge)
        return { ...l, total_ht: fromCents(a.netCents), total_vat: fromCents(a.vatCents), total_ttc: fromCents(a.netCents + a.vatCents) }
      }),
    }
  }

  const fixed: T[] = []
  for (let i = 0; i < items.length; i++) {
    const l = items[i]
    const kind = parseDiscountKind(l.discount_kind)
    if (!kind || num(l.discount_value) === 0) {
      const { discount_kind: _k, discount_value: _v, discount_amount: _a, ...rest } = l
      void _k; void _v; void _a
      // Totaux absents : calculés (une ligne sans remise garde sinon les siens, comme avant)
      if (rest.total_ht == null || rest.total_ht === "") {
        const a = lineAmounts(rest, reverseCharge)
        fixed.push({ ...rest, total_ht: fromCents(a.netCents), total_vat: fromCents(a.vatCents), total_ttc: fromCents(a.netCents + a.vatCents) } as T)
      } else fixed.push(rest as T)
      continue
    }
    const a = lineAmounts(l, reverseCharge)
    if (a.error) return { ok: false, error: `Ligne ${i + 1} : ${a.error}` }
    fixed.push({
      ...l,
      discount_kind: kind,
      discount_value: num(l.discount_value),
      discount_amount: fromCents(a.discountCents),
      total_ht: fromCents(a.netCents),
      total_vat: fromCents(a.vatCents),
      total_ttc: fromCents(a.netCents + a.vatCents),
    })
  }
  const global = hasGlobal ? readGlobalDiscount(list) : null
  const rebuilt = buildGlobalDiscountLines(fixed, global, reverseCharge)
  if (rebuilt.error) return { ok: false, error: `Remise globale : ${rebuilt.error}` }
  return { ok: true, lines: [...fixed, ...rebuilt.lines] }
}

/** Totaux d'un document (somme exacte des lignes, en euros). */
export function sumLines(lines: DiscountableLine[] | null | undefined): { subtotal_ht: number; total_vat: number; total_ttc: number } {
  const ht = (lines ?? []).reduce((s, l) => s + toCents(l.total_ht), 0)
  const vat = (lines ?? []).reduce((s, l) => s + toCents(l.total_vat), 0)
  return { subtotal_ht: fromCents(ht), total_vat: fromCents(vat), total_ttc: fromCents(ht + vat) }
}

/* ------------------------------------------------------------------ */
/* Formats                                                             */
/* ------------------------------------------------------------------ */

/** 5 → « 5 », 12.5 → « 12,5 ». */
export function formatPercent(v: number): string {
  return String(Math.round(v * 100) / 100).replace(".", ",")
}

function formatEuro(v: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v).replace(/ /g, " ")
}

/**
 * Lignes reçues d'un formulaire, prêtes à enregistrer : remises contrôlées et
 * recalculées, totaux du document au centime (somme exacte des lignes).
 */
export function prepareLinesForSave(lines: unknown):
  | { ok: true; lines: DiscountableLine[]; subtotal_ht: number; total_vat: number; total_ttc: number }
  | { ok: false; error: string } {
  const list = Array.isArray(lines) ? (lines as DiscountableLine[]) : []
  const norm = normalizeDiscountLines(list)
  if (!norm.ok) return norm
  return { ok: true, lines: norm.lines, ...sumLines(norm.lines) }
}

/**
 * Avoir partiel d'une facture remisée : les prestations choisies (par leur
 * rang parmi les prestations) gardent leur remise de ligne ; la remise globale
 * est reprise au prorata, taux par taux, du montant choisi. Toutes les
 * prestations choisies redonnent exactement la facture.
 */
export function creditLinesFromSelection<T extends DiscountableLine>(
  lines: T[] | null | undefined,
  selectedItemIndexes: number[],
): (T | DiscountableLine)[] {
  const all = lines ?? []
  const items = itemLines(all)
  const wanted = new Set(selectedItemIndexes.filter((i) => Number.isInteger(i) && i >= 0 && i < items.length))
  const chosen = items.filter((_, i) => wanted.has(i))
  if (wanted.size === items.length) return all.slice()
  const keyOf = (l: DiscountableLine) => groupKey(num(l.vat_rate), num(l.vat_rate) > 0 ? null : (l.vat_treatment ?? null))
  const netBy = (list: DiscountableLine[]) => {
    const m = new Map<string, number>()
    for (const l of list) m.set(keyOf(l), (m.get(keyOf(l)) ?? 0) + toCents(l.total_ht))
    return m
  }
  const totalNet = netBy(items)
  const chosenNet = netBy(chosen)
  const out: (T | DiscountableLine)[] = [...chosen]
  for (const d of all.filter(isDocumentDiscountLine)) {
    const key = keyOf(d)
    const total = totalNet.get(key) ?? 0
    const part = chosenNet.get(key) ?? 0
    if (total <= 0 || part <= 0) continue
    const ht = roundHalfUp((toCents(d.total_ht) * part) / total)
    const vat = roundHalfUp((toCents(d.total_vat) * part) / total)
    if (ht === 0 && vat === 0) continue
    out.push({ ...d, unit_price_ht: fromCents(ht), total_ht: fromCents(ht), total_vat: fromCents(vat), total_ttc: fromCents(ht + vat) })
  }
  return out
}

/**
 * Lignes de prestation avec la remise globale répartie dedans (situations de
 * travaux) : chaque ligne de remise globale est répartie sur les prestations de
 * son taux au prorata de leur montant net (plus grand reste), HT et TVA à part.
 * La somme des lignes rendues égale exactement celle du document, taux par taux.
 * Sans remise globale, les prestations sont rendues telles quelles.
 */
export function foldGlobalDiscount<T extends DiscountableLine>(lines: T[] | null | undefined): T[] {
  const list = lines ?? []
  const items = itemLines(list) as T[]
  const pseudo = list.filter(isDocumentDiscountLine)
  if (pseudo.length === 0) return items
  const reverseCharge = items.length > 0 && items.every((l) => l.vat_treatment === "autoliquidation_btp")
  const keyOf = (l: DiscountableLine) => {
    const rate = reverseCharge ? 0 : num(l.vat_rate)
    return groupKey(rate, rate > 0 ? null : (l.vat_treatment ?? null))
  }
  const ht = items.map((l) => toCents(l.total_ht))
  const vat = items.map((l) => storedLineAmounts(l, reverseCharge).vatCents)
  const spread = (amount: number, idx: number[], bases: number[], into: number[]) => {
    if (amount === 0 || idx.length === 0) return
    const shares = allocate(Math.abs(amount), idx.map((i) => bases[i]))
    const sign = amount < 0 ? -1 : 1
    // Base nulle (tout le groupe à 0) : rien à répartir, la part va à la première ligne
    const placed = shares.reduce((s, x) => s + x, 0)
    idx.forEach((i, k) => { into[i] += sign * shares[k] })
    if (placed < Math.abs(amount)) into[idx[0]] += sign * (Math.abs(amount) - placed)
  }
  for (const p of pseudo) {
    const idx = items.map((l, i) => (keyOf(l) === keyOf(p) ? i : -1)).filter((i) => i >= 0)
    if (idx.length === 0) continue
    const baseHt = ht.slice()
    spread(toCents(p.total_ht), idx, baseHt, ht)
    spread(toCents(p.total_vat), idx, vat.map((v, i) => (v > 0 ? v : baseHt[i])), vat)
  }
  return items.map((l, i) => ({
    ...l,
    total_ht: fromCents(ht[i]),
    total_vat: fromCents(vat[i]),
    total_ttc: fromCents(ht[i] + vat[i]),
  }))
}
