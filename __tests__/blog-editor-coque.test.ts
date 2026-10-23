// @vitest-environment happy-dom
/**
 * Coque de l'éditeur d'articles montée pour de vrai (components/admin/BlogEditor.tsx),
 * réseau simulé : un seul article créé même si Ctrl+S arrive juste après la
 * réponse (avant le rendu suivant), un seul envoi à la fois, et l'envoi
 * relancé à la fin avec ce qui a été tapé entre-temps.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { BlogEditor as BlogEditorType } from "@/components/admin/BlogEditor"
import type { offerCreationHandoff as OfferType } from "@/components/admin/blog/shell/hooks"

;(globalThis as unknown as { React: typeof React }).React = React
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// vi.mock est remonté avant les imports : le routeur simulé est créé avec vi.hoisted
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/admin/blog/new", useSearchParams: () => new URLSearchParams() }))
vi.mock("sonner", () => {
  const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() })
  return { toast }
})

// Import après la mise en place de React global (JSX des modules compilé en JSX classique)
let BlogEditor: typeof BlogEditorType
let offerCreationHandoff: typeof OfferType
beforeAll(async () => {
  ;({ BlogEditor } = await import("@/components/admin/BlogEditor"))
  ;({ offerCreationHandoff } = await import("@/components/admin/blog/shell/hooks"))
})

const ID = "33333333-3333-4333-8333-333333333333"
const SEO_CONTEXT = {
  keywords: [],
  pageQueries: [],
  gsc: { connected: false, lastDate: null },
  others: [],
  keywordPages: null,
  competitors: [],
  prefs: { lengthMin: 1500, lengthMax: 2500, publishTime: "08:00" },
}

/** Contexte servi à l'éditeur (un test peut y mettre des mots-clés suivis). */
let seoContext: Omit<typeof SEO_CONTEXT, "keywords"> & { keywords: unknown[] } = SEO_CONTEXT

type Call = { method: string; url: string; body: Record<string, unknown> }
let calls: Call[] = []
let pending: ((res: Response) => void)[] = []
let root: Root | null = null
let host: HTMLDivElement | null = null

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

beforeEach(() => {
  calls = []
  pending = []
  seoContext = SEO_CONTEXT
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.startsWith("/api/admin/blog/seo-context")) return Promise.resolve(json(200, seoContext))
      const method = init?.method ?? "GET"
      calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : {} })
      // Réponse rendue à la main : le test choisit l'instant
      return new Promise<Response>((resolve) => pending.push(resolve))
    }),
  )
})

afterEach(async () => {
  await act(async () => root?.unmount())
  host?.remove()
  root = null
  host = null
  localStorage.clear()
  offerCreationHandoff(null)
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const wait = (ms: number) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)))
const ctrlS = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true }))

async function mount(props: React.ComponentProps<typeof BlogEditorType>) {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => root!.render(React.createElement(BlogEditor, props)))
  await wait(50)
}

function setField(id: string, value: string) {
  const el = document.getElementById(id) as HTMLTextAreaElement | HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")!.set!
  setter.call(el, value)
  el.dispatchEvent(new Event("input", { bubbles: true }))
}

