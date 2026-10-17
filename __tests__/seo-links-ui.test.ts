// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import * as React from "react"
import { act, createElement, useRef, useState } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { AutoLinksResponse } from "@/lib/seo/articles/editor-types"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let LinksCard: typeof import("@/components/admin/blog/shell/SideCards").LinksCard
let useAutoLinks: typeof import("@/components/admin/blog/seo/useAutoLinks").useAutoLinks

// Le JSX du dépôt est compilé en React.createElement : React global avant le chargement des composants
beforeAll(async () => {
  ;(globalThis as { React?: typeof React }).React = React
  ;({ LinksCard } = await import("@/components/admin/blog/shell/SideCards"))
  ;({ useAutoLinks } = await import("@/components/admin/blog/seo/useAutoLinks"))
})

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  document.body.innerHTML = ""
  vi.unstubAllGlobals()
})

const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)))

function buttonByText(text: string | RegExp): HTMLButtonElement {
  const found = (Array.from(document.querySelectorAll("button")) as HTMLButtonElement[]).find((b) => (typeof text === "string" ? b.textContent?.includes(text) : text.test(b.textContent ?? "")))
  if (!found) throw new Error(`Bouton introuvable : ${text}`)
  return found
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.click()
  })
  await flush()
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

const LONG = `${"Un paragraphe de remplissage pour atteindre la longueur d'un vrai article de blog. ".repeat(60)}\n\nRappelez les mentions obligatoires d'un devis.`

const response = (over: Partial<AutoLinksResponse> = {}): AutoLinksResponse => ({
  before: 0,
  after: 2,
  goal: { min: 3, goal: 5, max: 6 },
  words: 900,
  proposals: [
    { path: "/guide/mentions-obligatoires-devis", title: "Mentions obligatoires d'un devis", kind: "guide", anchor: "mentions obligatoires d'un devis", before: "Rappelez les ", section: 0 },
    { path: "/guide/tva-travaux", title: "TVA des travaux", kind: "guide", anchor: "taux de TVA", before: "le ", section: 1 },
  ],
  markdown: "LIÉ",
  relatedBlock: null,
  ...over,
})

interface Harness {
  applied: string[]
  fetchMock: ReturnType<typeof vi.fn>
}

/** La carte et le hook, comme dans l'éditeur : le texte vit chez le parent. */
function Page({ initial, onApplied, edit }: { initial: string; onApplied: (m: string) => void; edit?: { current: ((m: string) => void) | null } }) {
  const [content, setContent] = useState(initial)
  const contentRef = useRef(content)
  contentRef.current = content
  if (edit) edit.current = (m) => setContent(m)
  const links = useAutoLinks({
    getArticle: () => ({ markdown: contentRef.current, title: "Devis de plomberie", keyword: "devis plomberie", slug: "devis-plomberie" }),
    onApply: (m) => {
      setContent(m)
      onApplied(m)
    },
  })
  return createElement(LinksCard, { content, state: links.state, onRun: () => void links.run(), onUndo: links.undo, onAddRelated: links.addRelatedBlock, onDismiss: links.dismiss })
}

async function render(initial: string, answer: () => Response | Promise<Response>, edit?: { current: ((m: string) => void) | null }): Promise<Harness> {
  const applied: string[] = []
  const fetchMock = vi.fn(async () => answer())
  vi.stubGlobal("fetch", fetchMock)
  await act(async () => root.render(createElement(Page, { initial, onApplied: (m: string) => applied.push(m), edit })))
  await flush()
  return { applied, fetchMock }
}

