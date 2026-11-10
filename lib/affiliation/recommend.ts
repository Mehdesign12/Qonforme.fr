/**
 * Recommandations de pages pour un partenaire : sur quelles pages de son site
 * demander un lien, et vers quelle page de Qonforme. Uniquement sur des données :
 *
 * 1. OpenSEO (`get_ranked_keywords`) : les mots-clés sur lesquels chaque page du
 *    partenaire est classée dans Google France, sa position, son trafic estimé ;
 * 2. le catalogue des pages de Qonforme (lib/seo/links/catalog.ts) : on choisit
 *    la page dont le sujet recouvre le mieux ces mots-clés ;
 * 3. notre Search Console (28 jours) : une page de Qonforme classée entre la 4ᵉ
 *    et la 20ᵉ place est celle qu'un backlink aide le plus.
 *
 * Note sur 100 = trafic estimé de la page du partenaire (45 %), proximité des
 * sujets (35 %), marge de progression de notre page (20 %). Aucun modèle d'IA :
 * rien n'est inventé. Le trafic est une estimation d'OpenSEO, jamais une mesure.
 */
import { foldPlain, topicTokens } from "@/lib/seo/links/text"
import type { LinkCandidate } from "@/lib/seo/links/engine"
import { normalizePageUrl, siteDomain } from "@/lib/affiliation/model"

export interface RankedRow {
  url: string
  keyword: string
  rank: number | null
  volume: number | null
  traffic: number
}

export interface Recommendation {
  /** Page du partenaire, normalisée (« domaine/chemin »). */
  page: string
  keyword: string
  rank: number | null
  volume: number | null
  /** Trafic mensuel estimé de la page (somme sur ses mots-clés). */
  traffic: number
  keywords: number
  targetPath: string
  targetTitle: string
  anchor: string
  /** Position moyenne de notre page sur 28 jours, null sans donnée. */
  ourPosition: number | null
  score: number
  reason: string
}

type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null)
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Réponse de get_ranked_keywords → lignes (forme de DataForSEO Labs, ou forme plate). */
export function parseRankedKeywords(payload: unknown): RankedRow[] {
  const root = obj(payload)
  const list = (Array.isArray(root?.keywords) ? root!.keywords : Array.isArray(root?.rows) ? root!.rows : Array.isArray(payload) ? payload : []) as unknown[]
  const out: RankedRow[] = []
  for (const item of list) {
    const row = obj(item)
    if (!row) continue
    const kd = obj(row.keyword_data)
    const serp = obj(obj(row.ranked_serp_element)?.serp_item)
    const keyword = typeof kd?.keyword === "string" ? kd.keyword : typeof row.keyword === "string" ? row.keyword : null
    const url = typeof serp?.url === "string" ? serp.url : typeof row.url === "string" ? row.url : null
    if (!keyword || !url) continue
    out.push({
      url,
      keyword,
      rank: num(serp?.rank_group ?? serp?.rank_absolute ?? row.rank ?? row.position),
      volume: num(obj(kd?.keyword_info)?.search_volume ?? row.search_volume),
      traffic: Math.max(0, num(serp?.etv ?? row.traffic_estimate ?? row.traffic ?? row.etv) ?? 0),
    })
  }
  return out
}

interface PageGroup {
  page: string
  rows: RankedRow[]
  traffic: number
}

/** Regroupe par page du site du partenaire (les pages d'un autre domaine sont ignorées). */
export function groupByPage(rows: RankedRow[], domain: string): PageGroup[] {
  const map = new Map<string, PageGroup>()
  for (const r of rows) {
    const page = normalizePageUrl(r.url)
    if (!page) continue
    const host = page.split("/")[0]
    if (host !== domain && !host.endsWith(`.${domain}`)) continue
    const g = map.get(page) ?? { page, rows: [], traffic: 0 }
    g.rows.push(r)
    g.traffic += r.traffic
    map.set(page, g)
  }
  return Array.from(map.values())
}

/** Pages de Qonforme qu'on ne propose jamais comme cible d'un lien. */
const EXCLUDED_TARGETS = new Set(["/signup", "/demo", "/blog", "/plan-du-site", "/glossaire", "/outils", "/guide", "/facturation"])

/**
 * Proximité (0 à 1) entre les mots-clés d'une page et une page de Qonforme :
 * part du trafic de la page dont le mot-clé recouvre les mots du sujet, avec un
 * bonus quand une expression de la page de Qonforme figure telle quelle.
 */
export function topicMatch(group: PageGroup, candidate: LinkCandidate): number {
  const topics = new Set(candidate.topics)
  if (topics.size === 0) return 0
  const phrases = candidate.phrases.filter((p): p is string => typeof p === "string").map((p) => foldPlain(p))
  const total = group.rows.reduce((s, r) => s + Math.max(r.traffic, 0.01), 0)
  let score = 0
  for (const r of group.rows) {
    const tokens = Array.from(new Set(topicTokens(r.keyword)))
    if (tokens.length === 0) continue
    const overlap = tokens.filter((t) => topics.has(t)).length / tokens.length
    const folded = foldPlain(r.keyword)
    const phraseHit = phrases.some((p) => p.length >= 6 && (folded.includes(p) || p.includes(folded)))
    const s = Math.min(1, overlap + (phraseHit ? 0.35 : 0))
    score += s * (Math.max(r.traffic, 0.01) / total)
  }
  return Math.round(score * 1000) / 1000
}

