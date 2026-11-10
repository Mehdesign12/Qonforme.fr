/**
 * Actions de l'admin sur l'affiliation : partenaires, pages, contrôle des liens,
 * analyse du site (recommandations). Serveur seulement (clé service_role).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { DEFAULT_MONTHS, DEFAULT_RATE, LINK_CHECK_INTERVAL_DAYS, MAX_RATE, RECOMMENDATIONS_TTL_DAYS, isValidCode, normalizePageUrl, siteDomain, slugCode } from "@/lib/affiliation/model"
import { checkPartnerPage, nextPageStatus, type LinkCheckResult } from "@/lib/affiliation/link-check"
import { parseRankedKeywords, parseStoredRecommendations, recommendPages, type Recommendation } from "@/lib/affiliation/recommend"
import { failureOf, type PageRow, type PageStatus } from "@/lib/affiliation/data"
import { fetchOpenSeoRankedKeywords } from "@/lib/seo/keywords/openseo"
import { openSeoApiKey } from "@/lib/seo/keywords/dataforseo"
import { staticLinkCandidates } from "@/lib/seo/links/catalog"

type Db = SupabaseClient
const DAY = 24 * 3600 * 1000

/* ------------------------------------------------------------------ */
/* Saisie                                                              */
/* ------------------------------------------------------------------ */

const rate = z.coerce.number().min(0).max(MAX_RATE)
const months = z.coerce.number().int().min(1).max(60)

export const partnerInputSchema = z.object({
  name: z.string().trim().min(1, "Donnez un nom au partenaire.").max(120),
  site: z.string().trim().max(255).default(""),
  code: z.string().trim().toLowerCase().optional(),
  contact_email: z.string().trim().max(254).optional().nullable(),
  commission_rate: rate.default(DEFAULT_RATE),
  commission_months: months.default(DEFAULT_MONTHS),
  notes: z.string().max(4000).optional().nullable(),
  pages: z.array(z.string().max(2048)).max(50).default([]),
  /** Recommandations retenues (cochées à la création) : enregistrées comme pages « à proposer ». */
  proposed: z.array(z.object({ page: z.string().max(2048), targetPath: z.string().max(512) })).max(20).default([]),
  recommendations: z.array(z.unknown()).max(20).optional(),
})

export const partnerPatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  site: z.string().trim().max(255).optional(),
  contact_email: z.string().trim().max(254).nullable().optional(),
  commission_rate: rate.optional(),
  commission_months: months.optional(),
  notes: z.string().max(4000).nullable().optional(),
  status: z.enum(["active", "archived"]).optional(),
})

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function cleanEmail(v: string | null | undefined): string | null | "invalid" {
  const s = (v ?? "").trim()
  if (!s) return null
  return EMAIL.test(s) ? s.toLowerCase() : "invalid"
}

function cleanTarget(path: string): string | null {
  return path.startsWith("/") && !path.startsWith("//") ? path.split(/[?#]/)[0].slice(0, 512) : null
}

export type CreateResult = { ok: true; id: string } | { ok: false; status: number; error: string }

export async function createPartner(db: Db, raw: unknown): Promise<CreateResult> {
  const parsed = partnerInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? "Saisie invalide." }
  const input = parsed.data
  const code = slugCode(input.code || input.name)
  if (!isValidCode(code)) return { ok: false, status: 400, error: "Le code du lien doit faire 2 à 32 lettres ou chiffres." }
  const email = cleanEmail(input.contact_email)
  if (email === "invalid") return { ok: false, status: 400, error: "Adresse email du contact invalide." }
  const site = input.site ? siteDomain(input.site) : ""
  if (site === null) return { ok: false, status: 400, error: "Adresse du site invalide." }

  const recommendations = input.recommendations ? parseStoredRecommendations(input.recommendations) : []
  const { data, error } = await db
    .from("affiliate_partners")
    .insert({
      name: input.name,
      site,
      code,
      contact_email: email,
      commission_rate: input.commission_rate,
      commission_months: input.commission_months,
      notes: input.notes || null,
      recommendations: recommendations.length ? recommendations : null,
      recommendations_at: recommendations.length ? new Date().toISOString() : null,
    })
    .select("id")
    .single()
  if (error) {
    if (error.code === "23505") return { ok: false, status: 409, error: "Ce code est déjà pris par un autre partenaire." }
    const f = failureOf(error, "la création du partenaire")
    return { ok: false, status: f.kind === "unavailable" ? 503 : 500, error: f.message }
  }
  const id = data.id as string

  const rows = new Map<string, { url: string; status: PageStatus; target_path: string | null }>()
  for (const p of input.pages) {
    const url = normalizePageUrl(p)
    if (url) rows.set(url, { url, status: "unchecked", target_path: null })
  }
  for (const p of input.proposed) {
    const url = normalizePageUrl(p.page)
    if (url && !rows.has(url)) rows.set(url, { url, status: "proposed", target_path: cleanTarget(p.targetPath) })
  }
  if (rows.size) {
    const { error: pageError } = await db.from("affiliate_pages").insert(Array.from(rows.values()).map((r) => ({ ...r, partner_id: id })))
    if (pageError) console.error("[affiliation] pages du nouveau partenaire :", pageError.message)
  }
  return { ok: true, id }
}

export async function updatePartner(db: Db, id: string, raw: unknown): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const parsed = partnerPatchSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? "Saisie invalide." }
  const patch: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() }
  if (parsed.data.contact_email !== undefined) {
    const email = cleanEmail(parsed.data.contact_email)
    if (email === "invalid") return { ok: false, status: 400, error: "Adresse email du contact invalide." }
    patch.contact_email = email
  }
  if (parsed.data.site !== undefined) {
    const site = parsed.data.site ? siteDomain(parsed.data.site) : ""
    if (site === null) return { ok: false, status: 400, error: "Adresse du site invalide." }
    patch.site = site
  }
  // Une archive coupe aussi le lien privé de statistiques
  if (parsed.data.status === "archived") {
    patch.stats_token_hash = null
    patch.stats_token_created_at = null
  }
  const { data, error } = await db.from("affiliate_partners").update(patch).eq("id", id).select("id").maybeSingle()
  if (error) {
    const f = failureOf(error, "la mise à jour du partenaire")
    return { ok: false, status: f.kind === "unavailable" ? 503 : 500, error: f.message }
  }
  if (!data) return { ok: false, status: 404, error: "Partenaire introuvable." }
  return { ok: true }
}