describe("carte « Maillage interne »", () => {
  it("affiche le nombre de liens, l'objectif de la longueur et un bouton", async () => {
    await render(`${LONG}\n\nVoir [le guide](/guide/x) et [un modèle](/modele/y).`, () => json(response()))
    expect(document.body.textContent).toContain("2 liens internes")
    expect(document.body.textContent).toMatch(/Conseillé : \d+ à \d+/)
    expect(buttonByText("Ajouter les liens internes").disabled).toBe(false)
    expect(document.querySelector('[role="img"]')?.getAttribute("aria-label")).toMatch(/^2 liens internes sur \d+ au plus conseillés$/)
    expect(document.querySelector('[data-focus-target="links"]')).toBeTruthy()
    expect(document.getElementById("blog-links-run")).toBeTruthy()
  })

  it("texte trop court : bouton bloqué, rien n'est demandé", async () => {
    const { fetchMock } = await render("Trois mots seulement.", () => json(response()))
    expect(document.body.textContent).toContain("Texte à écrire")
    expect(buttonByText("Ajouter les liens internes").disabled).toBe(true)
    await click(buttonByText("Ajouter les liens internes"))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("pose les liens : le texte lié est rendu au parent, la liste des liens s'affiche, « Annuler » rend l'ancien texte", async () => {
    const { applied, fetchMock } = await render(LONG, () => json(response()))
    await click(buttonByText("Ajouter les liens internes"))
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/admin/blog/auto-links")
    expect(JSON.parse(init.body as string)).toEqual({ markdown: LONG, title: "Devis de plomberie", keyword: "devis plomberie", slug: "devis-plomberie" })
    expect(applied).toEqual(["LIÉ"])
    const text = document.body.textContent ?? ""
    expect(text).toContain("2 liens ajoutés")
    expect(text).toContain("« mentions obligatoires d'un devis » → vers Mentions obligatoires d'un devis")
    expect(text).toContain("Ctrl+Z revient aussi en arrière.")

    await click(buttonByText("Annuler"))
    expect(applied).toEqual(["LIÉ", LONG])
    expect(document.body.textContent).not.toContain("2 liens ajoutés")
  })

  it("le texte a changé pendant la recherche : rien n'est posé", async () => {
    const edit: { current: ((m: string) => void) | null } = { current: null }
    let release: (r: Response) => void = () => {}
    const { applied } = await render(LONG, () => new Promise<Response>((r) => (release = r)), edit)
    await click(buttonByText("Ajouter les liens internes"))
    expect(buttonByText("Recherche des liens…").disabled).toBe(true)
    await act(async () => edit.current?.(`${LONG} Une phrase de plus.`))
    await act(async () => release(json(response())))
    await flush()
    expect(applied).toEqual([])
    expect(document.querySelector("[role=alert]")?.textContent).toContain("Le texte a changé pendant la recherche")
  })

  it("maillage déjà complet : message, rien n'est posé", async () => {
    const { applied } = await render(LONG, () => json(response({ proposals: [], after: 6, words: 1400, markdown: LONG })))
    await click(buttonByText("Ajouter les liens internes"))
    expect(applied).toEqual([])
    expect(document.body.textContent).toContain("Le maillage est complet : 6 liens internes pour environ 1")
    await click(buttonByText("Fermer"))
    expect(document.body.textContent).not.toContain("Le maillage est complet")
  })

  it("aucune expression à lier : message et bloc « Pour aller plus loin » à ajouter, annulable", async () => {
    const block = "## Pour aller plus loin\n\n- [TVA des travaux](/guide/tva-travaux)"
    const { applied } = await render(LONG, () => json(response({ proposals: [], after: 0, relatedBlock: block, markdown: LONG })))
    await click(buttonByText("Ajouter les liens internes"))
    expect(document.body.textContent).toContain("Aucune expression du texte ne correspond à une page du site")
    await click(buttonByText("Ajouter le bloc « Pour aller plus loin »"))
    expect(applied).toHaveLength(1)
    expect(applied[0]).toBe(`${LONG}\n\n${block}\n`)
    expect(document.body.textContent).toContain("Bloc « Pour aller plus loin » ajouté")
    await click(buttonByText("Annuler"))
    expect(applied[1]).toBe(LONG)
  })

  it("erreur du serveur ou du réseau : message, rien n'est posé", async () => {
    const { applied } = await render(LONG, () => json({ error: "Lecture impossible : les articles du blog." }, 503))
    await click(buttonByText("Ajouter les liens internes"))
    expect(applied).toEqual([])
    expect(document.querySelector("[role=alert]")?.textContent).toContain("Lecture impossible")
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("réseau") }))
    await click(buttonByText("Ajouter les liens internes"))
    expect(document.querySelector("[role=alert]")?.textContent).toContain("Connexion impossible")
  })
})
