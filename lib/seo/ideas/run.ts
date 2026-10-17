/**
 * « Proposition IA » de bout en bout : le contexte du site, le modèle qui
 * pense comme l'artisan, puis la vérification de chaque phrase.
 *
 * 1. Contexte : mots-clés suivis, sujets, articles, requêtes réelles de Search
 *    Console (jamais un concurrent : les lignes qui en nomment un sont retirées
 *    avant d'entrer dans la consigne).
 * 2. Le modèle du plan (Préférences d'écriture ; repli automatique si sa clé
 *    manque) propose deux fois plus de phrases que demandé.
 * 3. Contrôle (lib/seo/ideas/rank.ts) : forme, concurrents, marque, valeurs
 *    périmées, titre ; doublons entre elles.
 * 4. En parallèle : saisie semi-automatique de Google (la phrase existe-t-elle ?)
 *    et DataForSEO (volume, difficulté, CPC) si les identifiants sont là.
 * 5. Rapprochement avec l'existant, score, tri : `count` idées au plus.
 *
 * Une panne de Google ou de DataForSEO n'empêche jamais la proposition : les
 * phrases restent montrées « non vérifiées », sans volume, avec une remarque.
 */
import { must, type SeoDb } from "@/lib/seo/db"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { getAllSettings } from "@/lib/seo/settings"
import { assertNoCompetitorInPrompt, findCompetitorMentions } from "@/lib/seo/competitors"
import { generateText, hasKey, modelLabel, resolvePassModel, type GenerateTextInput, type GenerateTextResult } from "@/lib/seo/articles/models"
import { canonicalKeyword, foldAccents } from "@/lib/seo/keywords/normalize"
import { gscBounds, gscQueries, keywordPeriod, listAllKeywords } from "@/lib/seo/keywords/data"
import { dataForSeoCredentials, DataForSeoError, fetchKeywordMetrics, isSendableKeyword, type KeywordMetrics } from "@/lib/seo/keywords/dataforseo"
import { verifyKeywords, type SuggestFn } from "@/lib/seo/ideas/autocomplete"
import {
  buildIdeasPrompt,
  buildIdeasSystemPrompt,
  clampCount,
  IDEAS_JSON_SCHEMA,
  parseIdeasOutput,
  requestedCandidates,
  type IdeasContext,
} from "@/lib/seo/ideas/prompt"
import { overlapsOf, scoreIdea, shapeIdea, type ExistingSources, type RankingEntry } from "@/lib/seo/ideas/rank"
import type { Idea, IdeaRequest, IdeasResponse, MetricsState } from "@/lib/seo/ideas/types"

/** Délai du modèle, de la vérification Google et de DataForSEO (la route dure 60 s au plus). */
const MODEL_TIMEOUT_MS = 28_000
const AUTOCOMPLETE_BUDGET_MS = 12_000
const METRICS_BUDGET_MS = 30_000

export interface IdeasDeps {
  now?: Date
  /** Appel du modèle (remplacé dans les tests). */
  complete?: (input: GenerateTextInput) => Promise<GenerateTextResult>
  /** Saisie semi-automatique de Google (remplacée dans les tests). */
  suggest?: SuggestFn
  /** Mesures DataForSEO : null = non configuré (remplacé dans les tests). */
  metrics?: ((keywords: string[], opts: { deadline: number }) => Promise<Map<string, KeywordMetrics>>) | null
}

interface PostRow {
  title: string
  slug: string
  target_keyword?: string | null
}

/** Articles du blog ; sans la colonne du mot-clé si la migration manque. */
async function readPosts(db: SeoDb): Promise<PostRow[]> {
  const full = await db.from("blog_posts").select("title, slug, target_keyword").order("created_at", { ascending: false }).limit(2000)
  if (!full.error) return (full.data ?? []) as PostRow[]
  if (!isMissingSchemaError(full.error)) return must(full, "les articles du blog") as unknown as PostRow[]
  const bare = await db.from("blog_posts").select("title, slug").order("created_at", { ascending: false }).limit(2000)
  return (must(bare, "les articles du blog") ?? []) as PostRow[]
}

