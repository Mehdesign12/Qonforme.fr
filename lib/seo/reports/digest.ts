/**
 * Construction du résumé hebdomadaire SEO à partir des vraies données :
 * - Indicateurs : les 7 derniers jours disponibles de Search Console comparés
 *   aux 7 précédents (fonctions SQL seo_gsc_bounds et seo_gsc_totals) ; plage
 *   réduite aux jours enregistrés si la base couvre moins de 7 jours ;
 * - Pages à surveiller : les 3 constats ouverts les plus graves (seo_findings),
 *   lus gravité par gravité (jamais limités aux constats les plus récents) ;
 * - Articles publiés : blog_posts publiés pendant la semaine du résumé, les
 *   7 jours de Paris entiers qui précèdent le jour de l'envoi ;
 * - Visibilité IA : le dernier relevé terminé (seo_geo_runs), sans les domaines
 *   des concurrents (usage interne seulement, jamais dans un email).
 *
 * Seules les sections demandées sont lues. Une section sans données vaut null ;
 * une lecture en échec range la section dans `unavailable` sans empêcher les
 * autres (le résumé dit « Données indisponibles », il n'invente rien).
 *
 * Serveur seulement (clé service_role, lib/seo/db.ts).
 */
import { must, SeoDbError, type SeoDb } from "@/lib/seo/db"
import { getSettings } from "@/lib/seo/settings"
import { resolvePeriod } from "@/lib/seo/period"
import { ctrOf } from "@/lib/seo/format"
import { addDays, todayInParis } from "@/lib/utils/paris-date"
import { parisMinutes } from "@/lib/seo/reports/schedule"
import { GEO_ENGINES, type FindingSeverity, type GeoRunSummary } from "@/lib/seo/types"
import type {
  DigestArticle,
  DigestFinding,
  DigestFindings,
  DigestGeo,
  DigestKpis,
  DigestSectionKey,
  DigestSections,
  DigestTotals,
  SeoDigest,
} from "@/lib/seo/reports/types"

const SEVERITIES: FindingSeverity[] = ["high", "medium", "low"]
const TOP_FINDINGS = 3

type TotalsRow = { clicks: number | string | null; impressions: number | string | null; avg_position: number | string | null }
type BoundsRow = { first_date: string | null; last_date: string | null }

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function totalsOf(row: TotalsRow | undefined): DigestTotals {
  const clicks = num(row?.clicks)
  const impressions = num(row?.impressions)
  const position = row?.avg_position === null || row?.avg_position === undefined ? null : num(row.avg_position)
  return { clicks, impressions, ctr: ctrOf(clicks, impressions), position: impressions > 0 ? position : null }
}

function firstRow<T>(data: unknown): T | undefined {
  if (Array.isArray(data)) return data[0] as T | undefined
  return (data ?? undefined) as T | undefined
}

/** Indicateurs des 7 derniers jours enregistrés ; null sans aucune donnée. */
export async function readDigestKpis(db: SeoDb, now: Date): Promise<DigestKpis | null> {
  const bounds = firstRow<BoundsRow>(must(await db.rpc("seo_gsc_bounds"), "les bornes de Search Console"))
  const last = bounds?.last_date ?? null
  if (!last) return null
  const period = resolvePeriod("7j", last, now)
  const totals = async (from: string, to: string) =>
    totalsOf(
      firstRow<TotalsRow>(
        must(await db.rpc("seo_gsc_totals", { p_from: from, p_to: to, p_device: null, p_country: null }), "les totaux de Search Console"),
      ),
    )
  // Base plus courte que 7 jours : la plage annoncée se limite aux jours enregistrés
  const first = bounds?.first_date ?? null
  const partial = Boolean(first && first > period.current.from && first <= period.current.to)
  const range = partial ? { from: first as string, to: period.current.to } : period.current
  const current = await totals(range.from, range.to)
  // Comparaison seulement si la base couvre toute la période précédente
  const comparable = Boolean(first && first <= period.previous.from)
  const previous = comparable ? await totals(period.previous.from, period.previous.to) : null
  return { range, partial, current, previous }
}

type FindingRow = {
  id: string
  title: string
  path: string
  severity: FindingSeverity
  explanation: string | null
  detected_at: string
}

/**
 * Les 3 constats ouverts les plus graves (puis les plus récents) : lus
 * gravité par gravité, pour qu'un constat grave ancien passe toujours avant
 * des constats moyens récents, quel que soit le nombre de constats ouverts.
 * Le total des constats ouverts est compté à part.
 */
export async function readDigestFindings(db: SeoDb): Promise<DigestFindings> {
  const counted = await db.from("seo_findings").select("id", { count: "exact", head: true }).eq("status", "open")
  must(counted, "les constats SEO")
  const top: DigestFinding[] = []
  for (let i = 0; i < SEVERITIES.length && top.length < TOP_FINDINGS; i++) {
    const severity = SEVERITIES[i]
    const rows = (must(
      await db
        .from("seo_findings")
        .select("id, title, path, severity, explanation, detected_at")
        .eq("status", "open")
        .eq("severity", severity)
        .order("detected_at", { ascending: false })
        .limit(TOP_FINDINGS - top.length),
      "les constats SEO",
    ) ?? []) as FindingRow[]
    rows.forEach((r) => top.push({ id: r.id, title: r.title, path: r.path, severity, explanation: r.explanation ?? null }))
  }
  const count = (counted as { count?: number | null }).count
  return { top, openCount: typeof count === "number" ? Math.max(count, top.length) : top.length }
}

