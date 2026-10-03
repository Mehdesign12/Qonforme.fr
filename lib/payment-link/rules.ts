/**
 * Règles du lien de paiement, sans réseau ni base : montant restant dû, état
 * de la facture vu par le client, contrôle d'une déclaration de virement.
 * Utilisées par la page publique, ses routes et la fiche facture (réelle et démo).
 */
import { shiftDays, todayParis } from "@/components/search/model"

/** Statuts d'une facture émise et non réglée : seuls cas où la page propose de payer. */
export const PAYABLE_STATUSES = ["sent", "pending", "received", "accepted", "overdue"] as const

export const isPayableStatus = (status: string) => (PAYABLE_STATUSES as readonly string[]).includes(status)

/** Déclarations acceptées par facture sur 24 heures glissantes (limitation simple du formulaire public). */
export const DECLARATIONS_PER_DAY = 3
/** Longueur maximale de la note laissée par le client. */
export const NOTE_MAX = 500
/** Un virement peut précéder la facture (acompte réglé sur place, par exemple), dans cette limite. */
export const DAYS_BEFORE_ISSUE = 60

/** Jour « AAAA-MM-JJ » d'un horodatage, à l'heure de Paris (même rendu serveur et navigateur). */
export function parisDay(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : todayParis(d)
}

/** Heure « 18:12 » d'un horodatage, à l'heure de Paris ; vide pour une date seule. */
export function parisTime(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(d)
}

const toCents = (n: number | string | null | undefined) => Math.round(Number(n ?? 0) * 100)

/**
 * Montant restant dû : total TTC moins les avoirs déjà émis sur la facture,
 * au centime, jamais négatif. Les virements déclarés ne sont pas déduits :
 * seul l'artisan confirme un encaissement (« Marquer payée »).
 * `retention` : retenue de garantie de la facture (formule Artisan), payable
 * à sa libération et non à l'échéance (loi n° 71-584 du 16 juillet 1971,
 * art. 1er et 2) ; elle sort du montant demandé maintenant.
 */
export function remainingDue(
  totalTtc: number | string,
  credits: { total_ttc: number | string | null }[] = [],
  retention: number | string | null = 0,
): number {
  const cents = toCents(totalTtc) - credits.reduce((s, c) => s + toCents(c.total_ttc), 0) - Math.max(0, toCents(retention))
  return Math.max(0, cents) / 100
}

export type PayState = "payable" | "paid" | "credited" | "closed" | "draft"

/**
 * Ce que la page publique montre pour une facture :
 * - draft : jamais de page (un brouillon n'est pas une facture) ;
 * - paid : facture réglée ;
 * - credited : annulée par un avoir total (statut posé, ou avoirs qui couvrent tout) ;
 * - closed : rejetée ou annulée, rien à payer en ligne ;
 * - payable : émise, non réglée, reste dû positif.
 */
export function payState(status: string, remaining: number): PayState {
  if (status === "draft") return "draft"
  if (status === "paid") return "paid"
  if (status === "credited") return "credited"
  if (!isPayableStatus(status)) return "closed"
  return remaining > 0 ? "payable" : "credited"
}

/* ------------------------------------------------------------------ */
/* Déclaration « J'ai effectué le virement »                           */
/* ------------------------------------------------------------------ */

export interface Declaration {
  transferDate: string
  amount: number
  note: string | null
}

export type DeclarationResult =
  | { ok: true; value: Declaration }
  | { ok: false; field: "transfer_date" | "amount" | "note"; error: string }

/** Date « AAAA-MM-JJ » qui existe vraiment au calendrier. */
function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** « 1 234,56 », « 1234.5 » ou 1234.56 → 1234.56 ; null si ce n'est pas un montant en euros. */
export function parseAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value * 100) / 100 : null
  if (typeof value !== "string") return null
  const s = value.replace(/[\s  €]/g, "").replace(",", ".")
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) return null
  return Math.round(Number(s) * 100) / 100
}

/**
 * Contrôle une déclaration envoyée par la page publique. `today` est la date
 * du jour à Paris ; un jour d'avance est toléré (fuseau du client).
 */
export function parseDeclaration(
  input: unknown,
  ctx: { today: string; issueDate: string; remaining: number },
): DeclarationResult {
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>

  const transferDate = typeof body.transfer_date === "string" ? body.transfer_date.trim() : ""
  if (!isCalendarDate(transferDate)) {
    return { ok: false, field: "transfer_date", error: "Indiquez la date du virement." }
  }
  if (transferDate > shiftDays(ctx.today, 1)) {
    return { ok: false, field: "transfer_date", error: "La date du virement ne peut pas être dans le futur." }
  }
  if (transferDate < shiftDays(ctx.issueDate.slice(0, 10), -DAYS_BEFORE_ISSUE)) {
    return { ok: false, field: "transfer_date", error: "Cette date est trop ancienne pour cette facture." }
  }

  const amount = parseAmount(body.amount)
  if (amount === null || amount <= 0) {
    return { ok: false, field: "amount", error: "Indiquez le montant viré, en euros." }
  }
  if (Math.round(amount * 100) > Math.round(ctx.remaining * 100)) {
    return { ok: false, field: "amount", error: "Le montant dépasse ce qui reste à régler sur cette facture." }
  }

  let note: string | null = null
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== "string") return { ok: false, field: "note", error: "Note invalide." }
    // Caractères de contrôle retirés (sauf retours à la ligne), espaces superflus aussi
    const cleaned = body.note.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").trim()
    if (cleaned.length > NOTE_MAX) {
      return { ok: false, field: "note", error: `La note dépasse ${NOTE_MAX} caractères.` }
    }
    note = cleaned || null
  }

  return { ok: true, value: { transferDate, amount, note } }
}