interface Loaded {
  sources: ExistingSources
  keywordList: string[]
  gscQueriesList: { query: string; impressions: number; position: number | null }[]
  gscFailed: boolean
}

async function loadSources(db: SeoDb, now: Date): Promise<Loaded> {
  const [keywordRows, topicRows, posts] = await Promise.all([
    listAllKeywords(db, "id, keyword, status, target_path"),
    db.from("seo_topics").select("title, keyword, status").neq("status", "archived").limit(500),
    readPosts(db),
  ])
  const topics = (must(topicRows, "les sujets") ?? []) as { title: string; keyword: string | null }[]

  const ranking = new Map<string, RankingEntry>()
  const queries: { query: string; impressions: number; position: number | null }[] = []
  let gscFailed = false
  try {
    const range = keywordPeriod(await gscBounds(db), now)
    if (range) {
      for (const row of await gscQueries(db, range)) {
        const key = canonicalKeyword(row.query)
        const impressions = Number(row.impressions) || 0
        const position = row.avg_position === null || row.avg_position === undefined ? null : Number(row.avg_position)
        if (!key || impressions <= 0) continue
        const entry = { impressions, position: position !== null && Number.isFinite(position) ? position : null }
        ranking.set(key, entry)
        queries.push({ query: key, ...entry })
      }
    }
  } catch (error) {
    gscFailed = true
    console.error("[seo-ideas] Search Console indisponible", error instanceof Error ? error.message.slice(0, 160) : "")
  }
  queries.sort((a, b) => b.impressions - a.impressions)

  const tracked = new Map(keywordRows.filter((k) => k.status !== "ignored").map((k) => [k.keyword, { keyword: k.keyword, status: k.status, target_path: k.target_path }]))
  return {
    sources: { posts, topics, tracked, ranking },
    keywordList: Array.from(tracked.keys()),
    gscQueriesList: queries,
    gscFailed,
  }
}

const defaultMetrics = (keywords: string[], opts: { deadline: number }) => fetchKeywordMetrics(keywords, opts)