/* ------------------------------------------------------------------ */
/* Pages et contrôle des liens                                         */
/* ------------------------------------------------------------------ */

async function applyCheck(db: Db, page: Pick<PageRow, "id" | "status" | "target_path">, result: LinkCheckResult): Promise<PageRow | null> {
  const now = new Date().toISOString()
  const status = nextPageStatus(page.status, result)
  const patch: Record<string, unknown> = {
    status,
    last_checked_at: now,
    check_error: result.ok ? null : result.error,
  }
  if (result.ok) {
    patch.rel = result.found ? result.rel : null
    patch.link_href = result.found ? result.href : null
    if (result.found) {
      patch.last_found_at = now
      patch.target_path = result.targetPath ?? page.target_path
    }
  }
  const { data, error } = await db.from("affiliate_pages").update(patch).eq("id", page.id).select("*").maybeSingle()
  if (error) {
    console.error("[affiliation] contrôle d'une page :", error.message)
    return null
  }
  return (data as PageRow | null) ?? null
}

export async function addPage(db: Db, partnerId: string, rawUrl: string, opts: { proposedTarget?: string | null } = {}): Promise<{ ok: true; page: PageRow } | { ok: false; status: number; error: string }> {
  const url = normalizePageUrl(rawUrl)
  if (!url) return { ok: false, status: 400, error: "Adresse de page invalide." }
  const proposed = opts.proposedTarget ? cleanTarget(opts.proposedTarget) : null
  const { data, error } = await db
    .from("affiliate_pages")
    .insert({ partner_id: partnerId, url, status: proposed ? "proposed" : "unchecked", target_path: proposed })
    .select("*")
    .single()
  if (error) {
    if (error.code === "23505") return { ok: false, status: 409, error: "Cette page est déjà enregistrée pour ce partenaire." }
    if (error.code === "23503") return { ok: false, status: 404, error: "Partenaire introuvable." }
    const f = failureOf(error, "l'ajout de la page")
    return { ok: false, status: f.kind === "unavailable" ? 503 : 500, error: f.message }
  }
  const page = data as PageRow
  if (proposed) return { ok: true, page }
  const checked = await applyCheck(db, page, await checkPartnerPage(page.url))
  return { ok: true, page: checked ?? page }
}

export async function checkPage(db: Db, partnerId: string, pageId: string): Promise<{ ok: true; page: PageRow } | { ok: false; status: number; error: string }> {
  const { data, error } = await db.from("affiliate_pages").select("*").eq("id", pageId).eq("partner_id", partnerId).maybeSingle()
  if (error) {
    const f = failureOf(error, "la page")
    return { ok: false, status: f.kind === "unavailable" ? 503 : 500, error: f.message }
  }
  if (!data) return { ok: false, status: 404, error: "Page introuvable." }
  const page = data as PageRow
  const checked = await applyCheck(db, page, await checkPartnerPage(page.url))
  if (!checked) return { ok: false, status: 500, error: "Le résultat du contrôle n'a pas pu être enregistré." }
  return { ok: true, page: checked }
}

export async function removePage(db: Db, partnerId: string, pageId: string): Promise<boolean> {
  const { error } = await db.from("affiliate_pages").delete().eq("id", pageId).eq("partner_id", partnerId)
  if (error) console.error("[affiliation] suppression d'une page :", error.message)
  return !error
}

/**
 * Contrôle hebdomadaire (tâche planifiée) : les pages jamais vérifiées ou
 * vérifiées il y a plus de 7 jours, quelques-unes par passage, dans le temps donné.
 */