/** Marge de progression de notre page (0 à 1) : la 4ᵉ à la 20ᵉ place profite le plus d'un lien. */
export function ourGain(position: number | null): number {
  if (position === null) return 0.5
  if (position <= 3) return 0.3
  if (position <= 20) return 1
  if (position <= 50) return 0.6
  return 0.4
}

export function ourReason(position: number | null): string {
  if (position === null) return "Pas encore de données Search Console pour notre page."
  const p = Math.round(position)
  if (position <= 3) return `Notre page est déjà ${p}ᵉ en moyenne (Search Console, 28 jours) : un lien la conforte.`
  if (position <= 20) return `Notre page est ${p}ᵉ en moyenne (Search Console, 28 jours) : un lien peut la faire monter.`
  return `Notre page est ${p}ᵉ en moyenne (Search Console, 28 jours) : encore loin de la première page.`
}

/** Trafic : 1 visite par mois → 0, 500 et plus → 1 (échelle logarithmique, absolue). */
function trafficScore(traffic: number): number {
  return Math.min(1, Math.log10(1 + Math.max(0, traffic)) / Math.log10(501))
}

const MIN_MATCH = 0.3

export function recommendPages(input: {
  rows: RankedRow[]
  site: string
  candidates: LinkCandidate[]
  /** Position moyenne de nos pages (chemin → position). */
  ourPositions: Map<string, number>
  /** Pages du partenaire déjà enregistrées (normalisées) : jamais recommandées à nouveau. */
  exclude?: Set<string>
  limit?: number
}): Recommendation[] {
  const domain = siteDomain(input.site)
  if (!domain) return []
  const candidates = input.candidates.filter((c) => !EXCLUDED_TARGETS.has(c.path) && c.kind !== "article")
  const out: Recommendation[] = []
  for (const g of groupByPage(input.rows, domain)) {
    if (input.exclude?.has(g.page)) continue
    let best: { c: LinkCandidate; match: number } | null = null
    for (const c of candidates) {
      const match = topicMatch(g, c)
      if (match > (best?.match ?? 0) || (best && match === best.match && c.weight > best.c.weight)) best = { c, match }
    }
    if (!best || best.match < MIN_MATCH) continue
    const top = g.rows.slice().sort((a, b) => b.traffic - a.traffic || (b.volume ?? 0) - (a.volume ?? 0))[0]
    const ourPosition = input.ourPositions.get(best.c.path) ?? null
    const score = Math.round(100 * (0.45 * trafficScore(g.traffic) + 0.35 * best.match + 0.2 * ourGain(ourPosition)))
    const anchor = (best.c.phrases.find((p): p is string => typeof p === "string") ?? best.c.title).toString()
    out.push({
      page: g.page,
      keyword: top.keyword,
      rank: top.rank,
      volume: top.volume,
      traffic: Math.round(g.traffic * 10) / 10,
      keywords: g.rows.length,
      targetPath: best.c.path,
      targetTitle: best.c.title,
      anchor,
      ourPosition: ourPosition === null ? null : Math.round(ourPosition * 10) / 10,
      score: Math.max(0, Math.min(100, score)),
      reason: ourReason(ourPosition),
    })
  }
  return out.sort((a, b) => b.score - a.score || b.traffic - a.traffic).slice(0, input.limit ?? 8)
}

/** Recommandations relues depuis la base sans leur faire confiance. */
export function parseStoredRecommendations(value: unknown): Recommendation[] {
  if (!Array.isArray(value)) return []
  const out: Recommendation[] = []
  for (const item of value.slice(0, 20)) {
    const r = obj(item)
    if (!r) continue
    const page = normalizePageUrl(typeof r.page === "string" ? r.page : "")
    const targetPath = typeof r.targetPath === "string" && r.targetPath.startsWith("/") && !r.targetPath.startsWith("//") ? r.targetPath.slice(0, 512) : null
    if (!page || !targetPath) continue
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "")
    out.push({
      page,
      keyword: str(r.keyword, 200),
      rank: num(r.rank),
      volume: num(r.volume),
      traffic: Math.max(0, num(r.traffic) ?? 0),
      keywords: Math.max(0, Math.round(num(r.keywords) ?? 0)),
      targetPath,
      targetTitle: str(r.targetTitle, 200) || targetPath,
      anchor: str(r.anchor, 200) || "Qonforme",
      ourPosition: num(r.ourPosition),
      score: Math.max(0, Math.min(100, Math.round(num(r.score) ?? 0))),
      reason: str(r.reason, 300),
    })
  }
  return out
}

/** Message prêt à envoyer au partenaire pour une recommandation. */
export function requestMessage(r: Recommendation, link: string): string {
  const where = r.rank ? ` (${r.rank}ᵉ sur Google pour « ${r.keyword} »)` : ` sur « ${r.keyword} »`
  return [
    "Bonjour,",
    "",
    `Votre page https://${r.page} est bien placée${where}. Un lien vers ${link} avec le texte « ${r.anchor} » y serait le plus utile à vos lecteurs.`,
    "",
    "Merci !",
  ].join("\n")
}
