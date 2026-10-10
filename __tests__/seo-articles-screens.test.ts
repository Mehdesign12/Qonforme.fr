/**
 * Rendu des écrans Articles (sans navigateur) : chaque vue se rend avec des
 * données réelles en forme, montre les libellés validés des planches et ne
 * casse pas sur une liste vide.
 */
import { beforeAll, describe, expect, it, vi } from "vitest"
import * as React from "react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => "/admin/seo/articles",
  useSearchParams: () => new URLSearchParams(""),
}))

import { SETTINGS_DEFAULTS } from "@/lib/seo/settings-schema"
import { monthGrid } from "@/lib/seo/articles/schedule"
import { imageModelOptions, textModelOptions } from "@/lib/seo/articles/models"
import { AUDIT_RULES } from "@/lib/blog-audit"
import type { CalendarData, GenerateDialogData, TopicListItem } from "@/lib/seo/articles/data"

const html = (el: unknown) => renderToStaticMarkup(el as React.ReactElement)

// Le JSX du dépôt est compilé en React.createElement (tsconfig « preserve ») : React doit être global
// avant le chargement des composants
let CalendarView: typeof import("@/components/admin/seo/articles/CalendarView").CalendarView
let ArticleList: typeof import("@/components/admin/seo/articles/ArticleList").ArticleList
let TopicsView: typeof import("@/components/admin/seo/articles/TopicsView").TopicsView
let PreferencesForm: typeof import("@/components/admin/seo/articles/PreferencesForm").PreferencesForm
let ArticlesHeader: typeof import("@/components/admin/seo/articles/ArticlesHeader").ArticlesHeader

beforeAll(async () => {
  ;(globalThis as unknown as { React: typeof React }).React = React
  ;({ CalendarView } = await import("@/components/admin/seo/articles/CalendarView"))
  ;({ ArticleList } = await import("@/components/admin/seo/articles/ArticleList"))
  ;({ TopicsView } = await import("@/components/admin/seo/articles/TopicsView"))
  ;({ PreferencesForm } = await import("@/components/admin/seo/articles/PreferencesForm"))
  ;({ ArticlesHeader } = await import("@/components/admin/seo/articles/ArticlesHeader"))
})

const generate: GenerateDialogData = {
  topics: [],
  keywords: [],
  angles: [],
  lengthMin: 1500,
  lengthMax: 2500,
  coverImage: true,
  summary: "Plan et contrôle par Gemini 3.8 Flash · rédaction par Claude Opus 5.5",
  fallbacks: [],
  blocked: null,
  slot: null,
}

function calendar(): CalendarData {
  const weeks = monthGrid("2026-10")
  return {
    month: "2026-10",
    coverImage: true,
    label: "Octobre 2026",
    prev: "2026-09",
    next: "2026-11",
    today: "2026-10-07",
    weeks: weeks.map((days) => ({
      monday: days[0],
      days: days.map((day) => ({
        day,
        inMonth: day.startsWith("2026-10"),
        isToday: day === "2026-10-07",
        events:
          day === "2026-10-07"
            ? [{ key: "post-1", kind: "post" as const, id: "1", title: "Auto entrepreneur batiment : guide pratique pour le BTP", type: "howto" as const, status: "published" as const, day, time: "21:19", keyword: "auto entrepreneur batiment", sourceTag: "PushRank", href: "/admin/blog/1", topic: null }]
            : day === "2026-10-13"
              ? [
                  {
                    key: "topic-2",
                    kind: "topic" as const,
                    id: "2",
                    title: "Relancer une facture impayée sans perdre le client",
                    type: "howto" as const,
                    status: "scheduled" as const,
                    day,
                    time: "08:00",
                    keyword: "relances automatiques factures",
                    sourceTag: null,
                    href: null,
                    topic: { id: "2", title: "Relancer une facture impayée sans perdre le client", keyword: null, articleType: "howto" as const, angle: null, status: "planned" as const, scheduledAt: "2026-10-13T06:00:00Z", publishMode: "draft" as const, lastError: null, postId: null },
                  },
                ]
              : [],
      })),
    })),
    unplanned: [],
    slots: [],
    defaultMode: "draft",
  }
}

