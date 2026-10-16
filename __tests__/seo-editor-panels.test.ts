// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as React from "react"
import { act, createElement, useState } from "react"
import { createRoot, type Root } from "react-dom/client"

// Les composants .tsx sont compilés ici en React.createElement (JSX classique de vitest)
;(globalThis as { React?: typeof React }).React = React
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ toasts: [] as string[], refresh: vi.fn() }))
vi.mock("sonner", () => {
  const toast = Object.assign((m: string) => void mocks.toasts.push(m), {
    success: (m: string) => void mocks.toasts.push(m),
    error: (m: string) => void mocks.toasts.push(m),
  })
  return { toast }
})
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn(), replace: vi.fn() }) }))

import { KeywordPicker, difficultyOf, filterKeywordOptions, sortKeywordOptions } from "@/components/admin/blog/seo/KeywordPicker"
import { PublicationPanel, longDay, PUBLISH_TIMES, type PublicationValue } from "@/components/admin/blog/seo/PublicationPanel"
import { SeoScore, scoreLabel } from "@/components/admin/blog/seo/SeoScore"
import { SuggestButton, SuggestionList, useSuggest } from "@/components/admin/blog/seo/SuggestButton"
import { SerpPreview, serpTitle, serpDate } from "@/components/admin/blog/seo/SerpPreview"
import { CharMeter, charTone } from "@/components/admin/blog/seo/CharMeter"
import { SecondaryKeywords } from "@/components/admin/blog/seo/SecondaryKeywords"
import { PlanImportCard } from "@/components/admin/seo/keywords/PlanImportCard"
import { useSeoContext, seoContextUrl } from "@/components/admin/blog/seo/useSeoContext"
import { analyzeOnPage, type OnPageTarget } from "@/lib/seo/articles/onpage"
import type { EditorKeyword, KeywordPages, SeoContext, SuggestRequest } from "@/lib/seo/articles/editor-types"

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  mocks.toasts = []
  mocks.refresh.mockReset()
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  document.body.innerHTML = ""
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)))
const render = (el: React.ReactElement) => act(async () => root.render(el))

function buttonByText(text: string | RegExp, scope: ParentNode = document): HTMLButtonElement {
  const list = Array.from(scope.querySelectorAll("button")) as HTMLButtonElement[]
  const found = list.find((b) => (typeof text === "string" ? b.textContent?.includes(text) : text.test(b.textContent ?? "")))
  if (!found) throw new Error(`Bouton introuvable : ${text}`)
  return found
}

async function click(el: HTMLElement) {
  await act(async () => el.click())
  await flush()
}

async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
    setter.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}

async function key(el: HTMLElement, k: string) {
  await act(async () => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }))
  })
}

function kw(keyword: string, over: Partial<EditorKeyword> = {}): EditorKeyword {
  return { id: `id-${keyword}`, keyword, status: "candidate", intent: null, volume: null, difficulty: null, position: null, clicks: null, impressions: null, targetPath: null, fromPlan: false, ...over }
}

/* ------------------------------------------------------------------ */
/* KeywordPicker                                                       */
/* ------------------------------------------------------------------ */

const KEYWORDS = [
  kw("devis maçon", { volume: 1000 }),
  kw("exemple devis maçonnerie", { volume: 170, fromPlan: true, difficulty: 8, position: 12.4 }),
  kw("logiciel plombier", { volume: 260, status: "targeted", difficulty: 45 }),
  kw("devis carrelage", { volume: 90 }),
]

function PickerHarness({ initial = null, pages = null, onChange }: { initial?: string | null; pages?: KeywordPages | null; onChange?: (k: string | null) => void }) {
  const [value, setValue] = useState<string | null>(initial)
  return createElement(KeywordPicker, {
    value,
    onChange: (k: string | null) => {
      setValue(k)
      onChange?.(k)
    },
    keywords: KEYWORDS,
    keywordPages: pages,
    slug: "exemple-devis-maconnerie",
    selfId: "self",
    inputId: "mot-cle",
  })
}