describe("coque de l'éditeur : enregistrements", () => {
  it("crée un seul article : Ctrl+S juste après la réponse, avant le rendu suivant, part en modification", async () => {
    await mount({ mode: "create", publishTime: "08:00", renderedAt: "2026-10-16T08:00:00.000Z" })
    await act(async () => setField("blog-title", "Relance de facture impayée"))
    // Texte : la zone d'écriture visuelle n'est pas simple à remplir ici, le mode Markdown l'est
    let markdownButton: HTMLButtonElement | null = null
    for (let i = 0; i < 100 && !markdownButton; i++) {
      await wait(20)
      markdownButton = document.querySelector<HTMLButtonElement>("button[title^='Mode Markdown']")
    }
    expect(markdownButton).toBeTruthy()
    await act(async () => markdownButton!.click())
    await wait(20)
    await act(async () => setField("q-editor-markdown", "Un premier paragraphe."))

    await act(async () => ctrlS())
    expect(calls.map((c) => c.method)).toEqual(["POST"])
    // Second Ctrl+S pendant l'envoi : aucun second envoi tout de suite
    await act(async () => ctrlS())
    expect(calls.length).toBe(1)

    // Réponse, puis Ctrl+S avant que React ait rendu (hors act : aucun rendu forcé)
    pending.shift()!(json(201, { success: true, id: ID, slug: "relance-de-facture-impayee" }))
    for (let i = 0; i < 20; i++) await Promise.resolve()
    ctrlS()
    await wait(30)
    expect(calls.filter((c) => c.method === "POST").length).toBe(1)
    expect(router.replace).toHaveBeenCalledWith(`/admin/blog/${ID}`)
  })

  it("après la création, la page de l'article reprend le texte tapé pendant l'envoi, sans proposer de copie", async () => {
    await mount({ mode: "create", publishTime: "08:00", renderedAt: "2026-10-16T08:00:00.000Z" })
    await act(async () => setField("blog-title", "Relance de facture impayée"))
    let markdownButton: HTMLButtonElement | null = null
    for (let i = 0; i < 100 && !markdownButton; i++) {
      await wait(20)
      markdownButton = document.querySelector<HTMLButtonElement>("button[title^='Mode Markdown']")
    }
    await act(async () => markdownButton!.click())
    await act(async () => setField("q-editor-markdown", "Un premier paragraphe."))
    await act(async () => ctrlS())
    // Frappe pendant l'envoi
    await act(async () => setField("blog-excerpt", "Trois modèles de mails."))
    await act(async () => pending.shift()!(json(201, { success: true, id: ID, slug: "relance-de-facture-impayee" })))
    await wait(20)
    expect(router.replace).toHaveBeenCalledWith(`/admin/blog/${ID}`)

    // Changement de page : l'éditeur de /admin/blog/new disparaît, celui de l'article apparaît
    const created = {
      id: ID,
      slug: "relance-de-facture-impayee",
      title: "Relance de facture impayée",
      excerpt: null,
      content: "Un premier paragraphe.",
      is_published: false,
      updated_at: "2026-10-16T08:00:01.000Z",
    }
    await act(async () => root!.render(React.createElement("div")))
    await act(async () => root!.render(React.createElement(BlogEditor, { mode: "edit", post: created, publishTime: "08:00", renderedAt: "2026-10-16T08:00:02.000Z" })))
    await wait(50)
    expect((document.getElementById("blog-excerpt") as HTMLTextAreaElement).value).toBe("Trois modèles de mails.")
    expect(document.body.textContent).toContain("Modifications non enregistrées")
    expect(document.body.textContent).not.toContain("Une version plus récente est restée sur cet appareil")
    // Même mode d'écriture qu'avant le changement de page (Markdown ici)
    for (let i = 0; i < 100 && !document.getElementById("q-editor-markdown"); i++) await wait(20)
    expect(document.querySelector(".q-editor")?.getAttribute("data-mode")).toBe("markdown")
    expect((document.getElementById("q-editor-markdown") as HTMLTextAreaElement).value).toBe("Un premier paragraphe.")

    // Enregistrer : seulement ce qui manque à la base
    await act(async () => ctrlS())
    expect(calls.at(-1)).toMatchObject({ method: "PATCH", url: `/api/admin/blog/${ID}`, body: { excerpt: "Trois modèles de mails." } })
  })

  it("ne reprend rien si l'article a changé dans la base entre-temps", async () => {
    offerCreationHandoff({
      id: ID,
      saved: { title: "Ancien", slug: "ancien", excerpt: "", content: "Ancien.", coverUrl: "", coverAlt: "", seoTitle: "", seoDescription: "", keyword: null, publication: { mode: "draft", day: "2026-10-17", time: "08:00" } },
      latest: () => ({ title: "Ancien", slug: "ancien", excerpt: "Tapé", content: "Ancien.", coverUrl: "", coverAlt: "", seoTitle: "", seoDescription: "", keyword: null, publication: { mode: "draft", day: "2026-10-17", time: "08:00" } }),
      tab: "redaction",
      highlighted: [],
      lastSaveAt: "2026-10-16T08:00:00.000Z",
      fromCalendar: false,
      editorMode: "visual",
      view: null,
      at: Date.now(),
    })
    await mount({ mode: "edit", post: { id: ID, slug: "nouveau-texte", title: "Nouveau texte", content: "Écrit ailleurs.", is_published: false }, publishTime: "08:00" })
    expect((document.getElementById("blog-title") as HTMLTextAreaElement).value).toBe("Nouveau texte")
    expect((document.getElementById("blog-excerpt") as HTMLTextAreaElement).value).toBe("")
  })

  it("relance l'enregistrement à la fin d'un envoi, avec seulement ce qui a été tapé entre-temps", async () => {
    const post = {
      id: ID,
      slug: "relance-facture",
      title: "Relance de facture",
      excerpt: "Un chapeau.",
      content: "Un texte.",
      is_published: false,
      updated_at: "2026-10-15T08:00:00.000Z",
    }
    await mount({ mode: "edit", post, publishTime: "08:00", renderedAt: "2026-10-16T08:00:00.000Z" })
    await act(async () => setField("blog-title", "Relance de facture impayée"))
    await act(async () => ctrlS())
    expect(calls).toHaveLength(1)
    expect(calls[0].body).toEqual({ title: "Relance de facture impayée" })

    await act(async () => setField("blog-excerpt", "Un chapeau plus précis."))
    await act(async () => ctrlS())
    expect(calls).toHaveLength(1)

    await act(async () => pending.shift()!(json(200, { success: true })))
    await wait(30)
    expect(calls).toHaveLength(2)
    expect(calls[1].body).toEqual({ excerpt: "Un chapeau plus précis." })
    await act(async () => pending.shift()!(json(200, { success: true })))
    await wait(30)
    // Plus rien à envoyer : pas de troisième requête
    expect(calls).toHaveLength(2)
  })

  it("garde une copie sur l'appareil quand l'envoi échoue", async () => {
    const post = { id: ID, slug: "relance-facture", title: "Relance de facture", content: "Un texte.", is_published: false, updated_at: "2026-10-15T08:00:00.000Z" }
    await mount({ mode: "edit", post, publishTime: "08:00", renderedAt: "2026-10-16T08:00:00.000Z" })
    await act(async () => setField("blog-title", "Relance de facture impayée"))
    await act(async () => ctrlS())
    await act(async () => pending.shift()!(json(503, { error: "Base injoignable" })))
    await wait(20)
    expect(localStorage.getItem(`q-blog-editor:${ID}`)).toContain("Relance de facture impayée")
  })
})

