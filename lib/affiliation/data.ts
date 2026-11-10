/**
 * Lectures et écritures de l'affiliation pour l'admin et la page du partenaire
 * (clé service_role seulement). Toute erreur de lecture est rendue comme telle,
 * jamais comme « zéro » (règle « distinguer erreur et pas de données »).
 */
import { createHash, randomBytes } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import {
  commissionTotals,
  displayState,
  type CommissionDisplay,
  type CommissionRow,
  type CommissionState,
  type CommissionTotals,
  weeklyCounts,
} from "@/lib/affiliation/model"
import { parseStoredRecommendations, type Recommendation } from "@/lib/affiliation/recommend"

type Db = SupabaseClient
const DAY = 24 * 3600 * 1000

export type Failure = { ok: false; kind: "unavailable" | "error"; message: string }
export type Result<T> = { ok: true; data: T } | Failure

export function failureOf(error: { code?: string | null; message?: string | null } | null | undefined, what: string): Failure {
  if (isMissingSchemaError(error)) {
    return { ok: false, kind: "unavailable", message: "L'affiliation n'est pas encore activée : appliquez la migration 20261110_affiliation.sql." }
  }
  console.error(`[affiliation] ${what} :`, error?.message)
  return { ok: false, kind: "error", message: `Lecture impossible : ${what}. Réessayez dans un instant.` }
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type PageStatus = "proposed" | "unchecked" | "found" | "missing" | "error"

export interface PartnerRow {
  id: string
  name: string
  site: string
  code: string
  contact_email: string | null
  commission_rate: number
  commission_months: number
  status: "active" | "archived"
  notes: string | null
  stats_token_created_at: string | null
  stats_views: number
  stats_last_viewed_at: string | null
  recommendations: Recommendation[]
  recommendations_at: string | null
  created_at: string
}

export interface PageRow {
  id: string
  partner_id: string
  url: string
  target_path: string | null
  status: PageStatus
  rel: "follow" | "nofollow" | "sponsored" | "ugc" | null
  link_href: string | null
  check_error: string | null
  last_checked_at: string | null
  last_found_at: string | null
  created_at: string
}

export interface CommissionLine extends CommissionRow {
  id: string
  partner_id: string
  plan: string | null
  billing_period: string | null
  rate: number
  payout_at: string | null
  display: CommissionDisplay
}

export interface PartnerStats {
  visits30: number
  visitsAll: number
  signups30: number
  signupsAll: number
  /** Comptes qui ont payé au moins une fois (production, non remboursés). */
  paidAll: number
  /** Dont ceux dont le premier paiement date de moins de 30 jours. */
  paid30: number
  commissions: CommissionTotals
}

export interface LinkSummary {
  label: string
  tone: "ok" | "warn" | "danger" | "neutral" | "info"
  missing: number
  notFollowed: number
}

const PARTNER_COLUMNS =
  "id, name, site, code, contact_email, commission_rate, commission_months, status, notes, stats_token_created_at, stats_views, stats_last_viewed_at, recommendations, recommendations_at, created_at"
const PAGE_COLUMNS = "id, partner_id, url, target_path, status, rel, link_href, check_error, last_checked_at, last_found_at, created_at"
const COMMISSION_COLUMNS = "id, partner_id, user_id, plan, billing_period, amount_paid_cents, rate, commission_cents, paid_at, state, payout_at, livemode"

function toPartner(row: Record<string, unknown>): PartnerRow {
  return {
    id: row.id as string,
    name: row.name as string,
    site: (row.site as string) ?? "",
    code: row.code as string,
    contact_email: (row.contact_email as string | null) ?? null,
    commission_rate: Number(row.commission_rate),
    commission_months: Number(row.commission_months),
    status: row.status === "archived" ? "archived" : "active",
    notes: (row.notes as string | null) ?? null,
    stats_token_created_at: (row.stats_token_created_at as string | null) ?? null,
    stats_views: Number(row.stats_views ?? 0),
    stats_last_viewed_at: (row.stats_last_viewed_at as string | null) ?? null,
    recommendations: parseStoredRecommendations(row.recommendations),
    recommendations_at: (row.recommendations_at as string | null) ?? null,
    created_at: row.created_at as string,
  }
}

function toLine(row: Record<string, unknown>, now: Date): CommissionLine {
  const state = (["earned", "paid_out", "void"].includes(row.state as string) ? row.state : "earned") as CommissionState
  return {
    id: row.id as string,
    partner_id: row.partner_id as string,
    plan: (row.plan as string | null) ?? null,
    billing_period: (row.billing_period as string | null) ?? null,
    amount_paid_cents: Number(row.amount_paid_cents),
    rate: Number(row.rate),
    commission_cents: Number(row.commission_cents),
    paid_at: row.paid_at as string,
    state,
    payout_at: (row.payout_at as string | null) ?? null,
    livemode: row.livemode !== false,
    display: displayState(state, row.paid_at as string, now),
  }
}

export function linkSummary(pages: Pick<PageRow, "status" | "rel">[]): LinkSummary {
  const missing = pages.filter((p) => p.status === "missing").length
  const notFollowed = pages.filter((p) => p.status === "found" && p.rel && p.rel !== "follow").length
  const found = pages.filter((p) => p.status === "found").length
  if (missing) return { label: `${missing} lien${missing > 1 ? "s" : ""} introuvable${missing > 1 ? "s" : ""}`, tone: "danger", missing, notFollowed }
  if (notFollowed) return { label: `${notFollowed} lien${notFollowed > 1 ? "s" : ""} non suivi${notFollowed > 1 ? "s" : ""}`, tone: "warn", missing, notFollowed }
  if (found) return { label: "Liens en place", tone: "ok", missing, notFollowed }
  if (pages.some((p) => p.status === "proposed")) return { label: "À proposer", tone: "info", missing, notFollowed }
  if (pages.length) return { label: "À vérifier", tone: "neutral", missing, notFollowed }
  return { label: "Aucune page", tone: "neutral", missing, notFollowed }
}

/** Comptes payants à partir des lignes de commission (production, non remboursées). */
export function payingAccounts(lines: { livemode: boolean; display: CommissionDisplay; paid_at: string; user_id?: string | null }[], now: Date): { all: number; last30: number } {
  const first = new Map<string, number>()
  for (const l of lines) {
    if (!l.livemode || l.display === "void" || !l.user_id) continue
    const t = new Date(l.paid_at).getTime()
    const prev = first.get(l.user_id)
    if (prev === undefined || t < prev) first.set(l.user_id, t)
  }
  let last30 = 0
  first.forEach((t) => {
    if (now.getTime() - t <= 30 * DAY) last30++
  })
  return { all: first.size, last30 }
}

/* ------------------------------------------------------------------ */
/* Lectures                                                            */
/* ------------------------------------------------------------------ */

async function countRows(db: Db, table: string, partnerId: string, since?: Date): Promise<{ count: number } | { error: { code?: string; message?: string } }> {
  let q = db.from(table).select("partner_id", { count: "exact", head: true }).eq("partner_id", partnerId)
  if (since) q = q.gte(table === "affiliate_referrals" ? "signed_up_at" : "created_at", since.toISOString())
  const { count, error } = await q
  if (error) return { error }
  return { count: count ?? 0 }
}

async function partnerStats(db: Db, partnerId: string, lines: (CommissionLine & { user_id?: string | null })[], now: Date): Promise<Result<PartnerStats>> {
  const since = new Date(now.getTime() - 30 * DAY)
  const [v30, vAll, s30, sAll] = await Promise.all([
    countRows(db, "affiliate_visits", partnerId, since),
    countRows(db, "affiliate_visits", partnerId),
    countRows(db, "affiliate_referrals", partnerId, since),
    countRows(db, "affiliate_referrals", partnerId),
  ])
  for (const r of [v30, vAll, s30, sAll]) if ("error" in r) return failureOf(r.error, "les statistiques du partenaire")
  const paying = payingAccounts(lines, now)
  return {
    ok: true,
    data: {
      visits30: (v30 as { count: number }).count,
      visitsAll: (vAll as { count: number }).count,
      signups30: (s30 as { count: number }).count,
      signupsAll: (sAll as { count: number }).count,
      paidAll: paying.all,
      paid30: paying.last30,
      commissions: commissionTotals(lines, now),
    },
  }
}

export interface PartnerListItem {
  partner: PartnerRow
  stats: PartnerStats
  links: LinkSummary
}

export async function listPartners(db: Db, now: Date = new Date()): Promise<Result<PartnerListItem[]>> {
  const { data, error } = await db.from("affiliate_partners").select(PARTNER_COLUMNS).order("created_at", { ascending: true })
  if (error) return failureOf(error, "les partenaires")
  const partners = (data ?? []).map((r) => toPartner(r as Record<string, unknown>))
  if (partners.length === 0) return { ok: true, data: [] }
  const ids = partners.map((p) => p.id)
  const [pagesRes, linesRes] = await Promise.all([
    db.from("affiliate_pages").select("partner_id, status, rel").in("partner_id", ids),
    db.from("affiliate_commissions").select(COMMISSION_COLUMNS).in("partner_id", ids).limit(10_000),
  ])
  if (pagesRes.error) return failureOf(pagesRes.error, "les pages des partenaires")
  if (linesRes.error) return failureOf(linesRes.error, "les commissions")
  const lines = (linesRes.data ?? []).map((r) => ({ ...toLine(r as Record<string, unknown>, now), user_id: (r as { user_id?: string | null }).user_id ?? null }))
  const out: PartnerListItem[] = []
  for (const partner of partners) {
    const own = lines.filter((l) => l.partner_id === partner.id)
    const stats = await partnerStats(db, partner.id, own, now)
    if (!stats.ok) return stats
    const pages = (pagesRes.data ?? []).filter((p) => p.partner_id === partner.id) as Pick<PageRow, "status" | "rel">[]
    out.push({ partner, stats: stats.data, links: linkSummary(pages) })
  }
  return { ok: true, data: out }
}

export interface PartnerDetail {
  partner: PartnerRow
  stats: PartnerStats
  pages: PageRow[]
  links: LinkSummary
  weeks: { start: string; count: number }[]
  visitsByPath: { path: string; count: number }[]
  lines: CommissionLine[]
}

export async function partnerDetail(db: Db, id: string, now: Date = new Date()): Promise<Result<PartnerDetail | null>> {
  const { data, error } = await db.from("affiliate_partners").select(PARTNER_COLUMNS).eq("id", id).maybeSingle()
  if (error) return failureOf(error, "le partenaire")
  if (!data) return { ok: true, data: null }
  const partner = toPartner(data as Record<string, unknown>)
  const since = new Date(now.getTime() - 8 * 7 * DAY)
  const [pagesRes, linesRes, visitsRes] = await Promise.all([
    db.from("affiliate_pages").select(PAGE_COLUMNS).eq("partner_id", id).order("created_at", { ascending: true }),
    db.from("affiliate_commissions").select(COMMISSION_COLUMNS).eq("partner_id", id).order("paid_at", { ascending: false }).limit(2000),
    db.from("affiliate_visits").select("path, created_at").eq("partner_id", id).gte("created_at", since.toISOString()).limit(50_000),
  ])
  if (pagesRes.error) return failureOf(pagesRes.error, "les pages du partenaire")
  if (linesRes.error) return failureOf(linesRes.error, "les commissions")
  if (visitsRes.error) return failureOf(visitsRes.error, "les visites")
  const lines = (linesRes.data ?? []).map((r) => ({ ...toLine(r as Record<string, unknown>, now), user_id: (r as { user_id?: string | null }).user_id ?? null }))
  const stats = await partnerStats(db, id, lines, now)
  if (!stats.ok) return stats
  const visits = (visitsRes.data ?? []) as { path: string; created_at: string }[]
  const cutoff30 = now.getTime() - 30 * DAY
  const byPath = new Map<string, number>()
  visits.forEach((v) => {
    if (new Date(v.created_at).getTime() >= cutoff30) byPath.set(v.path, (byPath.get(v.path) ?? 0) + 1)
  })
  const pages = (pagesRes.data ?? []) as PageRow[]
  return {
    ok: true,
    data: {
      partner,
      stats: stats.data,
      pages,
      links: linkSummary(pages),
      weeks: weeklyCounts(visits.map((v) => v.created_at), now, 8).map((w) => ({ start: w.start.toISOString(), count: w.count })),
      visitsByPath: Array.from(byPath.entries()).map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count),
      // Le user_id ne sort jamais de cette lecture : la page du partenaire n'affiche aucun compte
      lines: lines.map((l) => {
        const rest: CommissionLine & { user_id?: string | null } = { ...l }
        delete rest.user_id
        return rest
      }),
    },
  }
}

