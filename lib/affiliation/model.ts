/**
 * Affiliation : règles pures (sans base ni réseau), partagées par l'admin, la
 * page du partenaire, le webhook Stripe et les tests.
 *
 * - Un partenaire a un code (`?ref=code`) ; ses liens mènent directement à une
 *   page de qonforme.fr, sans redirection, pour garder la valeur du backlink
 *   (la balise canonique de la page retire le paramètre).
 * - La commission porte sur les sommes réellement payées par un compte inscrit
 *   après son lien, pendant `commission_months` après l'inscription. Elle est
 *   « en attente » pendant les 30 jours de la garantie de remboursement, puis
 *   « à verser » ; un remboursement l'annule ; le versement se note à la main.
 */

/** Paramètre d'adresse lu à l'arrivée. */
export const REF_PARAM = "ref"
/** Cookie qui garde le code jusqu'à l'inscription (politique de confidentialité § 8.2). */
export const REF_COOKIE = "q_ref"
/** Durée du cookie : 90 jours. */
export const REF_COOKIE_MAX_AGE_S = 90 * 24 * 3600
/** Un rechargement de la même page dans ce délai ne compte pas une seconde visite. */
export const VISIT_DEDUP_MS = 30 * 60 * 1000
/** Délai de la garantie de remboursement : la commission devient due après. */
export const COMMISSION_HOLD_DAYS = 30
/** Durée de vie des recommandations de pages (une analyse OpenSEO coûte des crédits). */
export const RECOMMENDATIONS_TTL_DAYS = 30
/** Une page déclarée est revérifiée au bout de 7 jours. */
export const LINK_CHECK_INTERVAL_DAYS = 7

export const DEFAULT_RATE = 20
export const DEFAULT_MONTHS = 12
export const MAX_RATE = 50

const DAY = 24 * 3600 * 1000

/* ------------------------------------------------------------------ */
/* Code                                                                */
/* ------------------------------------------------------------------ */

/** « Le Mag du Bâtiment » → « lemagdubatiment » (32 caractères au plus). */
export function slugCode(value: string): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 32)
}

export function isValidCode(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9]{2,32}$/.test(value)
}

/** Code lu dans une adresse (`?ref=`) : en minuscules, sinon null. */
export function refFromParam(value: string | null | undefined): string | null {
  const v = (value ?? "").trim().toLowerCase()
  return isValidCode(v) ? v : null
}

/** Cookie « code.horodatage » : relu sans confiance. */
export function parseRefCookie(raw: string | null | undefined): { code: string; at: number } | null {
  if (!raw) return null
  const [code, at] = raw.split(".")
  const ts = Number(at)
  if (!isValidCode(code) || !Number.isFinite(ts) || ts <= 0) return null
  return { code, at: ts }
}

export function refCookieValue(code: string, now: number): string {
  return `${code}.${now}`
}

/** Faut-il compter une nouvelle visite ? Non si le même code a été vu il y a moins de 30 minutes. */
export function shouldCountVisit(previous: { code: string; at: number } | null, code: string, now: number): boolean {
  if (!previous || previous.code !== code) return true
  return now - previous.at >= VISIT_DEDUP_MS || now < previous.at
}