describe("coque de l'éditeur : passages refusés par le contrôle", () => {
  const OFFENDING = "Pour rédiger vos [conditions](/outils/generateur-conditions-paiement) sans rien oublier, un générateur gratuit est disponible."
  const post = {
    id: ID,
    slug: "relance-facture",
    title: "Relance de facture",
    content: `Une introduction.\n\n## Règles de paiement\n\n${OFFENDING}\n\nUne fin.`,
    is_published: false,
    updated_at: "2026-10-15T08:00:00.000Z",
  }
  const issue = {
    label: "Affirmation interdite (contrôle factuel)",
    excerpt: OFFENDING,
    detail: "Un générateur de conditions de paiement ne fait pas partie des outils gratuits listés. À écrire : renvoyer vers le générateur de devis.",
  }

  async function openRefusal() {
    await mount({ mode: "edit", post, publishTime: "08:00", renderedAt: "2026-10-16T08:00:00.000Z" })
    for (let i = 0; i < 100 && !document.querySelector(".ProseMirror"); i++) await wait(20)
    await act(async () => setField("blog-excerpt", "Un chapeau."))
    await act(async () => ctrlS())
    await act(async () => pending.shift()!(json(409, { code: "check_failed", error: "Publication refusée", issues: [issue] })))
    await wait(30)
    expect(document.body.textContent).toContain("Publication refusée par le contrôle")
  }
  const pm = () => document.querySelector(".ProseMirror") as HTMLElement & { editor: import("@tiptap/core").Editor }
  const click = (label: string) => {
    const b = Array.from(document.querySelectorAll("button")).find((el) => el.textContent?.trim().startsWith(label))
    if (!b) throw new Error(`Bouton introuvable : ${label}`)
    return act(async () => b.click())
  }

  it("« Aller au passage » sélectionne le passage dans le texte", async () => {
    await openRefusal()
    await click("Aller au passage")
    await wait(60)
    const { from, to } = pm().editor.state.selection
    expect(pm().editor.state.doc.textBetween(from, to)).toBe("Pour rédiger vos conditions sans rien oublier, un générateur gratuit est disponible.")
  })

  it("« Corriger avec l'IA » : proposition à côté de l'extrait, remplacée seulement sur demande, en une étape annulable", async () => {
    await openRefusal()
    await click("Corriger avec l'IA")
    const call = calls.at(-1)!
    expect(call).toMatchObject({ method: "POST", url: "/api/admin/blog/assist" })
    expect(call.body).toMatchObject({
      action: "resolve",
      text: "Pour rédiger vos [conditions](/outils/generateur-conditions-paiement) sans rien oublier, un générateur gratuit est disponible.",
      issue: { label: issue.label, detail: issue.detail },
      excerpt: OFFENDING,
    })
    expect(String(call.body.before)).toContain("Règles de paiement")
    await act(async () =>
      pending.shift()!(json(200, { text: "Pour rédiger vos [conditions](/outils/generateur-conditions-paiement) sans rien oublier, utilisez notre générateur de devis.", warnings: ["Vérifiez : « 1 » n'était pas dans le passage."] })),
    )
    await wait(30)
    expect(document.body.textContent).toContain("Proposition de l'IA")
    expect(document.body.textContent).toContain("utilisez notre générateur de devis.")
    expect(document.body.textContent).toContain("Vérifiez : « 1 » n'était pas dans le passage.")
    // Rien n'est remplacé tant que l'admin ne le demande pas
    expect(pm().textContent).toContain("un générateur gratuit est disponible")

    await click("Remplacer dans le texte")
    await wait(30)
    expect(pm().textContent).toContain("utilisez notre générateur de devis.")
    expect(pm().textContent).not.toContain("un générateur gratuit est disponible")
    expect(pm().querySelector("a")?.getAttribute("href")).toBe("/outils/generateur-conditions-paiement")
    expect(document.body.textContent).toContain("Corrigé")
    await act(async () => {
      pm().editor.commands.undo()
    })
    expect(pm().textContent).toContain("un générateur gratuit est disponible")
  })

  it("passage corrigé à la main : marqué « Corrigé », plus de boutons ; refus de l'IA : message sans rien remplacer", async () => {
    await openRefusal()
    await click("Corriger avec l'IA")
    await act(async () => pending.shift()!(json(503, { error: "L'assistant n'est pas disponible.", code: "not_configured" })))
    await wait(30)
    expect(document.body.textContent).toContain("L'assistant n'est pas disponible.")
    expect(pm().textContent).toContain("un générateur gratuit est disponible")

    // Corrigé à la main dans l'éditeur
    await act(async () => {
      const ed = pm().editor
      let from = -1
      ed.state.doc.descendants((node, pos) => {
        if (from < 0 && node.isText && node.text?.includes("un générateur gratuit est disponible")) from = pos + (node.text.indexOf("un générateur gratuit est disponible") ?? 0)
      })
      ed.commands.insertContentAt({ from, to: from + "un générateur gratuit est disponible".length }, "un modèle à télécharger est disponible")
    })
    await wait(30)
    expect(document.body.textContent).toContain("Corrigé")
    expect(Array.from(document.querySelectorAll("button")).some((b) => b.textContent?.includes("Aller au passage"))).toBe(false)
  })
})