describe("KeywordPicker", () => {
  it("tri : ciblés et plan d'abord, puis volume ; filtre sans accents", () => {
    expect(sortKeywordOptions(KEYWORDS).map((k) => k.keyword)).toEqual(["logiciel plombier", "exemple devis maçonnerie", "devis maçon", "devis carrelage"])
    expect(filterKeywordOptions(KEYWORDS, "MACON").map((k) => k.keyword)).toEqual(["devis maçon", "exemple devis maçonnerie"])
    expect(filterKeywordOptions(KEYWORDS, "devis exemple").map((k) => k.keyword)).toEqual(["exemple devis maçonnerie"])
    expect(difficultyOf(12)).toEqual({ label: "Facile", tone: "ok" })
    expect(difficultyOf(30)?.label).toBe("Moyenne")
    expect(difficultyOf(60)?.label).toBe("Difficile")
    expect(difficultyOf(null)).toBeNull()
  })

  it("combobox : liste au focus, flèches et Entrée, carte du mot-clé choisi", async () => {
    const changes: (string | null)[] = []
    await render(createElement(PickerHarness, { onChange: (k) => changes.push(k) }))
    const input = document.getElementById("mot-cle") as HTMLInputElement
    expect(input.getAttribute("role")).toBe("combobox")
    await act(async () => input.focus())
    expect(input.getAttribute("aria-expanded")).toBe("true")
    const options = container.querySelectorAll('[role="option"]')
    expect(options).toHaveLength(4)
    expect(options[1].textContent).toContain("Plan")
    expect(options[1].textContent).toContain("170/mois")
    expect(options[1].textContent).toContain("Facile")
    expect(options[1].textContent).toContain("Pos. 12")

    await key(input, "ArrowDown")
    expect(input.getAttribute("aria-activedescendant")).toBe(options[1].id)
    await key(input, "Enter")
    await flush()
    expect(changes).toEqual(["exemple devis maçonnerie"])
    // Carte : chiffres, « Changer » reçoit l'identifiant et le focus
    expect(container.textContent).toContain("Plan d'octobre")
    expect(container.textContent).toContain("12,4")
    const change = document.getElementById("mot-cle") as HTMLElement
    expect(change.tagName).toBe("BUTTON")
    expect(document.activeElement).toBe(change)
  })

  it("mot-clé libre : « Utiliser « … » », orthographe sans accents signalée", async () => {
    const changes: (string | null)[] = []
    await render(createElement(PickerHarness, { onChange: (k) => changes.push(k) }))
    const input = document.getElementById("mot-cle") as HTMLInputElement
    await act(async () => input.focus())
    await type(input, "Devis Batiment Renovation")
    const options = Array.from(container.querySelectorAll('[role="option"]'))
    expect(options).toHaveLength(1)
    expect(options[0].textContent).toContain("Utiliser « devis batiment renovation »")
    await key(input, "Enter")
    await flush()
    expect(changes).toEqual(["devis batiment renovation"])
    expect(container.textContent).toContain("Mot-clé libre, pas encore suivi")
    expect(container.textContent).toContain("Écrivez « bâtiment » et « rénovation » dans l'article, avec leurs accents")
  })

  it("Échap revient à la carte sans rien changer ; « Retirer » vide le mot-clé", async () => {
    const changes: (string | null)[] = []
    await render(createElement(PickerHarness, { initial: "devis maçon", onChange: (k) => changes.push(k) }))
    await click(container.querySelector('button[aria-label^="Changer de mot-clé"]') as HTMLButtonElement)
    const input = document.getElementById("mot-cle") as HTMLInputElement
    expect(input.tagName).toBe("INPUT")
    expect(document.activeElement).toBe(input)
    await key(input, "Escape") // ferme la liste
    await key(input, "Escape") // revient à la carte
    await flush()
    expect(changes).toEqual([])
    expect(document.getElementById("mot-cle")?.tagName).toBe("BUTTON")
    await click(container.querySelector('button[aria-label^="Retirer le mot-clé"]') as HTMLButtonElement)
    expect(changes).toEqual([null])
    expect(document.getElementById("mot-cle")?.tagName).toBe("INPUT")
  })

  it("saisie : une adresse web est signalée, pas une première lettre", async () => {
    await render(createElement(PickerHarness, {}))
    const input = document.getElementById("mot-cle") as HTMLInputElement
    await act(async () => input.focus())
    await type(input, "d")
    expect(container.querySelector("[id$='-aide']")?.textContent).not.toContain("au moins")
    await type(input, "https://qonforme.fr/modele")
    expect(container.textContent).toContain("pas une adresse web")
    expect(Array.from(container.querySelectorAll('[role="option"]')).some((o) => o.textContent?.includes("Utiliser"))).toBe(false)
  })

  it("mots-clés illisibles : la carte ne prétend pas que le mot-clé est libre, « Réessayer »", async () => {
    const retry = vi.fn()
    await render(
      createElement(KeywordPicker, {
        value: "devis maçon",
        onChange: () => {},
        keywords: null,
        keywordPages: null,
        loading: false,
        error: "Les données de référencement sont indisponibles pour le moment.",
        onRetry: retry,
        slug: "devis-macon",
      }),
    )
    expect(container.textContent).toContain("Mesures indisponibles pour le moment")
    expect(container.textContent).not.toContain("Mot-clé libre")
    await click(buttonByText("Réessayer", container))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it("risque de concurrence : autre page, autre article, page de l'onglet Mots-clés ; sa propre page ignorée", async () => {
    const pages: KeywordPages = {
      keyword: "exemple devis maçonnerie",
      topPage: { page: "/modele/devis-maconnerie", clicks: 2, impressions: 140, position: 6.2 },
      targetPath: "/modele/devis-maconnerie",
      posts: [{ id: "autre", title: "Devis de maçonnerie : modèle", slug: "devis-maconnerie-modele" }, { id: "self", title: "Moi", slug: "exemple-devis-maconnerie" }],
    }
    await render(createElement(PickerHarness, { initial: "exemple devis maçonnerie", pages }))
    const banner = container.querySelector(".q-banner-warn") as HTMLElement
    expect(banner.textContent).toContain("Risque de concurrence entre vos pages")
    expect(banner.textContent).toContain("/modele/devis-maconnerie")
    expect(banner.textContent).toContain("position 6,2")
    expect(banner.textContent).toContain("Devis de maçonnerie : modèle")
    expect(banner.textContent).not.toContain("Moi")
    // La page de l'onglet Mots-clés est la même que celle qui ressort : une seule mention
    expect(banner.querySelectorAll("li")).toHaveLength(2)
    expect((banner.querySelector('a[href="https://qonforme.fr/modele/devis-maconnerie"]') as HTMLAnchorElement).target).toBe("_blank")

    await render(
      createElement(PickerHarness, {
        initial: "exemple devis maçonnerie",
        pages: { keyword: "exemple devis maçonnerie", topPage: { page: "/blog/exemple-devis-maconnerie/", clicks: 0, impressions: 3, position: 40 }, targetPath: null, posts: [] },
      }),
    )
    expect(container.querySelector(".q-banner-warn")).toBeNull()
    expect(container.textContent).toContain("Aucune autre page du site ne vise ce mot-clé.")
  })
})

/* ------------------------------------------------------------------ */
/* PublicationPanel                                                    */
/* ------------------------------------------------------------------ */

function PublicationHarness({ initial, isPublished = false, publishedAt = null }: { initial: PublicationValue; isPublished?: boolean; publishedAt?: string | null }) {
  const [v, setV] = useState(initial)
  return createElement(PublicationPanel, { ...v, onChange: setV, isPublished, publishedAt, slug: "devis-placo", idPrefix: "pub", footer: createElement("button", { type: "button" }, "Enregistrer") })
}

describe("PublicationPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-16T10:00:00.000Z"))
  })

  it("heures de 06:00 à 22:45 ; jour en toutes lettres", () => {
    expect(PUBLISH_TIMES[0]).toBe("06:00")
    expect(PUBLISH_TIMES.at(-1)).toBe("22:45")
    expect(PUBLISH_TIMES).toHaveLength(68)
    expect(longDay("2026-10-22")).toBe("jeudi 22 octobre 2026")
    expect(longDay("2026-10-01")).toBe("jeudi 1er octobre 2026")
  })

  it("brouillon, puis programmé : jour par défaut demain, phrase de confirmation", async () => {
    await render(createElement(PublicationHarness, { initial: { mode: "draft", day: "", time: "08:00" } }))
    expect(container.textContent).toContain("Visible seulement ici.")
    const seg = container.querySelector('[role="group"]') as HTMLElement
    expect(buttonByText("Brouillon", seg).getAttribute("aria-pressed")).toBe("true")
    await click(buttonByText("Programmé", seg))
    expect((document.getElementById("pub-jour") as HTMLInputElement).value).toBe("2026-10-17")
    expect((document.getElementById("pub-jour") as HTMLInputElement).min).toBe("2026-10-16")
    expect(container.textContent).toContain("Sera publié le samedi 17 octobre 2026 à 08:00 (heure de Paris).")
    expect(container.textContent).toContain("Enregistrer")
  })

  it("programmé dans le passé : message d'erreur", async () => {
    await render(createElement(PublicationHarness, { initial: { mode: "schedule", day: "2026-10-16", time: "08:00" } }))
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("à venir")
  })

  it("publier : le contrôle est annoncé pour tout article, écrit à la main compris", async () => {
    await render(createElement(PublicationHarness, { initial: { mode: "publish", day: "", time: "08:00" } }))
    expect(container.textContent).toContain("Sera publié dès l'enregistrement.")
    expect(container.textContent).toContain("Le contrôle relit d'abord le texte")
    expect(container.textContent).not.toContain("Relisez d'abord la liste de contrôle")
  })

  it("champ en cause signalé : heure passée, jour manquant", async () => {
    await render(createElement(PublicationHarness, { initial: { mode: "schedule", day: "2026-10-16", time: "08:00" } }))
    expect(document.getElementById("pub-heure")?.getAttribute("aria-invalid")).toBe("true")
    // Autre clé : nouvel état (useState ne relit pas `initial`)
    await render(createElement(PublicationHarness, { key: "sans-jour", initial: { mode: "schedule", day: "", time: "08:00" } }))
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Choisissez le jour")
    expect(document.getElementById("pub-jour")?.getAttribute("aria-invalid")).toBe("true")
    expect(document.getElementById("pub-heure")?.hasAttribute("aria-invalid")).toBe(false)
  })

  it("publié : en ligne depuis, lien vers l'article ; le repasser en brouillon prévient", async () => {
    await render(createElement(PublicationHarness, { initial: { mode: "publish", day: "", time: "08:00" }, isPublished: true, publishedAt: "2026-10-07T19:19:00.000Z" }))
    expect(container.textContent).toContain("En ligne depuis le mercredi 7 octobre 2026 à 21:19.")
    expect((container.querySelector('a[href="/blog/devis-placo"]') as HTMLAnchorElement).target).toBe("_blank")
    await click(buttonByText("Brouillon", container.querySelector('[role="group"]')!))
    expect(container.textContent).toContain("L'article quittera le blog à l'enregistrement.")
  })
})