describe("écrans Articles", () => {
  it("en-tête : titre, sous-titre, action primaire et sous-onglets", () => {
    const out = html(createElement(ArticlesHeader, { current: "calendrier", action: { href: "/admin/seo/articles?planifier=1", label: "Planifier un sujet", icon: "plus" } }))
    expect(out).toContain("Organisez vos sujets, créez du contenu et développez votre trafic.")
    expect(out).toContain("Planifier un sujet")
    for (const tab of ["Calendrier", "Articles", "Sujets", "Préférences"]) expect(out).toContain(`>${tab}<`)
    expect(out).toContain('aria-current="page"')
  })

  it("calendrier : grille, agenda par semaine, événements et légende", () => {
    const out = html(createElement(CalendarView, { data: calendar(), filter: null }))
    expect(out).toContain("Octobre 2026")
    expect(out).toContain('aria-label="Mois précédent"')
    expect(out).toContain("Tous les statuts")
    expect(out).toContain("Aujourd&#x27;hui")
    expect(out).toContain('aria-current="date"')
    expect(out).toContain("Lundi")
    expect(out).toContain("Auto entrepreneur batiment")
    expect(out).toContain("PushRank")
    expect(out).toContain("21:19")
    expect(out).toContain("Semaine du 5 au 11")
    expect(out).toContain("Cette semaine")
    expect(out).toContain("Aucun article.")
    expect(out).toContain("Aucun article prévu.")
    for (const s of ["Publié", "Planifié", "Brouillon", "À relire", "Échec"]) expect(out).toContain(s)
  })

  it("liste des articles : onglets d'état comptés, source, contrôle", () => {
    const items = [
      { id: "a", slug: "a", title: "Article publié", type: "howto" as const, keyword: "mot", status: "published" as const, source: "pushrank" as const, date: "2026-10-07T19:19:00Z", control: { count: 0, blocking: 0, labels: [] }, heldReason: null, isPublished: true },
      { id: "b", slug: "b", title: "Article à relire", type: null, keyword: null, status: "to_review" as const, source: "ai" as const, date: null, control: { count: 2, blocking: 1, labels: ["Anciens seuils"] }, heldReason: "Retenu", isPublished: false },
    ]
    const out = html(createElement(ArticleList, { items, sources: ["ai", "manual", "pushrank"], generate }))
    expect(out).toContain("Articles du blog")
    expect(out).toContain("Aucun passage à relire")
    expect(out).toContain("2 passages à relire")
    expect(out).toContain("dont 1 bloquant")
    expect(out).toContain("Source : Génération IA")
    expect(out).toContain("Non renseigné")
    for (const th of ["Titre", "Type", "Mot-clé", "Statut", "Source", "Date", "Contrôle"]) expect(out).toContain(`>${th}<`)
    expect(html(createElement(ArticleList, { items: [], sources: ["ai", "manual"], generate }))).toContain("Aucun article")
  })

  it("sujets : tableau, parution, sans sélection pas de barre d'actions", () => {
    const t: TopicListItem = {
      id: "t1",
      title: "Réforme 2027 : ce qui change pour une TPE du bâtiment",
      keyword: "réforme 2027 facturation",
      articleType: "news",
      angle: null,
      status: "unplanned",
      scheduledAt: null,
      publishMode: "draft",
      lastError: null,
      postId: null,
      source: "keyword",
      notes: null,
      createdAt: "2026-10-09T10:00:00Z",
      date: null,
      displayStatus: "unplanned",
    }
    const out = html(createElement(TopicsView, { data: { topics: [t], archived: 2, nextRelease: "2026-10-12T06:00:00Z", keywords: [], angles: [], slots: [], defaultMode: "draft", coverImage: true }, archived: false }))
    expect(out).toContain("Sujets à traiter")
    expect(out).toContain("Prochaine parution")
    expect(out).toContain("12")
    expect(out).toContain("À planifier")
    expect(out).toContain("Mot-clé")
    expect(out).toContain("Sujets archivés (2)")
    expect(out).not.toContain("sujets sélectionnés")
  })

  it("préférences : cartes, modèles par passe, règles du contrôle", () => {
    const out = html(createElement(PreferencesForm, { initial: SETTINGS_DEFAULTS.articles, textModels: textModelOptions(), imageModels: imageModelOptions(), auditRules: AUDIT_RULES.map((r) => r.label) }))
    for (const title of ["Publication", "Rythme", "Rédaction", "Image de couverture", "Contrôle automatique", "Liens automatiques vers les guides"]) expect(out).toContain(title)
    expect(out).toContain("Recommandé")
    expect(out).toContain("Le contrôle automatique retient toujours un article qui cite une valeur périmée ou une affirmation interdite.")
    expect(out).toContain(`${AUDIT_RULES.length} règles actives`)
    expect(out).toContain("Gemini 3.8 Flash")
    expect(out).toContain("Claude Opus 5.5")
    expect(out).toContain("Nano Banana 2.1")
    expect(out).toContain("Repli automatique")
    expect(out).toContain("Verrouillé")
    expect(out).toContain("Enregistrer les préférences")
    expect(out).toContain("/admin/blog/verification")
  })
})
