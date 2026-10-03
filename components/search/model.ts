/**
 * Recherche ⌘K et cloche « À surveiller » : types et règles partagés par les
 * routes (/api/search, /api/attention) et par la démo (calcul local sur
 * lib/demo/data). Module pur, sans réseau ni base : utilisable des deux côtés.
 */
import { formatCurrency } from "@/lib/utils/invoice"
import { formatSiren } from "@/components/layout/shell"

/* ------------------------------------------------------------------ */
/* Recherche                                                           */
/* ------------------------------------------------------------------ */

/** Nombre de caractères avant de chercher dans les documents. */
export const SEARCH_MIN = 2
/** Résultats par groupe (factures, devis, clients). */
export const SEARCH_LIMIT = 5

/** Facture ou devis trouvé. */
export interface DocHit {
  id: string
  number: string
  client: string | null
  amount: number
  status: string
  href: string
}

/** Client trouvé, avec sa ligne de contexte (« Nantes · 2 factures en cours · … »). */
export interface ClientHit {
  id: string
  name: string
  meta: string
  href: string
}

export interface SearchResults {
  invoices: DocHit[]
  quotes: DocHit[]
  clients: ClientHit[]
}

export const EMPTY_RESULTS: SearchResults = { invoices: [], quotes: [], clients: [] }

/** Factures émises et non réglées (mêmes statuts que la relance). */
export const OPEN_INVOICE_STATUSES = ["sent", "pending", "received", "accepted", "overdue"] as const

/** Minuscules, sans accents : « Bâti » et « bati » se retrouvent. */
export function normalizeText(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

/** Ligne de contexte d'un client : ville, puis encours ou SIREN. */
export function clientMeta(c: { city?: string | null; siren?: string | null; openCount: number; openAmount: number }): string {
  const parts: string[] = []
  if (c.city) parts.push(c.city)
  if (c.openCount > 0) {
    parts.push(`${c.openCount} facture${c.openCount > 1 ? "s" : ""} en cours`)
    parts.push(`${formatCurrency(c.openAmount)} à encaisser`)
  } else {
    const siren = formatSiren(c.siren ?? null)
    parts.push(siren ? `SIREN ${siren}` : "Aucune facture en cours")
  }
  return parts.join(" · ")
}

/* ------------------------------------------------------------------ */
/* À surveiller                                                        */
/* ------------------------------------------------------------------ */

/** Éléments affichés dans la cloche. */
export const ATTENTION_LIMIT = 8
/** Au-delà, un devis sans réponse ou un brouillon mérite un coup d'œil. */
export const STALE_DAYS = 7

/** « transfer » : virement déclaré par un client sur la page de règlement, à vérifier (lib/payment-link). */
export type AttentionKind = "overdue" | "quote" | "draft" | "transfer"

export interface AttentionItem {
  id: string
  kind: AttentionKind
  title: string
  meta: string
  href: string
}

export interface AttentionData {
  items: AttentionItem[]
  counts: { overdue: number; quotes: number; drafts: number; transfers?: number }
  total: number
}

/** Aujourd'hui à Paris (AAAA-MM-JJ), heure d'été comprise. */
export function todayParis(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now)
}

/** Décale une date AAAA-MM-JJ de `days` jours (calcul en UTC, sans dérive d'heure d'été). */
export function shiftDays(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Jours calendaires entre deux dates AAAA-MM-JJ. */
export function daysBetween(fromIso: string, toIso: string): number {
  const at = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((at(toIso) - at(fromIso)) / 86_400_000)
}

/** Facture en retard : marquée comme telle, ou émise, non réglée et échue (heure de Paris). */
export function isInvoiceOverdue(status: string, dueDate: string | null | undefined, today: string): boolean {
  if (status === "overdue") return true
  if (!dueDate) return false
  return ["sent", "pending", "received", "accepted"].includes(status) && dueDate.slice(0, 10) < today
}

const days = (n: number) => `${n} jour${n > 1 ? "s" : ""}`

export function overdueItem(
  inv: { id: string; number: string; client: string | null; amount: number; dueDate: string | null },
  today: string,
  href: string,
): AttentionItem {
  const late = inv.dueDate ? daysBetween(inv.dueDate, today) : 0
  return {
    id: `overdue-${inv.id}`,
    kind: "overdue",
    title: `${inv.client ?? "Client"} · ${late > 0 ? `${days(late)} de retard` : "en retard"}`,
    meta: `${inv.number} · ${formatCurrency(inv.amount)}`,
    href,
  }
}

export function quoteItem(
  q: { id: string; number: string; client: string | null; sentDay: string },
  today: string,
  href: string,
): AttentionItem {
  return {
    id: `quote-${q.id}`,
    kind: "quote",
    title: `Devis ${q.number} sans réponse`,
    meta: `${q.client ?? "Client"} · envoyé il y a ${days(daysBetween(q.sentDay, today))}`,
    href,
  }
}

export function draftItem(
  d: { id: string; kind: "invoice" | "quote"; number: string | null; client: string | null; createdDay: string },
  today: string,
  href: string,
): AttentionItem {
  return {
    id: `draft-${d.kind}-${d.id}`,
    kind: "draft",
    // Un brouillon de facture n'a pas encore de numéro (attribué à l'émission)
    title: `${d.kind === "invoice" ? "Facture" : "Devis"}${d.number ? ` ${d.number}` : ""} en brouillon`,
    meta: `${d.client ?? "Client"} · créé il y a ${days(daysBetween(d.createdDay, today))}`,
    href,
  }
}

/** Virement déclaré par le client, en attente de vérification par l'artisan. */
export function transferItem(
  t: { id: string; number: string; client: string | null; amount: number; transferDate: string },
  href: string,
): AttentionItem {
  const [y, m, d] = t.transferDate.slice(0, 10).split("-")
  return {
    id: `transfer-${t.id}`,
    kind: "transfer",
    title: `${t.client ?? "Client"} · virement déclaré`,
    meta: `${t.number} · ${formatCurrency(t.amount)} · le ${d}/${m}/${y}`,
    href,
  }
}

/**
 * Virements déclarés d'abord (un encaissement à vérifier), puis retards, devis
 * sans réponse et brouillons ; plafonné à ATTENTION_LIMIT.
 */
export function mergeAttention(
  overdue: AttentionItem[], quotes: AttentionItem[], drafts: AttentionItem[], transfers: AttentionItem[] = [],
): AttentionItem[] {
  return [...transfers, ...overdue, ...quotes, ...drafts].slice(0, ATTENTION_LIMIT)
}