/* ------------------------------------------------------------------ */
/* SeoScore                                                            */
/* ------------------------------------------------------------------ */

describe("SeoScore", () => {
  it("anneau, appréciation, groupes, points validés repliés, clic vers le champ", async () => {
    const result = analyzeOnPage({
      title: "Exemple de devis de maçonnerie",
      seoTitle: "",
      seoDescription: "",
      slug: "exemple-devis-maconnerie",
      excerpt: "",
      content: "## Les lignes\n\nUn texte sur le devis de maçonnerie et la franchise à 36 800 € pour les services.",
      keyword: "exemple devis maçonnerie",
      coverUrl: null,
      coverAlt: null,
    })
    const targets: OnPageTarget[] = []
    await render(createElement(SeoScore, { result, onFocusTarget: (t: OnPageTarget) => targets.push(t) }))
    const ring = container.querySelector('[role="img"]') as HTMLElement
    expect(ring.getAttribute("aria-label")).toContain(`${result.score} sur 100`)
    expect(scoreLabel(result.score)).toBe("Insuffisant")
    expect(container.textContent).toContain("Un passage bloque la publication")
    expect(container.textContent).toContain("Bloque la publication")
    expect(container.textContent).toContain("À corriger")
    // Points validés repliés
    const toggle = buttonByText(/points? validés?/, container)
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
    const before = container.querySelectorAll("li").length
    await click(toggle)
    expect(container.querySelectorAll("li").length).toBeGreaterThan(before)
    await click(buttonByText("Description Google", container))
    expect(targets).toEqual(["seoDescription"])
  })

  it("appréciations", () => {
    expect(scoreLabel(85)).toBe("Bon")
    expect(scoreLabel(60)).toBe("À améliorer")
    expect(scoreLabel(20)).toBe("Insuffisant")
  })
})