export async function generateIdeas(db: SeoDb, req: IdeaRequest, deps: IdeasDeps = {}): Promise<IdeasResponse> {
  const now = deps.now ?? new Date()
  const settings = await getAllSettings(db)
  const competitors = settings.targeting.value.competitors
  const brandTerms = settings.targeting.value.brandTerms
  const prefs = settings.articles.value
  const count = clampCount(req.count)

  const loaded = await loadSources(db, now)
  const notes: string[] = []
  if (loaded.gscFailed) notes.push("Search Console est injoignable : les requêtes réelles du site ne sont pas prises en compte.")

  // Rien de ce qui nomme un concurrent n'entre dans la consigne
  const safe = (text: string) => findCompetitorMentions(text, competitors).length === 0
  const isBrand = (text: string) => brandTerms.some((t) => t.trim().length >= 3 && foldAccents(text).includes(foldAccents(t)))
  const selfTitle = req.article?.title.trim().toLowerCase()
  const sources: ExistingSources = {
    ...loaded.sources,
    // Mode « article » : l'article lui-même n'est pas un doublon de ses propres requêtes
    posts: loaded.sources.posts.filter((p) => !selfTitle || p.title.trim().toLowerCase() !== selfTitle),
  }
  const context: IdeasContext = {
    keywords: loaded.keywordList.filter(safe),
    topics: sources.topics.map((t) => t.title).filter(safe),
    posts: sources.posts.filter((p) => safe(p.title)).map((p) => ({ title: p.title, keyword: p.target_keyword ?? null })),
    queries: loaded.gscQueriesList.filter((q) => safe(q.query) && !isBrand(q.query)).slice(0, 40),
  }

  const system = buildIdeasSystemPrompt({ brand: settings.brand.value, strategy: settings.strategy.value })
  const prompt = buildIdeasPrompt({ ...req, count }, context)
  assertNoCompetitorInPrompt(`${system}\n${prompt}`, competitors)

  const choice = resolvePassModel(prefs.planModel, prefs.textModel, hasKey)
  const complete = deps.complete ?? generateText
  const res = await complete({ model: choice.model, system, prompt, maxOutputTokens: 8_000, json: { schema: IDEAS_JSON_SCHEMA }, timeoutMs: MODEL_TIMEOUT_MS })
  if (res.fallbackFrom) notes.push(`Idées par ${modelLabel(res.model)} au lieu de ${modelLabel(res.fallbackFrom.model)} : ${res.fallbackFrom.reason}.`)
  else if (choice.fallbackReason) notes.push(`Idées par ${modelLabel(choice.model)} au lieu de ${modelLabel(choice.requested)} : ${choice.fallbackReason}.`)

  // Contrôle de chaque phrase, sans doublon
  const shaped: Extract<ReturnType<typeof shapeIdea>, { ok: true }>["idea"][] = []
  const seen = new Set<string>()
  let rejected = 0
  for (const raw of parseIdeasOutput(res.text)) {
    const result = shapeIdea(raw, { competitors, brandTerms })
    if (!result.ok) {
      rejected++
      continue
    }
    if (seen.has(result.idea.keyword)) continue
    seen.add(result.idea.keyword)
    shaped.push(result.idea)
    if (shaped.length >= requestedCandidates(count)) break
  }
  if (rejected > 0) notes.push(`${rejected} proposition${rejected > 1 ? "s" : ""} écartée${rejected > 1 ? "s" : ""} (concurrent, marque, valeur périmée ou forme).`)
  if (shaped.length === 0) return { ideas: [], notes: [...notes, "Aucune proposition exploitable : relancez la recherche."], model: modelLabel(res.model), autocomplete: "ok", metrics: "skipped" }

  // Existence de la phrase (Google) et mesures (DataForSEO), en parallèle
  const keywords = shaped.map((i) => i.keyword)
  const metricsFn = deps.metrics === undefined ? (dataForSeoCredentials() ? defaultMetrics : null) : deps.metrics
  const sendable = keywords.filter(isSendableKeyword)
  let metricsState: MetricsState = metricsFn === null ? "not_configured" : "ok"
  const [verified, measures] = await Promise.all([
    verifyKeywords(keywords, { suggest: deps.suggest, deadline: Date.now() + AUTOCOMPLETE_BUDGET_MS }),
    metricsFn && sendable.length > 0
      ? metricsFn(sendable, { deadline: Date.now() + METRICS_BUDGET_MS }).catch((error: unknown) => {
          metricsState = "unavailable"
          notes.push(error instanceof DataForSeoError ? error.message : "DataForSEO n'a pas répondu : les volumes manquent.")
          return new Map<string, KeywordMetrics>()
        })
      : Promise.resolve(new Map<string, KeywordMetrics>()),
  ])
  if (verified.state === "unavailable") notes.push("La saisie semi-automatique de Google n'a pas répondu : les phrases sont montrées sans vérification.")
  else if (verified.state === "partial") notes.push("Google n'a pas répondu pour toutes les phrases : certaines ne sont pas vérifiées.")
  if (metricsState === "not_configured") notes.push("DataForSEO n'est pas configuré (Paramètres › Connexions) : les volumes ne sont pas mesurés.")

  const ideas: Idea[] = shaped.map((s) => {
    const v = verified.results.get(s.keyword)
    const m = measures.get(s.keyword)
    const { overlaps, ranking, tracked } = overlapsOf(s.keyword, sources)
    const idea: Idea = {
      ...s,
      verified: Boolean(v?.verified),
      googleAlso: v?.also ?? [],
      volume: m?.volume ?? null,
      difficulty: m?.difficulty ?? null,
      cpc: m?.cpc ?? null,
      intent: m?.intent ?? null,
      ranking,
      overlaps,
      tracked,
      score: 0,
    }
    idea.score = scoreIdea(idea)
    return idea
  })
  ideas.sort((a, b) => b.score - a.score || b.keyword.length - a.keyword.length || a.keyword.localeCompare(b.keyword, "fr"))
  return { ideas: ideas.slice(0, count), notes, model: modelLabel(res.model), autocomplete: verified.state, metrics: metricsState }
}