export interface CommissionListLine extends CommissionLine {
  partnerName: string
}

export async function listCommissions(db: Db, now: Date = new Date()): Promise<Result<{ lines: CommissionListLine[]; partners: { id: string; name: string; code: string }[] }>> {
  const [pRes, lRes] = await Promise.all([
    db.from("affiliate_partners").select("id, name, code"),
    db.from("affiliate_commissions").select(COMMISSION_COLUMNS).order("paid_at", { ascending: false }).limit(5000),
  ])
  if (pRes.error) return failureOf(pRes.error, "les partenaires")
  if (lRes.error) return failureOf(lRes.error, "les commissions")
  const names = new Map((pRes.data ?? []).map((p) => [p.id as string, p.name as string]))
  return {
    ok: true,
    data: {
      partners: (pRes.data ?? []) as { id: string; name: string; code: string }[],
      lines: (lRes.data ?? []).map((r) => ({ ...toLine(r as Record<string, unknown>, now), partnerName: names.get((r as { partner_id: string }).partner_id) ?? "Partenaire supprimé" })),
    },
  }
}

/* ------------------------------------------------------------------ */
/* Lien privé de statistiques                                          */
/* ------------------------------------------------------------------ */

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function newStatsToken(): string {
  return randomBytes(24).toString("base64url")
}

