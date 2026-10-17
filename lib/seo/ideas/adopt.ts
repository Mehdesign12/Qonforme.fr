/**
 * Adoption d'une idée de la « Proposition IA » : la phrase devient un mot-clé
 * suivi (onglet Mots-clés) et, au choix, un sujet d'article à planifier.
 *
 * - Mot-clé : forme canonique ; un mot-clé déjà suivi garde son statut et ses
 *   réglages (seuls les volumes manquants sont complétés, l'intention jamais
 *   écrasée) ; un mot-clé ignoré n'est pas réactivé en silence (409) ; source
 *   « suggestion » ; le CPC de DataForSEO est en dollars US.
 * - Sujet : un sujet encore ouvert pour ce mot-clé est rendu au lieu d'en créer
 *   un second (même règle que « Créer un sujet d'article » de l'onglet
 *   Mots-clés) ; le mot-clé passe de candidat à ciblé.
 * - Un mot-clé ou un titre qui nomme un concurrent n'entre jamais.
 *
 * Serveur seulement.
 */
import { must, type SeoDb } from "@/lib/seo/db"
import { findCompetitorMentions } from "@/lib/seo/competitors"
import { readAllPages } from "@/lib/seo/keywords/data"
import { normalizeKeyword, canonicalKeyword } from "@/lib/seo/keywords/normalize"
import type { AdoptedIdea, AdoptResult } from "@/lib/seo/ideas/types"

export type { AdoptResult }

/** Sujets qui n'ont pas encore abouti (un nouveau sujet ferait doublon). */
const OPEN_TOPIC_STATUSES = ["unplanned", "planned", "generating", "drafted", "failed"]

export class AdoptError extends Error {
  constructor(message: string, readonly status: 400 | 409 = 409, readonly code?: string) {
    super(message)
    this.name = "AdoptError"
  }
}

interface KeywordRowLite {
  id: string
  status: string
  intent: string | null
  volume: number | null
  difficulty: number | null
  cpc: number | null
}

const note = (idea: AdoptedIdea, day: string) =>
  `Proposition IA du ${day}${idea.note ? ` : ${idea.note.replace(/\s+/g, " ").trim().slice(0, 300)}` : ""}`

/** Jour au format JJ/MM/AAAA (Paris). */
function frDay(now: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" }).format(now)
}

async function openTopicFor(db: SeoDb, keywordId: string, keyword: string): Promise<string | null> {
  const linked = must(
    await db.from("seo_topics").select("id").eq("keyword_id", keywordId).in("status", OPEN_TOPIC_STATUSES).limit(1),
    "les sujets d'articles",
  ) as { id: string }[] | null
  if (linked && linked.length > 0) return linked[0].id

  const orphans = await readAllPages<{ id: string; keyword: string | null }>(
    (from, to) =>
      db
        .from("seo_topics")
        .select("id, keyword")
        .is("keyword_id", null)
        .in("status", OPEN_TOPIC_STATUSES)
        .order("created_at", { ascending: true })
        .range(from, to),
    "les sujets d'articles",
  )
  const orphan = orphans.find((t) => typeof t.keyword === "string" && canonicalKeyword(t.keyword) === keyword)
  if (!orphan) return null
  must(
    await db.from("seo_topics").update({ keyword_id: keywordId, updated_at: new Date().toISOString() }).eq("id", orphan.id).is("keyword_id", null),
    "le rattachement du sujet",
  )
  return orphan.id
}