/* ------------------------------------------------------------------ */
/* Propositions                                                        */
/* ------------------------------------------------------------------ */

function SuggestHarness({ disabledReason = null, onUse }: { disabledReason?: string | null; onUse: (t: string) => void }) {
  const getRequest = (): Omit<SuggestRequest, "field"> => ({ keyword: "devis placo", title: "Devis de placo", content: "x".repeat(20_000) })
  const s = useSuggest({ field: "seoTitle", getRequest, onUse, disabledReason })
  return createElement("div", null, createElement(SuggestButton, { suggest: s }), createElement(SuggestionList, { suggest: s }))
}

describe("Propositions", () => {
  it("sans mot-clé : explique ce qui manque, sans appel", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    await render(createElement(SuggestHarness, { disabledReason: "Choisissez d'abord le mot-clé principal.", onUse: () => {} }))
    await click(buttonByText("Proposer", container))
    expect(container.textContent).toContain("Choisissez d'abord le mot-clé principal.")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("trois cartes, « Utiliser » reprend le texte et rend le focus au bouton", async () => {
    const used: string[] = []
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          suggestions: [
            { text: "Devis de placo : les lignes à prévoir pour vos cloisons", length: 55, hasKeyword: true },
            { text: "Placo : rédiger un devis clair", length: 30, hasKeyword: false },
          ],
          rejected: 1,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)
    await render(createElement(SuggestHarness, { onUse: (t: string) => used.push(t) }))
    const trigger = buttonByText("Proposer", container)
    await click(trigger)
    await flush()
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.field).toBe("seoTitle")
    expect(body.content).toHaveLength(12_000)
    expect(container.querySelectorAll("li")).toHaveLength(2)
    expect(container.textContent).toContain("55 car.")
    expect(container.textContent).toContain("Sans le mot-clé")
    await click(buttonByText("Utiliser", container))
    await flush()
    expect(used).toEqual(["Devis de placo : les lignes à prévoir pour vos cloisons"])
    expect(container.querySelector("li")).toBeNull()
    expect(document.activeElement?.textContent).toContain("Proposer")
  })

  it("« Autres propositions » : le focus reste dans le panneau, puis va à la nouvelle première proposition", async () => {
    const batches = [
      [{ text: "Devis de placo : les lignes à prévoir pour vos cloisons", length: 55, hasKeyword: true }],
      [
        { text: "Devis de placo : les lignes à prévoir pour vos cloisons", length: 55, hasKeyword: true },
        { text: "Devis de placo pour une cloison : exemple commenté", length: 50, hasKeyword: true },
      ],
    ]
    let call = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ suggestions: batches[Math.min(call++, 1)], rejected: 0 }), { status: 200 })),
    )
    await render(createElement(SuggestHarness, { onUse: () => {} }))
    await click(buttonByText("Proposer", container))
    await flush()
    const more = buttonByText("Autres propositions", container)
    await act(async () => more.focus())
    await click(more)
    await flush()
    // Déjà vue : écartée tant qu'il y a du nouveau
    expect(Array.from(container.querySelectorAll("li")).map((li) => li.querySelector("p")?.textContent)).toEqual(["Devis de placo pour une cloison : exemple commenté"])
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Utiliser : Devis de placo pour une cloison : exemple commenté")
  })

  it("erreur du serveur affichée, « Réessayer »", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "Les propositions ne sont pas configurées : clé absente." }), { status: 503 }))
    vi.stubGlobal("fetch", fetchMock)
    await render(createElement(SuggestHarness, { onUse: () => {} }))
    await click(buttonByText("Proposer", container))
    await flush()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("pas configurées")
    await click(buttonByText("Réessayer", container))
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

