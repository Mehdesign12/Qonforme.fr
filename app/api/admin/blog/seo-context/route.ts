/**
 * GET /api/admin/blog/seo-context?id=<article>&keyword=<mot-clé> → SeoContext
 *
 * Tout ce que le panneau Référencement de l'éditeur d'articles lit en dehors
 * du texte :
 * - mots-clés proposés : onglet Mots-clés (sans les ignorés) et plan du
 *   16/10/2026 fusionnés (lib/seo/articles/secondary.ts) ; un mot-clé du plan
 *   ignoré dans l'onglet reste ignoré ;
 * - requêtes de Search Console qui affichent l'article (/blog/<adresse>,
 *   90 jours) : mots-clés secondaires ;
 * - autres articles (titre unique, cannibalisation), lecture tolérante des
 *   colonnes ajoutées par les migrations 20261006 et 20261009 ;
 * - pour `keyword` : page du site qui ressort déjà dans Google sur cette
 *   recherche (90 jours), page choisie dans l'onglet Mots-clés, autres
 *   articles qui la visent ;
 * - concurrents (contrôle en direct, usage interne) et préférences
 *   (longueur, heure de publication).
 *
 * Search Console en panne ou pas encore reliée : `gsc.connected = false`, la
 * route répond quand même. Onglet SEO pas encore migré : valeurs par défaut
 * et mots-clés du plan seuls. Toute autre lecture en échec : 503.
 *
 * `only=keyword` (changement de mot-clé dans l'éditeur) : seulement
 * `keywordPages`, sans relire les réglages ni les requêtes de la page.
 * Lectures de Search Console lancées en même temps.
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, failureOf, must, seoDb, type SeoDb } from "@/lib/seo/db"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { getAllSettings, SETTINGS_DEFAULTS } from "@/lib/seo/settings"
import { readGscBounds } from "@/lib/seo/actions/gsc"
import { listAllKeywords, topPageFor } from "@/lib/seo/keywords/data"
import { canonicalKeyword } from "@/lib/seo/keywords/normalize"
import { readPageQueries } from "@/lib/seo/search-console/page"
import { ID } from "@/lib/seo/articles/input"
import { editorKeywordOf, keywordKey, mergePlanKeywords } from "@/lib/seo/articles/secondary"
import { addDays } from "@/lib/utils/paris-date"
import type { DateRange } from "@/lib/seo/period"
import type { EditorKeyword, KeywordPages, OtherPost, PageQuery, SeoContext } from "@/lib/seo/articles/editor-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Requêtes de la page gardées pour les mots-clés secondaires. */
const PAGE_QUERIES = 30
/** Fenêtre de Search Console (jours). */
const WINDOW_DAYS = 90

interface PostLite {
  id: string
  title: string
  slug: string
  target_keyword?: string | null
  seo_title?: string | null
}

/** Articles du blog ; sans les colonnes des migrations récentes si elles manquent. */
async function readPosts(db: SeoDb): Promise<PostLite[]> {
  const full = await db.from("blog_posts").select("id, title, slug, target_keyword, seo_title").order("created_at", { ascending: false }).limit(2000)
  if (!full.error) return (full.data ?? []) as PostLite[]
  if (!isMissingSchemaError(full.error)) return must(full, "les articles du blog") as unknown as PostLite[]
  const bare = await db.from("blog_posts").select("id, title, slug").order("created_at", { ascending: false }).limit(2000)
  return ((must(bare, "les articles du blog") ?? []) as PostLite[]).map((p) => ({ id: p.id, title: p.title, slug: p.slug }))
}

/** Lecture qui rend `fallback` si l'onglet SEO n'est pas encore migré (toute autre erreur remonte). */
async function unlessPending<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (failureOf(error) === "migration_pending") return fallback
    throw error
  }
}

/** Lecture de Search Console : une panne ne fait jamais échouer la route. */
async function gscSafe<T>(fn: () => Promise<T>, fallback: T): Promise<{ value: T; failed: boolean }> {
  try {
    return { value: await fn(), failed: false }
  } catch (error) {
    console.error("[blog] Search Console indisponible pour l'éditeur", error)
    return { value: fallback, failed: true }
  }
}

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const params = request.nextUrl.searchParams
  const rawId = params.get("id")?.trim() || null
  if (rawId && !ID.safeParse(rawId).success) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 })
  const rawKeyword = params.get("keyword")
  const keyword = rawKeyword ? canonicalKeyword(rawKeyword).slice(0, 120) : ""
  // Changement de mot-clé : seul keywordPages en dépend
  const onlyKeyword = params.get("only") === "keyword"

  try {
    const db = seoDb()
    const [settings, rows, posts] = await Promise.all([
      onlyKeyword ? null : unlessPending(() => getAllSettings(db), null),
      unlessPending(() => listAllKeywords(db), []),
      readPosts(db),
    ])
    const prefs = settings?.articles.value ?? SETTINGS_DEFAULTS.articles
    const competitors = settings?.targeting.value.competitors ?? SETTINGS_DEFAULTS.targeting.competitors

    // Un mot-clé du plan ignoré dans l'onglet Mots-clés reste ignoré : fusion avant le filtre
    const keywords: EditorKeyword[] = mergePlanKeywords(rows.map(editorKeywordOf)).filter((k) => k.status !== "ignored")

    const self = rawId ? posts.find((p) => p.id === rawId) ?? null : null
    const others: OtherPost[] = posts
      .filter((p) => p.id !== rawId)
      .map((p) => ({ id: p.id, title: p.title, slug: p.slug, targetKeyword: p.target_keyword ?? null, seoTitle: p.seo_title ?? null }))

    /* ---------------- Search Console ---------------- */
    const bounds = await gscSafe(() => readGscBounds(db), { first: null, last: null })
    const lastDate = bounds.value.last
    const range: DateRange | null = lastDate ? { from: addDays(lastDate, -(WINDOW_DAYS - 1)), to: lastDate } : null
    let connected = !bounds.failed && lastDate !== null

    // Requêtes de la page et page qui ressort sur le mot-clé : en même temps
    const [pageRes, topRes] = await Promise.all([
      range && self?.slug && !onlyKeyword ? gscSafe(() => readPageQueries(db, `/blog/${self.slug}`, range, PAGE_QUERIES), [] as PageQuery[]) : null,
      range && keyword ? gscSafe(() => topPageFor(db, keyword, range), null) : null,
    ])
    const pageQueries: PageQuery[] = pageRes?.value ?? []
    if (pageRes?.failed || topRes?.failed) connected = false

    /* ---------------- Mot-clé choisi ---------------- */
    let keywordPages: KeywordPages | null = null
    if (keyword) {
      const key = keywordKey(keyword)
      keywordPages = {
        keyword,
        topPage: topRes?.value ?? null,
        targetPath: keywords.find((k) => keywordKey(k.keyword) === key)?.targetPath ?? null,
        posts: others.filter((p) => p.targetKeyword && keywordKey(p.targetKeyword) === key).map((p) => ({ id: p.id, title: p.title, slug: p.slug })),
      }
    }

    if (onlyKeyword) {
      const partial: Pick<SeoContext, "keywordPages"> = { keywordPages }
      return NextResponse.json(partial)
    }

    const body: SeoContext = {
      keywords,
      pageQueries,
      gsc: { connected, lastDate: connected ? lastDate : null },
      others,
      keywordPages,
      competitors,
      prefs: { lengthMin: prefs.lengthMin, lengthMax: prefs.lengthMax, publishTime: prefs.time },
    }
    return NextResponse.json(body)
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
