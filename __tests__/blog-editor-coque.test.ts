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
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.startsWith("/api/admin/blog/seo-context")) return Promise.resolve(json(200, SEO_CONTEXT))
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