/* ------------------------------------------------------------------ */
/* Aperçu Google, compteur                                             */
/* ------------------------------------------------------------------ */

describe("SerpPreview et CharMeter", () => {
  it("titre avec « | Qonforme » (jamais en double), date, adresse", async () => {
    expect(serpTitle("Devis de placo")).toBe("Devis de placo | Qonforme")
    expect(serpTitle("Devis de placo | Qonforme")).toBe("Devis de placo | Qonforme")
    expect(serpDate("2026-10-16")).toBe("16 oct. 2026")
    await render(createElement(SerpPreview, { title: "Devis de placo", description: "Une description.", slug: "devis-placo", date: "2026-10-16" }))
    expect(container.textContent).toContain("https://qonforme.fr › blog › devis-placo")
    expect(container.querySelector("h3")?.textContent).toBe("Devis de placo | Qonforme")
    expect(container.textContent).toContain("16 oct. 2026 — Une description.")
    // Colonne étroite (largeur mesurée nulle ici) : téléphone par défaut
    expect(buttonByText("Téléphone", container).getAttribute("aria-pressed")).toBe("true")
    await click(buttonByText("Ordinateur", container))
    expect(buttonByText("Ordinateur", container).getAttribute("aria-pressed")).toBe("true")
    await render(createElement(SerpPreview, { title: "Devis de placo", description: "Une description.", slug: "devis-placo", defaultDevice: "desktop" }))
    expect(buttonByText("Ordinateur", container).getAttribute("aria-pressed")).toBe("true")
  })

  it("description vide : Google choisit", async () => {
    await render(createElement(SerpPreview, { title: "", description: "", slug: "" }))
    expect(container.textContent).toContain("Google choisit lui-même un passage")
    expect(container.textContent).toContain("Titre de l'article")
  })

  it("couleur du compteur", async () => {
    expect(charTone(0, 45, 60, 70)).toBe("neutral")
    expect(charTone(30, 45, 60, 70)).toBe("warn")
    expect(charTone(52, 45, 60, 70)).toBe("ok")
    expect(charTone(65, 45, 60, 70)).toBe("warn")
    expect(charTone(71, 45, 60, 70)).toBe("danger")
    await render(createElement(CharMeter, { length: 52, idealMin: 45, idealMax: 60, max: 70, id: "compteur" }))
    expect(container.textContent).toContain("52 / 60")
    expect(document.getElementById("compteur")?.textContent).toBe("52 caractères, 45 à 60 conseillés.")
  })
})

