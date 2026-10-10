/**
 * POST /api/admin/seo/keywords/<id>/topic → { topicId, existing, status }
 *
 * « Créer un sujet d'article » : ajoute à seo_topics un sujet « à planifier »
 * tiré du mot-clé (titre proposé, retouché ensuite dans Articles › Sujets), et
 * passe le mot-clé de candidat à ciblé. Un sujet encore ouvert pour ce
 * mot-clé est rendu au lieu d'en créer un second : rattaché par keyword_id, ou
 * par son texte quand il a été repris de PushRank ou créé dans Articles sans
 * mot-clé connu (il est alors rattaché au passage). Le candidat passe à ciblé
 * dans les deux cas.
 *
 * 409 : mot-clé ignoré (ne plus l'ignorer d'abord). Aucun texte n'est
 * interpolé dans un filtre `.or()` : le texte d'un mot-clé peut contenir une
 * virgule, une parenthèse ou un guillemet ; le rapprochement par le texte se
 * fait en mémoire, par forme canonique.
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, must, seoDb, type SeoDb } from "@/lib/seo/db"
import { getKeyword, readAllPages } from "@/lib/seo/keywords/data"
import { isUuid, topicTitleFor } from "@/lib/seo/keywords/input"
import { canonicalKeyword } from "@/lib/seo/keywords/normalize"
import { findCompetitorMentions } from "@/lib/seo/competitors"
import { getSettings } from "@/lib/seo/settings"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> | { id: string } }

/**
 * Sujets qui n'ont pas encore abouti (un nouveau sujet ferait doublon) ; un
 * sujet « failed » se relance ou se replanifie dans Articles.
 */
const OPEN_TOPIC_STATUSES = ["unplanned", "planned", "generating", "drafted", "failed"]

const IGNORED_MESSAGE = "Ce mot-clé est ignoré : choisissez « Ne plus ignorer » avant de créer un sujet."

/** Sujet ouvert du mot-clé : par keyword_id, sinon sujet sans mot-clé rattaché dont le texte correspond. */
async function openTopicFor(db: SeoDb, keyword: { id: string; keyword: string }): Promise<string | null> {
  const linked = must(
    await db.from("seo_topics").select("id").eq("keyword_id", keyword.id).in("status", OPEN_TOPIC_STATUSES).limit(1),
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
  const orphan = orphans.find((t) => typeof t.keyword === "string" && canonicalKeyword(t.keyword) === keyword.keyword)
  if (!orphan) return null
  must(
    await db
      .from("seo_topics")
      .update({ keyword_id: keyword.id, updated_at: new Date().toISOString() })
      .eq("id", orphan.id)
      .is("keyword_id", null),
    "le rattachement du sujet",
  )
  return orphan.id
}

export async function POST(_request: NextRequest, { params }: Params) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: "Mot-clé introuvable" }, { status: 404 })

  try {
    const db = seoDb()
    const keyword = await getKeyword(db, id)
    if (!keyword) return NextResponse.json({ error: "Mot-clé introuvable" }, { status: 404 })
    if (keyword.status === "ignored") return NextResponse.json({ error: IGNORED_MESSAGE, code: "ignored" }, { status: 409 })

    const now = new Date().toISOString()
    const promote = async () => {
      if (keyword.status !== "candidate") return keyword.status
      must(
        await db.from("seo_keywords").update({ status: "targeted", updated_at: now }).eq("id", id).eq("status", "candidate"),
        "la mise à jour du mot-clé",
      )
      return "targeted" as const
    }

    const existingId = await openTopicFor(db, keyword)
    if (existingId) {
      return NextResponse.json({ topicId: existingId, existing: true, status: await promote() })
    }

    // Comme à la création d'un sujet : un mot-clé qui nomme un concurrent ne devient pas un sujet d'article
    const targeting = await getSettings(db, "targeting")
    if (findCompetitorMentions(keyword.keyword, targeting.value.competitors).length > 0) {
      return NextResponse.json(
        { error: "Ce mot-clé nomme un concurrent : il ne peut pas devenir un sujet d'article." },
        { status: 409 },
      )
    }

    const topic = must(
      await db
        .from("seo_topics")
        .insert({
          title: topicTitleFor(keyword.keyword),
          keyword: keyword.keyword,
          keyword_id: keyword.id,
          source: "keyword",
          article_type: "guide",
          status: "unplanned",
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single(),
      "la création du sujet",
    ) as { id: string }

    return NextResponse.json({ topicId: topic.id, existing: false, status: await promote() }, { status: 201 })
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