/**
 * Début d'un jour de Paris (minuit, heure d'été comprise) en instant UTC.
 * Minuit existe toujours à Paris : les changements d'heure ont lieu à 2 h et 3 h.
 */
export function parisDayStart(day: string): Date {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number)
  const utcMidnight = Date.UTC(y, m - 1, d)
  const summer = new Date(utcMidnight - 2 * 3_600_000)
  if (todayInParis(summer) === day && parisMinutes(summer) === 0) return summer
  return new Date(utcMidnight - 3_600_000)
}

/**
 * Semaine du résumé : les 7 jours de Paris entiers qui précèdent le jour de
 * `now` (un résumé du lundi 12 oct. couvre du lundi 5 au dimanche 11 oct.).
 * Deux résumés successifs se suivent sans trou ni chevauchement.
 */
export function digestWeek(now: Date): { from: string; to: string } {
  const today = todayInParis(now)
  return { from: addDays(today, -7), to: addDays(today, -1) }
}

/** Articles publiés à partir de `since` et avant `until` (le plus récent d'abord). */
export async function readDigestArticles(db: SeoDb, since: Date, until: Date): Promise<DigestArticle[]> {
  const rows = (must(
    await db
      .from("blog_posts")
      .select("title, slug, published_at")
      .eq("is_published", true)
      .gte("published_at", since.toISOString())
      .lt("published_at", until.toISOString())
      .order("published_at", { ascending: false })
      .limit(20),
    "les articles publiés",
  ) ?? []) as { title: string; slug: string; published_at: string }[]
  return rows.map((r) => ({ title: r.title, slug: r.slug, publishedAt: r.published_at }))
}

/** Dernier relevé terminé de la visibilité IA ; null s'il n'y en a aucun. */
export async function readDigestGeo(db: SeoDb): Promise<DigestGeo | null> {
  const row = must(
    await db
      .from("seo_geo_runs")
      .select("kind, created_at, finished_at, summary")
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "le dernier relevé de visibilité IA",
  ) as { kind: string; created_at: string; finished_at: string | null; summary: GeoRunSummary | null } | null
  if (!row) return null
  const summary = row.summary
  const rate = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)
  const engines = GEO_ENGINES.filter((e) => summary?.engines?.[e.key]).map((e) => ({
    key: e.key,
    label: e.label,
    mentionRate: rate(summary?.engines?.[e.key]?.mention_rate),
    citationRate: rate(summary?.engines?.[e.key]?.citation_rate),
  }))
  return {
    at: row.finished_at ?? row.created_at,
    imported: row.kind === "import",
    mentionRate: rate(summary?.overall?.mention_rate),
    citationRate: rate(summary?.overall?.citation_rate),
    engines,
  }
}

async function section<T>(key: DigestSectionKey, unavailable: DigestSectionKey[], read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await read()
  } catch (error) {
    unavailable.push(key)
    if (!(error instanceof SeoDbError)) console.error(`[seo-digest] section « ${key} » illisible`, error instanceof Error ? error.message : error)
    return undefined
  }
}

/**
 * Résumé de la semaine à l'instant `now`. Sans `sections`, celles des
 * réglages (Paramètres › Rapports) ; l'aperçu de la page les lit toutes.
 */
export async function buildDigest(db: SeoDb, now: Date, sections?: DigestSections): Promise<SeoDigest> {
  const wanted = sections ?? (await getSettings(db, "reports")).value.sections
  const unavailable: DigestSectionKey[] = []
  const week = digestWeek(now)
  // Articles : de minuit (Paris) du premier jour à minuit (Paris) du jour de l'envoi
  const since = parisDayStart(week.from)
  const until = parisDayStart(addDays(week.to, 1))

  const [kpis, findings, articles, geo] = await Promise.all([
    wanted.kpis ? section("kpis", unavailable, () => readDigestKpis(db, now)) : Promise.resolve(undefined),
    wanted.pages ? section("pages", unavailable, () => readDigestFindings(db)) : Promise.resolve(undefined),
    wanted.articles ? section("articles", unavailable, () => readDigestArticles(db, since, until)) : Promise.resolve(undefined),
    wanted.geo ? section("geo", unavailable, () => readDigestGeo(db)) : Promise.resolve(undefined),
  ])

  const digest: SeoDigest = {
    generatedAt: now.toISOString(),
    week,
    sections: { ...wanted },
    unavailable: unavailable.sort(),
  }
  if (wanted.kpis && kpis !== undefined) digest.kpis = kpis
  if (wanted.pages && findings !== undefined) digest.findings = findings
  if (wanted.articles && articles !== undefined) digest.articles = articles
  if (wanted.geo && geo !== undefined) digest.geo = geo
  return digest
}
