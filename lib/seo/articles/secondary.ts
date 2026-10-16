/**
 * Mots-clés de l'éditeur d'articles (admin › Blog) : liste proposée pour le
 * mot-clé principal (onglet Mots-clés et plan du 16/10/2026 fusionnés) et
 * mots-clés secondaires à glisser dans le texte.
 *
 * Mots-clés secondaires : les mots-clés suivis qui partagent au moins un mot
 * significatif avec le principal (accents, casse et pluriel ignorés, même
 * famille de mots : « maçon », « macons » et « maçonnerie » se rejoignent),
 * et les requêtes de Search Console qui
 * affichent déjà l'article (3 impressions au moins). Triés par volume, puis
 * par impressions.
 *
 * « Significatif » : ni mot vide, ni mot courant du site (« devis »,
 * « facture », « logiciel », « exemple »…), que presque chaque mot-clé
 * contient. Sans cette règle, un article sur le placo se verrait proposer
 * « exemple devis paysagiste » ou « logiciel devis facture bâtiment » (880
 * recherches) au seul motif du mot « devis » : un mauvais conseil. Pour un
 * principal fait de mots courants seulement (« logiciel devis artisan »), un
 * mot-clé doit en partager au moins deux.
 *
 * Module pur : serveur, navigateur et tests.
 */
import { normalizeForMatch } from "@/lib/seo/articles/onpage"
import { canonicalKeyword, foldAccents } from "@/lib/seo/keywords/normalize"
import { PLAN_KEYWORDS, type PlanKeyword } from "@/lib/seo/keywords/plan"
import type { KeywordRow } from "@/lib/seo/keywords/types"
import type { EditorKeyword, PageQuery } from "@/lib/seo/articles/editor-types"

/* ------------------------------------------------------------------ */
/* Conversions                                                         */
/* ------------------------------------------------------------------ */

/** Clé de comparaison d'un mot-clé : forme canonique, sans accents ni casse. */
export function keywordKey(keyword: string): string {
  return foldAccents(canonicalKeyword(keyword))
}

/** Ligne de seo_keywords → mot-clé de l'éditeur. */
export function editorKeywordOf(row: KeywordRow): EditorKeyword {
  return {
    id: row.id,
    keyword: row.keyword,
    status: row.status,
    intent: row.intent,
    volume: row.volume,
    difficulty: row.difficulty,
    position: row.position,
    clicks: row.clicks,
    impressions: row.impressions,
    targetPath: row.target_path,
    fromPlan: false,
  }
}

/** Mot-clé du plan pas encore suivi (aucune mesure de Search Console ni de DataForSEO). */
export function planEditorKeyword(plan: PlanKeyword): EditorKeyword {
  return {
    id: null,
    keyword: canonicalKeyword(plan.keyword),
    status: null,
    intent: plan.intent,
    volume: plan.volume,
    difficulty: null,
    position: null,
    clicks: null,
    impressions: null,
    targetPath: plan.targetPath,
    fromPlan: true,
  }
}

/**
 * Ajoute les mots-clés du plan absents de la liste et marque ceux qui y sont
 * (`fromPlan`), en complétant leur volume et leur page s'ils manquent. Les
 * mesures de l'onglet Mots-clés priment toujours sur celles du plan.
 * Comparaison sans accents : « logiciel devis facture batiment », arrivé de
 * Search Console, est le même mot-clé que celui du plan.
 */
export function mergePlanKeywords(rows: EditorKeyword[], plan: PlanKeyword[] = PLAN_KEYWORDS): EditorKeyword[] {
  const out = rows.map((r) => ({ ...r }))
  const byKey = new Map<string, EditorKeyword>()
  out.forEach((r) => {
    const k = keywordKey(r.keyword)
    if (!byKey.has(k)) byKey.set(k, r)
  })
  plan.forEach((p) => {
    const k = keywordKey(p.keyword)
    const existing = byKey.get(k)
    if (existing) {
      existing.fromPlan = true
      if (existing.volume === null) existing.volume = p.volume
      if (existing.targetPath === null) existing.targetPath = p.targetPath
      return
    }
    const added = planEditorKeyword(p)
    byKey.set(k, added)
    out.push(added)
  })
  return out
}

/* ------------------------------------------------------------------ */
/* Mots-clés secondaires                                               */
/* ------------------------------------------------------------------ */

export interface SecondaryCandidate {
  keyword: string
  /** Recherches mensuelles connues (onglet Mots-clés ou plan). */
  volume: number | null
  /** Impressions de l'article sur cette requête (Search Console, 90 jours), sinon celles du mot-clé sur le site (28 jours). */
  impressions: number | null
  fromPlan: boolean
  /** La requête affiche déjà l'article dans Google. */
  fromPage: boolean
}

export const SECONDARY_LIMIT = 10
/** Une requête de Search Console est retenue à partir de 3 impressions de l'article. */
export const PAGE_QUERY_MIN_IMPRESSIONS = 3

const STOPWORDS = new Set(
  "a au aux avec ce ces cette d de des du en et l la le les ou par pour sans sur un une vos votre nos notre son sa ses mon ma mes est sont qui que quoi comment quel quelle quels quelles dans faire".split(" "),
)

/** Mots courants du site : presque chaque mot-clé les contient (forme sans accents, au singulier). */
const GENERIC = new Set("devis facture facturation logiciel exemple modele gratuit pdf artisan batiment travau entreprise gestion application outil".split(" "))

/** Singulier approché (même règle que le contrôle sur la page). */
function stem(word: string): string {
  if (word.length > 3 && /[sx]$/.test(word) && !/(ss|is|us)$/.test(word)) return word.slice(0, -1)
  return word
}