/* ------------------------------------------------------------------ */
/* Mots-clés secondaires                                               */
/* ------------------------------------------------------------------ */

describe("SecondaryKeywords", () => {
  function Harness() {
    const [hl, setHl] = useState<string[]>([])
    return createElement(SecondaryKeywords, {
      keyword: "exemple devis placo",
      keywords: [kw("devis placo", { volume: 110 }), kw("prix plaquiste", { volume: 90 }), kw("tarif pose placo", { volume: 50, fromPlan: true })],
      pageQueries: [{ query: "placo prix m2", clicks: 0, impressions: 14, position: 20 }],
      title: "Exemple de devis placo",
      content: "Un **devis placo** clair. Le devis de placo détaille la pose.",
      highlighted: hl,
      onHighlightChange: setHl,
    })
  }

  it("présence dans le texte, surlignage, copie", async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
    await render(createElement(Harness))
    const rows = Array.from(container.querySelectorAll("li"))
    expect(rows.map((r) => r.querySelector("span span")?.textContent)).toEqual(["devis placo", "tarif pose placo", "placo prix m2"])
    expect(rows[0].textContent).toContain("3 fois")
    expect(rows[1].textContent).toContain("Absent")
    expect(rows[2].textContent).toContain("14 impressions de l'article")
    const eye = rows[1].querySelector('button[aria-pressed]') as HTMLButtonElement
    await click(eye)
    expect((container.querySelectorAll("li")[1].querySelector("button[aria-pressed]") as HTMLButtonElement).getAttribute("aria-pressed")).toBe("true")
    await click(rows[0].querySelector('button[aria-label^="Copier"]') as HTMLButtonElement)
    expect(writeText).toHaveBeenCalledWith("devis placo")
    expect(mocks.toasts).toContain("Mot-clé copié")
  })

  it("sans mot-clé principal : invite à le choisir", async () => {
    await render(createElement(SecondaryKeywords, { keyword: null, keywords: [], pageQueries: [], title: "", content: "", highlighted: [], onHighlightChange: () => {} }))
    expect(container.textContent).toContain("Choisissez d'abord le mot-clé principal")
  })
})

/* ------------------------------------------------------------------ */
/* Carte du plan mots-clés                                             */
/* ------------------------------------------------------------------ */

describe("PlanImportCard", () => {
  it("aperçu de trois mots-clés, ajout, puis rechargement de la page", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ added: 5, updated: 1, total: 21 }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const missing = [
      { keyword: "logiciel devis facture bâtiment", volume: 880, targetPath: "/" },
      { keyword: "exemple devis auto entrepreneur", volume: 480, targetPath: null },
      { keyword: "devis vierge pdf", volume: 170, targetPath: null },
      { keyword: "logiciel plombier", volume: 260, targetPath: null },
      { keyword: "devis carrelage", volume: 10, targetPath: null },
    ]
    await render(createElement(PlanImportCard, { missing, total: 21 }))
    expect(container.textContent).toContain("Plan mots-clés du 16 octobre")
    expect(container.textContent).toContain("21 mots-clés, dont 5 pas encore suivis")
    expect(container.querySelectorAll("li")).toHaveLength(4)
    expect(container.textContent).toContain("et 2 autres")
    await click(buttonByText("Ajouter au suivi", container))
    await flush()
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[0]).toBe("/api/admin/seo/keywords/plan")
    expect(mocks.toasts).toContain("5 mots-clés ajoutés au suivi, 1 complété.")
    expect(mocks.refresh).toHaveBeenCalled()
  })

  it("rien à ajouter : aucune carte", async () => {
    await render(createElement(PlanImportCard, { missing: [], total: 21 }))
    expect(container.innerHTML).toBe("")
  })
})