describe("coque de l'éditeur : mot-clé à placer dans le texte avec l'IA", () => {
  const PARAGRAPH =
    "L'acompte se calcule sur le montant du devis accepté par le client avant le début des travaux, et il figure ensuite sur la facture finale avec la mention de son versement."
  const post = {
    id: ID,
    slug: "facturer-un-chantier",
    title: "Facturer un chantier",
    target_keyword: "facture plomberie",
    content: `Une introduction sur la facturation d'un chantier de rénovation pour les artisans du bâtiment.\n\n## Les acomptes\n\n${PARAGRAPH}\n\nUne fin.`,
    is_published: false,
    updated_at: "2026-10-15T08:00:00.000Z",
  }
  const keyword = (k: string) => ({ id: null, keyword: k, status: null, intent: null, volume: 90, difficulty: null, position: null, clicks: null, impressions: null, targetPath: null, fromPlan: true })

  async function open() {
    seoContext = { ...SEO_CONTEXT, keywords: [keyword("acompte plomberie")] }
    await mount({ mode: "edit", post, publishTime: "08:00", renderedAt: "2026-10-16T08:00:00.000Z" })
    for (let i = 0; i < 100 && !document.querySelector(".ProseMirror"); i++) await wait(20)
    await wait(40)
  }
  const pm = () => document.querySelector(".ProseMirror") as HTMLElement & { editor: import("@tiptap/core").Editor }
  const press = (label: string) => {
    const b = Array.from(document.querySelectorAll("button")).find((el) => el.textContent?.trim().startsWith(label) || el.getAttribute("aria-label")?.startsWith(label))
    if (!b) throw new Error(`Bouton introuvable : ${label}`)
    return act(async () => b.click())
  }
  const has = (label: string) => Array.from(document.querySelectorAll("button")).some((el) => el.textContent?.trim().startsWith(label) || el.getAttribute("aria-label")?.startsWith(label))

  it("un mot-clé secondaire absent du texte : proposition avant / après, remplacée seulement sur demande, en une étape annulable", async () => {
    await open()
    await press("Intégrer « acompte plomberie » dans le texte avec l'IA")
    const call = calls.at(-1)!
    expect(call).toMatchObject({ method: "POST", url: "/api/admin/blog/integrate-keyword" })
    expect(call.body).toMatchObject({ mode: "secondary", keyword: "acompte plomberie", mainKeyword: "facture plomberie", title: "Facturer un chantier" })
    expect(String(call.body.markdown)).toContain("## Les acomptes")

    const after = PARAGRAPH.replace("L'acompte se calcule", "L'acompte de plomberie se calcule")
    await act(async () => pending.shift()!(json(200, { proposals: [{ id: "1", kind: "paragraph", section: "Les acomptes", before: PARAGRAPH, after, warnings: ["Vérifiez : « 7 » n'était pas dans le passage."] }], note: null })))
    await wait(30)
    expect(document.body.textContent).toContain("Intégrer « acompte plomberie » dans le texte")
    expect(document.body.textContent).toContain("Les acomptes")
    expect(document.body.textContent).toContain("Vérifiez : « 7 » n'était pas dans le passage.")
    // Rien n'est remplacé tant que l'admin ne le demande pas
    expect(pm().textContent).not.toContain("acompte de plomberie")

    await press("Appliquer la modification")
    await wait(30)
    expect(pm().textContent).toContain("L'acompte de plomberie se calcule")
    await act(async () => {
      pm().editor.commands.undo()
    })
    expect(pm().textContent).not.toContain("acompte de plomberie")
  })

  it("passage décoché : rien n'est remplacé ; réponse sans proposition : la raison est donnée", async () => {
    await open()
    await press("Intégrer « acompte plomberie » dans le texte avec l'IA")
    await act(async () =>
      pending.shift()!(json(200, { proposals: [{ id: "1", kind: "paragraph", section: "Les acomptes", before: PARAGRAPH, after: PARAGRAPH.replace("L'acompte", "L'acompte plomberie"), warnings: [] }], note: null })),
    )
    await wait(30)
    const box = document.querySelector<HTMLInputElement>("input[type='checkbox']")!
    await act(async () => box.click())
    expect(Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Appliquer"))?.hasAttribute("disabled")).toBe(true)

    await press("Autres passages")
    expect(calls.at(-1)!.body.avoid).toEqual([PARAGRAPH])
    await act(async () => pending.shift()!(json(200, { proposals: [], note: "Aucun passage du développement ne peut recevoir ce mot-clé." })))
    await wait(30)
    expect(document.body.textContent).toContain("Aucun passage du développement ne peut recevoir ce mot-clé.")
    expect(pm().textContent).not.toContain("acompte plomberie")
  })

  it("liste de contrôle : boutons IA pour le mot-clé de l'introduction et du sous-titre", async () => {
    await open()
    expect(has("Mettre le mot-clé dans l'introduction")).toBe(true)
    expect(has("Mettre le mot-clé dans un sous-titre")).toBe(true)
    expect(has("Proposer un titre avec le mot-clé")).toBe(true)
    await press("Mettre le mot-clé dans un sous-titre")
    expect(calls.at(-1)).toMatchObject({ url: "/api/admin/blog/integrate-keyword", body: { mode: "heading", keyword: "facture plomberie" } })
    await act(async () =>
      pending.shift()!(json(200, { proposals: [{ id: "1", kind: "heading", section: "Sous-titre", before: "Les acomptes", after: "Acompte et facture plomberie", warnings: [] }], note: null })),
    )
    await wait(30)
    await press("Appliquer la modification")
    await wait(30)
    expect(Array.from(pm().querySelectorAll("h2")).map((h) => h.textContent)).toEqual(["Acompte et facture plomberie"])
  })

  it("sans mot-clé principal : aucun bouton IA dans la liste de contrôle", async () => {
    seoContext = SEO_CONTEXT
    await mount({ mode: "edit", post: { ...post, target_keyword: null }, publishTime: "08:00", renderedAt: "2026-10-16T08:00:00.000Z" })
    await wait(60)
    expect(has("Mettre le mot-clé dans l'introduction")).toBe(false)
    expect(has("Proposer un titre avec le mot-clé")).toBe(false)
  })
})

describe("coque de l'éditeur : Proposition IA, mot-clé principal ou secondaire", () => {
  const post = {
    id: ID,
    slug: "facturer-un-chantier",
    title: "Facturer un chantier",
    target_keyword: "facture plomberie",
    content: "Une introduction.\n\n## Les acomptes\n\nUn paragraphe.",
    is_published: false,
    updated_at: "2026-10-15T08:00:00.000Z",
  }
  const idea = (keyword: string) => ({
    keyword,
    title: `Titre de ${keyword}`,
    articleType: "howto",
    stage: "do",
    why: "—",
    verified: true,
    googleAlso: [],
    volume: 140,
    difficulty: 10,
    cpc: null,
    intent: "informational",
    ranking: null,
    overlaps: [],
    warnings: [],
    tracked: false,
    score: 70,
  })
  const ideasResponse = { ideas: [idea("acompte plomberie"), idea("devis plomberie")], notes: [], model: "Claude Sonnet 5.5", autocomplete: "ok", metrics: "ok" }
  const press = (label: string) => {
    const b = Array.from(document.querySelectorAll("button")).find((el) => el.textContent?.trim().startsWith(label))
    if (!b) throw new Error(`Bouton introuvable : ${label}`)
    return act(async () => b.click())
  }
  const settle = async () => {
    for (let i = 0; i < 5; i++) await wait(10)
  }
  const secondaryCard = () => document.getElementById("carte-secondaires-titre")!.closest("section") as HTMLElement

  async function openIdeas() {
    await mount({ mode: "edit", post, publishTime: "08:00", renderedAt: "2026-10-16T08:00:00.000Z" })
    await settle()
    await press("Proposer un mot-clé plus exact")
    await settle()
    // Recherche des idées, puis réponse
    expect(calls.at(-1)).toMatchObject({ method: "POST", url: "/api/admin/seo/ideas" })
    await act(async () => pending.shift()!(json(200, ideasResponse)))
    await settle()
  }

  it("« Ajouter aux secondaires » : le mot-clé rejoint la liste des secondaires, garde le principal, reste sur l'appareil", async () => {
    await openIdeas()
    await press("Ajouter aux secondaires")
    expect(calls.at(-1)).toMatchObject({ url: "/api/admin/seo/ideas/adopt", body: { keyword: "acompte plomberie", createTopic: false, targeted: false } })
    await act(async () => pending.shift()!(json(201, { keywordId: "k1", keyword: "acompte plomberie", keywordAdded: true, topicId: null, topicExisting: false })))
    await settle()

    const card = secondaryCard()
    expect(card.textContent).toContain("acompte plomberie")
    expect(card.textContent).toContain("Ajouté")
    expect(card.textContent).toContain("Absent")
    // Le mot-clé principal n'a pas bougé
    expect(document.getElementById("blog-keyword") ?? document.body).toBeTruthy()
    expect(document.body.textContent).toContain("facture plomberie")
    expect(JSON.parse(localStorage.getItem(`q-blog-secondary:${ID}`) ?? "[]")).toEqual([{ keyword: "acompte plomberie", volume: 140 }])

    // Retrait
    await act(async () => (document.querySelector("[aria-label^='Retirer « acompte plomberie »']") as HTMLButtonElement).click())
    expect(secondaryCard().textContent).not.toContain("acompte plomberie")
    expect(localStorage.getItem(`q-blog-secondary:${ID}`)).toBeNull()
  })

  it("les secondaires gardés sur l'appareil reviennent à la réouverture, et partent avec les propositions de titre", async () => {
    localStorage.setItem(`q-blog-secondary:${ID}`, JSON.stringify([{ keyword: "devis plomberie", volume: 90 }, { nope: true }, "x"]))
    await mount({ mode: "edit", post, publishTime: "08:00", renderedAt: "2026-10-16T08:00:00.000Z" })
    await settle()
    expect(secondaryCard().textContent).toContain("devis plomberie")
    await press("Proposer un titre avec le mot-clé")
    expect(calls.at(-1)).toMatchObject({ url: "/api/admin/blog/suggest", body: { field: "seoTitle", secondary: ["devis plomberie"] } })
  })
})