/** Même famille de mots : identiques, ou cinq premières lettres communes au moins (« maçon » et « maçonnerie », « plombier » et « plomberie »). */
export function sameFamily(a: string, b: string): boolean {
  if (a === b) return true
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i >= 5
}

/** Mots significatifs d'un texte : sans accents, singulier approché, sans mots vides ni mots d'une lettre. */
export function significantWords(text: string): string[] {
  const norm = normalizeForMatch(text)
  if (!norm) return []
  return Array.from(new Set(norm.split(" ").map(stem).filter((w) => w.length >= 2 && !STOPWORDS.has(w))))
}

/**
 * Mots-clés secondaires d'un article (10 au plus) : sans le principal,
 * dédoublonnés (accents et casse ignorés), triés par volume puis impressions.
 */
export function secondaryCandidates(keyword: string | null, keywords: EditorKeyword[], pageQueries: PageQuery[]): SecondaryCandidate[] {
  const main = (keyword ?? "").trim()
  if (!main) return []
  const mainKey = keywordKey(main)
  const mainWords = significantWords(main)
  const mainSet = new Set(mainWords)
  const distinctive = new Set(mainWords.filter((w) => !GENERIC.has(w)))
  /** Un mot distinctif en commun ; pour un principal fait de mots courants seulement, deux mots en commun. */
  const related = (words: string[]) => {
    if (distinctive.size > 0) return words.some((w) => Array.from(distinctive).some((m) => sameFamily(w, m)))
    return words.filter((w) => mainSet.has(w)).length >= 2
  }

  const byKey = new Map<string, SecondaryCandidate>()

  keywords.forEach((k) => {
    const key = keywordKey(k.keyword)
    if (!key || key === mainKey || !related(significantWords(k.keyword))) return
    const current = byKey.get(key)
    if (current) {
      current.fromPlan = current.fromPlan || k.fromPlan
      if (current.volume === null) current.volume = k.volume
      return
    }
    byKey.set(key, { keyword: canonicalKeyword(k.keyword), volume: k.volume, impressions: k.impressions, fromPlan: k.fromPlan, fromPage: false })
  })

  // Requêtes qui affichent déjà l'article : retenues telles quelles (Google les rapproche déjà de lui)
  pageQueries.forEach((q) => {
    if (q.impressions < PAGE_QUERY_MIN_IMPRESSIONS) return
    const key = keywordKey(q.query)
    if (!key || key === mainKey) return
    const current = byKey.get(key)
    if (current) {
      current.fromPage = true
      current.impressions = q.impressions
      return
    }
    byKey.set(key, { keyword: canonicalKeyword(q.query), volume: null, impressions: q.impressions, fromPlan: false, fromPage: true })
  })

  const desc = (a: number | null, b: number | null) => (b ?? -1) - (a ?? -1)
  return Array.from(byKey.values())
    .sort((a, b) => desc(a.volume, b.volume) || desc(a.impressions, b.impressions) || a.keyword.localeCompare(b.keyword, "fr"))
    .slice(0, SECONDARY_LIMIT)
}

/* ------------------------------------------------------------------ */
/* Plan mots-clés : import dans l'onglet Mots-clés                     */
/* ------------------------------------------------------------------ */

type TrackedKeyword = Pick<KeywordRow, "id" | "keyword" | "intent" | "volume" | "target_path">

/** Mots-clés du plan pas encore suivis dans l'onglet Mots-clés (comparaison sans accents ; un mot-clé ignoré est suivi). */
export function planMissing(tracked: Pick<KeywordRow, "keyword">[], plan: PlanKeyword[] = PLAN_KEYWORDS): PlanKeyword[] {
  const keys = new Set(tracked.map((k) => keywordKey(k.keyword)))
  return plan.filter((p) => !keys.has(keywordKey(p.keyword)))
}

export interface PlanImportChanges {
  /** Mots-clés à ajouter (statut « Ciblé », source « import », note du plan). */
  inserts: { keyword: string; status: "targeted"; source: "import"; intent: PlanKeyword["intent"]; volume: number; target_path: string | null; notes: string }[]
  /** Mots-clés déjà suivis dont le volume, la page ou l'intention manquent : seuls ces champs sont complétés, jamais le statut. */
  updates: { id: string; values: Partial<Pick<KeywordRow, "intent" | "volume" | "target_path">> }[]
}

/** Écritures de « Ajouter au suivi » (POST /api/admin/seo/keywords/plan). */
export function planImportChanges(tracked: TrackedKeyword[], note: string, plan: PlanKeyword[] = PLAN_KEYWORDS): PlanImportChanges {
  const byKey = new Map<string, TrackedKeyword>()
  tracked.forEach((k) => {
    const key = keywordKey(k.keyword)
    if (!byKey.has(key)) byKey.set(key, k)
  })
  const out: PlanImportChanges = { inserts: [], updates: [] }
  const seen = new Set<string>()
  plan.forEach((p) => {
    const key = keywordKey(p.keyword)
    if (seen.has(key)) return
    seen.add(key)
    const row = byKey.get(key)
    if (!row) {
      out.inserts.push({ keyword: canonicalKeyword(p.keyword), status: "targeted", source: "import", intent: p.intent, volume: p.volume, target_path: p.targetPath, notes: note })
      return
    }
    const values: PlanImportChanges["updates"][number]["values"] = {}
    if (row.volume === null) values.volume = p.volume
    if (row.target_path === null && p.targetPath !== null) values.target_path = p.targetPath
    if (row.intent === null) values.intent = p.intent
    if (Object.keys(values).length > 0) out.updates.push({ id: row.id, values })
  })
  return out
}