export function isTokenShape(token: string): boolean {
  return /^[A-Za-z0-9_-]{32}$/.test(token)
}

export function statsUrl(token: string): string {
  return `https://qonforme.fr/partenaire/${token}`
}

/** Crée (ou remplace) le lien privé : l'ancien ne marche plus. Rend le jeton en clair, une seule fois. */
export async function rotateStatsToken(db: Db, partnerId: string): Promise<Result<string>> {
  const token = newStatsToken()
  const { data, error } = await db
    .from("affiliate_partners")
    .update({ stats_token_hash: hashToken(token), stats_token_created_at: new Date().toISOString(), stats_views: 0, stats_last_viewed_at: null, updated_at: new Date().toISOString() })
    .eq("id", partnerId)
    .select("id")
    .maybeSingle()
  if (error) return failureOf(error, "le lien de statistiques")
  if (!data) return { ok: false, kind: "error", message: "Partenaire introuvable." }
  return { ok: true, data: token }
}

export async function revokeStatsToken(db: Db, partnerId: string): Promise<Result<true>> {
  const { error } = await db
    .from("affiliate_partners")
    .update({ stats_token_hash: null, stats_token_created_at: null, updated_at: new Date().toISOString() })
    .eq("id", partnerId)
  if (error) return failureOf(error, "le lien de statistiques")
  return { ok: true, data: true }
}