export async function runWeeklyLinkChecks(db: Db, opts: { budgetMs: number; max?: number }): Promise<{ checked: number; missing: number } | { skipped: string }> {
  const started = Date.now()
  const before = new Date(Date.now() - LINK_CHECK_INTERVAL_DAYS * DAY).toISOString()
  const { data, error } = await db
    .from("affiliate_pages")
    .select("id, url, status, target_path, partner_id, affiliate_partners!inner(status)")
    .or(`last_checked_at.is.null,last_checked_at.lt.${before}`)
    .eq("affiliate_partners.status", "active")
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(opts.max ?? 6)
  if (error) return { skipped: failureOf(error, "les pages à vérifier").message }
  let checked = 0
  let missing = 0
  for (const row of (data ?? []) as Pick<PageRow, "id" | "url" | "status" | "target_path">[]) {
    if (Date.now() - started > opts.budgetMs) break
    const updated = await applyCheck(db, row, await checkPartnerPage(row.url))
    checked++
    if (updated?.status === "missing") missing++
  }
  return { checked, missing }
}

/* ------------------------------------------------------------------ */
/* Recommandations                                                     */
/* ------------------------------------------------------------------ */

/** Position moyenne de nos pages sur 28 jours (Search Console), chemin → position. Vide si la lecture échoue. */
export async function ourPagePositions(db: Db, now: Date = new Date()): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  const to = new Date(now.getTime() - 2 * DAY).toISOString().slice(0, 10)
  const from = new Date(now.getTime() - 30 * DAY).toISOString().slice(0, 10)
  const { data, error } = await db.rpc("seo_gsc_by_page", { p_from: from, p_to: to, p_device: null, p_country: null }).range(0, 999)
  if (error) {
    console.error("[affiliation] Search Console :", error.message)
    return out
  }
  for (const row of (data ?? []) as { page: string; impressions: number | string; avg_position: number | null }[]) {
    if (row.avg_position === null || Number(row.impressions) <= 0) continue
    let path = row.page
    try {
      path = new URL(row.page, "https://qonforme.fr").pathname
    } catch {
      continue
    }
    path = path.replace(/\/+$/, "") || "/"
    if (!out.has(path)) out.set(path, Number(row.avg_position))
  }
  return out
}

export type AnalyzeResult =
  | { ok: true; recommendations: Recommendation[]; analyzedAt: string; cached: boolean }
  | { ok: false; status: number; error: string }

/**
 * Analyse le site d'un partenaire avec OpenSEO (un appel payant) et rapproche
 * ses pages de nos pages. Avec `partnerId`, le résultat est enregistré et resservi
 * pendant 30 jours (sauf `force`).
 */
export async function analyzeSite(db: Db, input: { site: string; partnerId?: string | null; force?: boolean }, now: Date = new Date()): Promise<AnalyzeResult> {
  const domain = siteDomain(input.site)
  if (!domain) return { ok: false, status: 400, error: "Indiquez l'adresse du site du partenaire." }
  if (domain === "qonforme.fr") return { ok: false, status: 400, error: "C'est le site de Qonforme." }

  let exclude = new Set<string>()
  if (input.partnerId) {
    const { data, error } = await db.from("affiliate_partners").select("recommendations, recommendations_at, site").eq("id", input.partnerId).maybeSingle()
    if (error) {
      const f = failureOf(error, "le partenaire")
      return { ok: false, status: f.kind === "unavailable" ? 503 : 500, error: f.message }
    }
    if (!data) return { ok: false, status: 404, error: "Partenaire introuvable." }
    const fresh = data.recommendations_at && now.getTime() - new Date(data.recommendations_at as string).getTime() < RECOMMENDATIONS_TTL_DAYS * DAY
    if (!input.force && fresh && siteDomain(data.site as string) === domain) {
      return { ok: true, recommendations: parseStoredRecommendations(data.recommendations), analyzedAt: data.recommendations_at as string, cached: true }
    }
    const pages = await db.from("affiliate_pages").select("url").eq("partner_id", input.partnerId)
    exclude = new Set(((pages.data ?? []) as { url: string }[]).map((p) => p.url))
  }

  if (!openSeoApiKey()) return { ok: false, status: 503, error: "OpenSEO n'est pas configuré : ajoutez OPENSEO_API_KEY (Admin › SEO › Paramètres › Connexions)." }
  let payload: unknown
  try {
    payload = await fetchOpenSeoRankedKeywords(domain, { deadline: Date.now() + 55_000 })
  } catch (err) {
    return { ok: false, status: 502, error: err instanceof Error ? err.message : "OpenSEO n'a pas pu répondre." }
  }
  const rows = parseRankedKeywords(payload)
  const recommendations = recommendPages({
    rows,
    site: domain,
    candidates: staticLinkCandidates(),
    ourPositions: await ourPagePositions(db, now),
    exclude,
  })
  const analyzedAt = now.toISOString()
  if (input.partnerId) {
    const { error } = await db
      .from("affiliate_partners")
      .update({ recommendations, recommendations_at: analyzedAt, updated_at: analyzedAt })
      .eq("id", input.partnerId)
    if (error) console.error("[affiliation] enregistrement des recommandations :", error.message)
  }
  return { ok: true, recommendations, analyzedAt, cached: false }
}