/* ------------------------------------------------------------------ */
/* useSeoContext                                                       */
/* ------------------------------------------------------------------ */

describe("useSeoContext", () => {
  const CTX: SeoContext = { keywords: [], pageQueries: [], gsc: { connected: false, lastDate: null }, others: [], keywordPages: null, competitors: [], prefs: { lengthMin: 1500, lengthMax: 2500, publishTime: "08:00" } }

  it("adresse de la route", () => {
    expect(seoContextUrl(null, null)).toBe("/api/admin/blog/seo-context")
    expect(seoContextUrl("abc", " Devis  Placo ")).toBe("/api/admin/blog/seo-context?id=abc&keyword=devis+placo")
  })

  it("premier chargement immédiat, puis 400 ms après un changement de mot-clé, appel précédent annulé", async () => {
    const calls: { url: string; signal: AbortSignal }[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, signal: init.signal as AbortSignal })
        return new Response(JSON.stringify(CTX), { status: 200 })
      }),
    )
    let state: ReturnType<typeof useSeoContext> | null = null
    function Probe({ keyword }: { keyword: string }) {
      state = useSeoContext({ id: "post-1", keyword })
      return null
    }
    await render(createElement(Probe, { keyword: "devis" }))
    await flush()
    expect(calls).toHaveLength(1)
    expect(state!.data).toEqual(CTX)
    expect(state!.loading).toBe(false)

    await render(createElement(Probe, { keyword: "devis p" }))
    await render(createElement(Probe, { keyword: "devis placo" }))
    await flush()
    expect(calls).toHaveLength(1)
    await act(async () => new Promise((r) => setTimeout(r, 450)))
    expect(calls).toHaveLength(2)
    expect(calls[1].url).toContain("keyword=devis+placo")
    // Changement de mot-clé : seules les pages du mot-clé sont relues, le reste du contexte est gardé
    expect(calls[1].url).toContain("only=keyword")
    expect(state!.data).toEqual(CTX)

    await act(async () => state!.reload())
    await flush()
    expect(calls).toHaveLength(3)
  })

  it("changement de mot-clé : keywordPages fusionné dans le contexte déjà lu", async () => {
    const pages: KeywordPages = { keyword: "devis placo", topPage: null, targetPath: "/modele/devis-placo", posts: [] }
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => new Response(JSON.stringify(url.includes("only=keyword") ? { keywordPages: pages } : { ...CTX, others: [{ id: "a", title: "A", slug: "a", targetKeyword: null, seoTitle: null }] }), { status: 200 })),
    )
    let state: ReturnType<typeof useSeoContext> | null = null
    function Probe({ keyword }: { keyword: string }) {
      state = useSeoContext({ id: "post-1", keyword })
      return null
    }
    await render(createElement(Probe, { keyword: "devis" }))
    await flush()
    await render(createElement(Probe, { keyword: "devis placo" }))
    await act(async () => new Promise((r) => setTimeout(r, 450)))
    expect(state!.data?.keywordPages).toEqual(pages)
    expect(state!.data?.others).toHaveLength(1)
  })

  it("erreur : message gardé, données précédentes conservées", async () => {
    let fail = false
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => (fail ? new Response(JSON.stringify({ error: "Lecture impossible pour le moment." }), { status: 503 }) : new Response(JSON.stringify(CTX), { status: 200 }))),
    )
    let state: ReturnType<typeof useSeoContext> | null = null
    function Probe() {
      state = useSeoContext({ id: null, keyword: null })
      return null
    }
    await render(createElement(Probe))
    await flush()
    fail = true
    await act(async () => state!.reload())
    await flush()
    expect(state!.error).toBe("Lecture impossible pour le moment.")
    expect(state!.data).toEqual(CTX)
  })
})