export async function adoptIdea(
  db: SeoDb,
  idea: AdoptedIdea,
  opts: { createTopic: boolean; /** Le mot-clé est confié à un article : « ciblé » même sans nouveau sujet. */ targeted?: boolean; competitors: string[]; now?: Date },
): Promise<AdoptResult> {
  const now = opts.now ?? new Date()
  const nowIso = now.toISOString()

  const normalized = normalizeKeyword(idea.keyword)
  if (!normalized.ok) throw new AdoptError(normalized.error, 400)
  const keyword = normalized.keyword
  if (findCompetitorMentions(`${keyword}\n${idea.title}\n${idea.note ?? ""}`, opts.competitors).length > 0) {
    throw new AdoptError("Cette idée nomme un concurrent suivi (usage interne) : elle n'entre ni dans les mots-clés ni dans les sujets.", 400, "competitor")
  }

  const existing = must(
    await db.from("seo_keywords").select("id, status, intent, volume, difficulty, cpc").eq("keyword", keyword).maybeSingle(),
    "les mots-clés suivis",
  ) as KeywordRowLite | null

  let keywordId: string
  let keywordAdded = false
  let status: string
  if (existing) {
    if (existing.status === "ignored") {
      throw new AdoptError("Ce mot-clé est ignoré dans l'onglet Mots-clés : choisissez « Ne plus ignorer » avant de l'adopter.", 409, "ignored")
    }
    keywordId = existing.id
    status = existing.status
    // Seules les mesures qui manquent sont complétées ; rien n'est écrasé
    const patch: Record<string, unknown> = {}
    if (existing.volume === null && idea.volume != null) patch.volume = idea.volume
    if (existing.difficulty === null && idea.difficulty != null) patch.difficulty = idea.difficulty
    if (existing.cpc === null && idea.cpc != null) {
      patch.cpc = idea.cpc
      patch.cpc_currency = "USD"
    }
    if (existing.intent === null && idea.intent) patch.intent = idea.intent
    if (Object.keys(patch).length > 0) {
      must(await db.from("seo_keywords").update({ ...patch, updated_at: nowIso }).eq("id", existing.id), "la mise à jour du mot-clé")
    }
  } else {
    const hasMetrics = idea.volume != null || idea.difficulty != null || idea.cpc != null
    const row: Record<string, unknown> = {
      keyword,
      status: opts.createTopic || opts.targeted ? "targeted" : "candidate",
      source: "suggestion",
      intent: idea.intent ?? null,
      notes: note(idea, frDay(now)),
      created_at: nowIso,
      updated_at: nowIso,
    }
    if (idea.volume != null) row.volume = idea.volume
    if (idea.difficulty != null) row.difficulty = idea.difficulty
    if (idea.cpc != null) {
      row.cpc = idea.cpc
      row.cpc_currency = "USD"
    }
    if (hasMetrics) row.metrics_checked_at = nowIso
    const res = await db.from("seo_keywords").insert(row).select("id").single()
    if (res.error?.code === "23505") {
      // Ajouté entre-temps (double clic, autre onglet) : on le reprend
      const again = must(await db.from("seo_keywords").select("id, status").eq("keyword", keyword).maybeSingle(), "les mots-clés suivis") as {
        id: string
        status: string
      } | null
      if (!again) throw new AdoptError("Ce mot-clé vient d'être ajouté : réessayez.", 409)
      if (again.status === "ignored") throw new AdoptError("Ce mot-clé est ignoré dans l'onglet Mots-clés.", 409, "ignored")
      keywordId = again.id
      status = again.status
    } else {
      const created = must(res, "l'ajout du mot-clé") as { id: string }
      keywordId = created.id
      keywordAdded = true
      status = String(row.status)
    }
  }

  const promote = async () => {
    if (status !== "candidate") return
    must(await db.from("seo_keywords").update({ status: "targeted", updated_at: nowIso }).eq("id", keywordId).eq("status", "candidate"), "la mise à jour du mot-clé")
    status = "targeted"
  }

  if (!opts.createTopic) {
    if (opts.targeted) await promote()
    return { keywordId, keyword, keywordAdded, topicId: null, topicExisting: false }
  }

  const existingTopic = await openTopicFor(db, keywordId, keyword)
  if (existingTopic) {
    await promote()
    return { keywordId, keyword, keywordAdded, topicId: existingTopic, topicExisting: true }
  }

  const topic = must(
    await db
      .from("seo_topics")
      .insert({
        title: idea.title.trim().slice(0, 160),
        keyword,
        keyword_id: keywordId,
        source: "keyword",
        article_type: idea.articleType,
        status: "unplanned",
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id")
      .single(),
    "la création du sujet",
  ) as { id: string }
  await promote()
  return { keywordId, keyword, keywordAdded, topicId: topic.id, topicExisting: false }
}
