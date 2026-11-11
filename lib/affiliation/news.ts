/**
 * « Nouveaux événements » de l'affiliation dans l'admin : nouvelle commission
 * (en attente), commission devenue à verser (fin de la garantie de 30 jours),
 * commission annulée, nouvel inscrit venu d'un partenaire.
 *
 * Ce que l'admin a déjà vu vit dans un cookie de son navigateur (`q_aff_seen`,
 * chemin /admin, aucune donnée personnelle : des dates seulement). Visiter un
 * onglet des commissions le marque vu ; visiter la fiche d'un partenaire marque
 * vus tous ses événements ; visiter la liste des partenaires marque vus les inscrits.
 */
import { COMMISSION_HOLD_DAYS, type CommissionDisplay } from "@/lib/affiliation/model"

export const SEEN_COOKIE = "q_aff_seen"
/** Événement du navigateur lancé quand la page marque des événements vus. */
export const AFF_SEEN_EVENT = "aff-seen"
const DAY = 24 * 60 * 60 * 1000
const MAX_PARTNERS = 60

export type EventKind = "pending" | "due" | "void"
export const EVENT_KINDS: EventKind[] = ["due", "pending", "void"]

export interface Seen {
  /** Dernière visite de chaque onglet des commissions (ms). */
  c: Partial<Record<EventKind, number>>
  /** Dernière visite de la liste des partenaires (inscrits). */
  s?: number
  /** Dernière visite de l'onglet Commissions de chaque partenaire. */
  p: Record<string, number>
  /** Dernière visite de l'aperçu (inscrits) de chaque partenaire. */
  q: Record<string, number>
}

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined)

function idMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!raw || typeof raw !== "object") return out
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) if (/^[0-9a-f-]{36}$/i.test(id) && num(v)) out[id] = num(v)!
  return out
}

const recent = (m: Record<string, number>) => Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, MAX_PARTNERS))

/** Relit le cookie sans lui faire confiance : un contenu illisible vaut « rien vu ». */
export function parseSeen(raw: string | undefined | null): Seen {
  const empty: Seen = { c: {}, p: {}, q: {} }
  if (!raw) return empty
  try {
    const o = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>
    if (!o || typeof o !== "object") return empty
    const c: Seen["c"] = {}
    const rc = (o.c ?? {}) as Record<string, unknown>
    for (const k of EVENT_KINDS) if (num(rc[k])) c[k] = num(rc[k])
    return { c, s: num(o.s), p: idMap(o.p), q: idMap(o.q) }
  } catch {
    return empty
  }
}

export function serializeSeen(seen: Seen): string {
  return encodeURIComponent(JSON.stringify({ c: seen.c, s: seen.s, p: recent(seen.p), q: recent(seen.q) }))
}

export interface MarkSeen {
  commissions?: EventKind[]
  signups?: boolean
  /** Onglet Commissions d'un partenaire. */
  partnerCommissions?: string
  /** Aperçu (inscrits) d'un partenaire. */
  partnerSignups?: string
}

export function markSeen(seen: Seen, what: MarkSeen, now: number): Seen {
  const next: Seen = { c: { ...seen.c }, s: seen.s, p: { ...seen.p }, q: { ...seen.q } }
  for (const k of what.commissions ?? []) next.c[k] = now
  if (what.signups) next.s = now
  if (what.partnerCommissions) next.p[what.partnerCommissions] = now
  if (what.partnerSignups) next.q[what.partnerSignups] = now
  return next
}

export interface EventLine {
  partner_id: string
  display: CommissionDisplay
  paid_at: string
  created_at?: string | null
  voided_at?: string | null
}

const ms = (iso: string | null | undefined): number => (iso ? new Date(iso).getTime() || 0 : 0)

/** Date de l'événement qui a mis la ligne dans son état actuel (null : versée, action de l'admin). */
export function eventAt(line: EventLine): number | null {
  if (line.display === "pending") return ms(line.created_at) || ms(line.paid_at)
  if (line.display === "due") return ms(line.paid_at) + COMMISSION_HOLD_DAYS * DAY
  if (line.display === "void") return ms(line.voided_at) || ms(line.created_at) || ms(line.paid_at)
  return null
}

export function isNewLine(line: EventLine, seen: Seen): boolean {
  const at = eventAt(line)
  if (at === null || line.display === "paid_out") return false
  const since = Math.max(seen.c[line.display] ?? 0, seen.p[line.partner_id] ?? 0)
  return at > since
}

export function isNewSignup(signup: { partner_id: string; signed_up_at: string }, seen: Seen): boolean {
  return ms(signup.signed_up_at) > Math.max(seen.s ?? 0, seen.q[signup.partner_id] ?? 0)
}

export function countNew(lines: EventLine[], seen: Seen): Record<EventKind, number> & { total: number } {
  const out = { due: 0, pending: 0, void: 0, total: 0 }
  for (const l of lines) {
    if (!isNewLine(l, seen)) continue
    out[l.display as EventKind]++
    out.total++
  }
  return out
}