/** Partenaire d'un lien privé (null si le jeton ne correspond à rien) ; compte l'ouverture. */
export async function partnerByToken(db: Db, token: string): Promise<Result<PartnerRow | null>> {
  if (!isTokenShape(token)) return { ok: true, data: null }
  const { data, error } = await db.from("affiliate_partners").select(`${PARTNER_COLUMNS}`).eq("stats_token_hash", hashToken(token)).maybeSingle()
  if (error) return failureOf(error, "le lien")
  if (!data || data.status === "archived") return { ok: true, data: null }
  await db
    .from("affiliate_partners")
    .update({ stats_views: Number(data.stats_views ?? 0) + 1, stats_last_viewed_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(({ error: e }) => e && console.error("[affiliation] compteur du lien :", e.message))
  return { ok: true, data: toPartner(data as Record<string, unknown>) }
}

/* ------------------------------------------------------------------ */
/* Versement                                                           */
/* ------------------------------------------------------------------ */

/** Marque comme versées les commissions dues (garantie passée) d'un partenaire, en production. Rend le total versé. */
export async function markPaidOut(db: Db, partnerId: string, now: Date = new Date()): Promise<Result<{ count: number; cents: number }>> {
  const dueBefore = new Date(now.getTime() - 30 * DAY).toISOString()
  const { data, error } = await db
    .from("affiliate_commissions")
    .update({ state: "paid_out", payout_at: now.toISOString() })
    .eq("partner_id", partnerId)
    .eq("state", "earned")
    .eq("livemode", true)
    .lte("paid_at", dueBefore)
    .select("commission_cents")
  if (error) return failureOf(error, "le versement")
  const rows = (data ?? []) as { commission_cents: number }[]
  return { ok: true, data: { count: rows.length, cents: rows.reduce((s, r) => s + Number(r.commission_cents), 0) } }
}