/** Chemin d'arrivée gardé : interne, sans paramètre, 512 caractères au plus. */
export function landingPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/"
  return value.split(/[?#]/)[0].slice(0, 512) || "/"
}

/* ------------------------------------------------------------------ */
/* Site et pages du partenaire                                         */
/* ------------------------------------------------------------------ */

/** « https://www.Mag-Batiment.fr/blog » → « mag-batiment.fr » ; null si ce n'est pas un domaine. */
export function siteDomain(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim().toLowerCase()
  if (!raw) return null
  let host: string
  try {
    host = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`).hostname
  } catch {
    return null
  }
  host = host.replace(/^www\./, "")
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) || /^\d+(\.\d+)+$/.test(host)) return null
  return host
}

/** Adresse d'une page normalisée pour la comparer et la stocker : « domaine/chemin », sans protocole, www, paramètre ni barre finale. */
export function normalizePageUrl(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim()
  if (!raw) return null
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  const host = siteDomain(url.hostname)
  if (!host) return null
  const path = url.pathname.replace(/\/+$/, "")
  return `${host}${path}`.slice(0, 2048)
}

/* ------------------------------------------------------------------ */
/* Lien à donner                                                       */
/* ------------------------------------------------------------------ */

export const SITE_URL = "https://qonforme.fr"

/** Lien à donner au partenaire : la page visée, avec `?ref=code` (aucune redirection). */
export function partnerLink(path: string, code: string): string {
  const p = path.startsWith("/") ? path : `/${path}`
  return `${SITE_URL}${p}?${REF_PARAM}=${encodeURIComponent(code)}`
}

/** Code HTML à coller dans un article (lien normal : aucun attribut rel). */
export function partnerLinkHtml(path: string, code: string, anchor: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  return `<a href="${esc(partnerLink(path, code))}">${esc(anchor)}</a>`
}

/* ------------------------------------------------------------------ */
/* Commissions                                                         */
/* ------------------------------------------------------------------ */

export type CommissionState = "earned" | "paid_out" | "void"
/** État affiché : la commission acquise est « en attente » pendant la garantie, puis « à verser ». */
export type CommissionDisplay = "pending" | "due" | "paid_out" | "void"

export function commissionCents(amountPaidCents: number, rate: number): number {
  if (!(amountPaidCents > 0) || !(rate > 0)) return 0
  return Math.round((amountPaidCents * Math.min(rate, MAX_RATE)) / 100)
}

/** Un paiement à cette date donne-t-il une commission ? Seulement dans les `months` mois qui suivent l'inscription. */
export function withinCommissionWindow(signedUpAt: Date, paidAt: Date, months: number): boolean {
  if (paidAt.getTime() < signedUpAt.getTime() - DAY) return false
  const end = new Date(signedUpAt)
  end.setUTCMonth(end.getUTCMonth() + months)
  return paidAt.getTime() <= end.getTime()
}

/** Date à partir de laquelle une commission acquise devient due. */
export function dueDateOf(paidAt: Date | string): Date {
  return new Date(new Date(paidAt).getTime() + COMMISSION_HOLD_DAYS * DAY)
}

export function displayState(state: CommissionState, paidAt: Date | string, now: Date = new Date()): CommissionDisplay {
  if (state === "paid_out") return "paid_out"
  if (state === "void") return "void"
  return dueDateOf(paidAt).getTime() <= now.getTime() ? "due" : "pending"
}

export const DISPLAY_LABEL: Record<CommissionDisplay, string> = {
  pending: "En attente",
  due: "À verser",
  paid_out: "Versée",
  void: "Annulée (remboursé)",
}

export const DISPLAY_TONE: Record<CommissionDisplay, "neutral" | "info" | "ok" | "danger"> = {
  pending: "neutral",
  due: "info",
  paid_out: "ok",
  void: "danger",
}

export interface CommissionRow {
  state: CommissionState
  paid_at: string
  commission_cents: number
  amount_paid_cents: number
  livemode: boolean
}

export interface CommissionTotals {
  pending: number
  due: number
  paidOut: number
  voided: number
  /** Commissions non annulées (en attente, à verser et versées). */
  total: number
}

/** Totaux en centimes, production seulement (une commission du bac à sable ne compte jamais). */
export function commissionTotals(rows: CommissionRow[], now: Date = new Date()): CommissionTotals {
  const t: CommissionTotals = { pending: 0, due: 0, paidOut: 0, voided: 0, total: 0 }
  for (const r of rows) {
    if (!r.livemode) continue
    const d = displayState(r.state, r.paid_at, now)
    if (d === "void") {
      t.voided += r.commission_cents
      continue
    }
    if (d === "pending") t.pending += r.commission_cents
    if (d === "due") t.due += r.commission_cents
    if (d === "paid_out") t.paidOut += r.commission_cents
    t.total += r.commission_cents
  }
  return t
}

/* ------------------------------------------------------------------ */
/* Formats                                                             */
/* ------------------------------------------------------------------ */

const NNBSP = " "

export function euros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function percent(part: number, whole: number): string {
  if (!whole) return "—"
  return `${(Math.round((part / whole) * 1000) / 10).toLocaleString("fr-FR")}${NNBSP}%`
}

export function rateText(rate: number, months: number): string {
  return `${rate.toLocaleString("fr-FR")}${NNBSP}% des sommes payées, pendant ${months} mois après l'inscription du client`
}

/** Semaines (lundi, heure de Paris approchée par UTC) des `count` dernières semaines, de la plus ancienne à la plus récente. */
export function weekStarts(now: Date, count: number): Date[] {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - day)
  const out: Date[] = []
  for (let i = count - 1; i >= 0; i--) out.push(new Date(d.getTime() - i * 7 * DAY))
  return out
}

/** Visites par semaine à partir de leurs dates. */
export function weeklyCounts(dates: string[], now: Date, count = 8): { start: Date; count: number }[] {
  const starts = weekStarts(now, count)
  const out = starts.map((start) => ({ start, count: 0 }))
  for (const raw of dates) {
    const t = new Date(raw).getTime()
    if (!Number.isFinite(t)) continue
    for (let i = out.length - 1; i >= 0; i--) {
      if (t >= out[i].start.getTime()) {
        if (i === out.length - 1 || t < out[i + 1].start.getTime()) out[i].count++
        break
      }
    }
  }
  return out
}
