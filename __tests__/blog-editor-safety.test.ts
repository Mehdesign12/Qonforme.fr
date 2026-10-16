// @vitest-environment happy-dom
/**
 * Sûreté de l'éditeur d'articles (relecture adverse) : rien de tapé ne se
 * perd, rien n'est réécrit à l'ouverture.
 *
 * - Copie de l'appareil (useLocalDraft) : écrite au démontage (bouton Retour
 *   du navigateur, avant les 2 s), sous la clé de l'article une fois créé
 *   (jamais une copie « nouveau » d'un article déjà créé), plus proposée
 *   après un enregistrement, plus écrite après une suppression, pas proposée
 *   quand elle est déjà à l'écran.
 * - Relais après la création (/admin/blog/new → /admin/blog/<id>) : texte du
 *   moment, durée de validité, vue relevée puis rendue (défilement, champ et
 *   sélection).
 * - Zone d'écriture : sélection relue et rendue ; ouvrir un article qui finit
 *   par une liste, un tableau, une image ou un titre, avec des mots-clés
 *   surlignés, n'appelle jamais onChange (paragraphe final ajouté par
 *   l'éditeur compris).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { Editor } from "@tiptap/core"
import {
  captureEditorView,
  HANDOFF_TTL_MS,
  noteCreationHandoffView,
  offerCreationHandoff,
  peekCreationHandoff,
  restoreEditorView,
  takeCreationHandoff,
  useLocalDraft,
} from "@/components/admin/blog/shell/hooks"
import { localDraftKey, parseLocalDraft, serializeLocalDraft, type ArticleDraft } from "@/components/admin/blog/shell/model"
import { RichEditor, type RichEditorHandle } from "@/components/admin/blog/editor/RichEditor"

;(globalThis as unknown as { React: typeof React }).React = React
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const SUPABASE = "https://abcd.supabase.co"
const IMAGE = `${SUPABASE}/storage/v1/object/public/blog-covers/editor/2026/10/chantier-mf3k2a.jpg#w=1600&h=900`
let previousUrl: string | undefined
beforeAll(() => {
  previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE
})
afterAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl
})

const BASE: ArticleDraft = {
  title: "Relance de facture impayée",
  slug: "relance-facture-impayee",
  excerpt: "Trois modèles de mails.",
  content: "## Premier rappel\n\nUn texte.",
  coverUrl: "",
  coverAlt: "",
  seoTitle: "",
  seoDescription: "",
  keyword: null,
  publication: { mode: "draft", day: "2026-10-17", time: "08:00" },
}
const ID = "11111111-1111-4111-8111-111111111111"

let root: Root | null = null
let host: HTMLDivElement | null = null

afterEach(async () => {
  await act(async () => root?.unmount())
  host?.remove()
  root = null
  host = null
  localStorage.clear()
  offerCreationHandoff(null)
  document.body.innerHTML = ""
})

const wait = (ms: number) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)))

/* ------------------------------------------------------------------ */
/* Copie de l'appareil                                                 */
/* ------------------------------------------------------------------ */

type LocalApi = ReturnType<typeof useLocalDraft>
type HarnessProps = { id: string | null; draft: ArticleDraft; saved: ArticleDraft; savedAt: number | null; api: { current: LocalApi | null } }

function Harness({ id, draft, saved, savedAt, api }: HarnessProps) {
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  api.current = useLocalDraft({ id, draft, saved, savedAt, dirty })
  return null
}

async function mountHarness(props: Omit<HarnessProps, "api">) {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  const api = { current: null as LocalApi | null }
  const render = (next: Partial<Omit<HarnessProps, "api">>) => act(async () => root!.render(React.createElement(Harness, { ...props, ...next, api })))
  await render({})
  return { api, render }
}

const stored = (id: string | null) => parseLocalDraft(localStorage.getItem(localDraftKey(id)))

describe("copie de l'appareil", () => {
  it("est écrite au démontage, sans attendre les 2 s (bouton Retour du navigateur)", async () => {
    await mountHarness({ id: ID, draft: { ...BASE, title: "Relance (revue)" }, saved: BASE, savedAt: 0 })
    expect(localStorage.getItem(localDraftKey(ID))).toBeNull()
    await act(async () => root!.unmount())
    root = null
    expect(stored(ID)?.draft.title).toBe("Relance (revue)")
    // Version enregistrée dont la copie part : elle reste proposée même si l'horloge de l'appareil retarde
    expect(stored(ID)?.base).toEqual(BASE)
  })

  it("n'écrit rien au démontage quand tout est enregistré", async () => {
    await mountHarness({ id: ID, draft: BASE, saved: BASE, savedAt: 0 })
    await act(async () => root!.unmount())
    root = null
    expect(localStorage.length).toBe(0)
  })

  it("suit l'article créé : aucune copie « nouveau » d'un article qui existe déjà", async () => {
    const typed = { ...BASE, content: `${BASE.content} Suite tapée pendant l'envoi.` }
    const { render } = await mountHarness({ id: null, draft: typed, saved: BASE, savedAt: null })
    // Article créé : l'identifiant arrive, le texte tapé pendant l'envoi n'est pas encore enregistré
    await render({ id: ID })
    await act(async () => root!.unmount())
    root = null
    expect(localStorage.getItem(localDraftKey(null))).toBeNull()
    expect(stored(ID)?.draft.content).toContain("Suite tapée pendant l'envoi.")
  })

  it("ne propose plus une copie après un enregistrement, et n'écrit plus rien après une suppression", async () => {
    localStorage.setItem(localDraftKey(ID), serializeLocalDraft({ ...BASE, title: "Ancienne version" }, Date.parse("2026-10-16T10:00:00Z")))
    const { api, render } = await mountHarness({ id: ID, draft: BASE, saved: BASE, savedAt: Date.parse("2026-10-15T10:00:00Z") })
    expect(api.current?.offer?.draft.title).toBe("Ancienne version")

    // Enregistrement réussi : la copie et sa proposition disparaissent
    await act(async () => api.current!.clear())
    expect(api.current?.offer).toBeNull()
    expect(localStorage.getItem(localDraftKey(ID))).toBeNull()

    // Article supprimé : plus aucune écriture, même avec des modifications au démontage
    await render({ draft: { ...BASE, title: "Modifié puis supprimé" } })
    await act(async () => api.current!.stop())
    api.current!.flush()
    await act(async () => root!.unmount())
    root = null
    expect(localStorage.getItem(localDraftKey(ID))).toBeNull()
  })

  it("ne propose pas une copie identique à ce qui est déjà à l'écran (texte repris après la création)", async () => {
    const onScreen = { ...BASE, content: `${BASE.content} Suite.` }
    localStorage.setItem(localDraftKey(ID), serializeLocalDraft(onScreen, Date.parse("2026-10-16T10:00:00Z")))
    const { api } = await mountHarness({ id: ID, draft: onScreen, saved: BASE, savedAt: Date.parse("2026-10-15T10:00:00Z") })
    expect(api.current?.offer).toBeNull()
    // Copie gardée : c'est encore du texte non enregistré
    expect(stored(ID)?.draft.content).toBe(onScreen.content)
  })

  it("propose une copie différente de l'écran et plus récente que l'enregistrement", async () => {
    localStorage.setItem(localDraftKey(ID), serializeLocalDraft({ ...BASE, excerpt: "Autre chapeau." }, Date.parse("2026-10-16T10:00:00Z")))
    const { api } = await mountHarness({ id: ID, draft: BASE, saved: BASE, savedAt: Date.parse("2026-10-15T10:00:00Z") })
    expect(api.current?.offer?.draft.excerpt).toBe("Autre chapeau.")
  })
})

/* ------------------------------------------------------------------ */
/* Relais après la création                                            */
/* ------------------------------------------------------------------ */

describe("relais après la création", () => {
  const handoff = (at: number) => ({
    id: ID,
    saved: BASE,
    latest: () => ({ ...BASE, content: "Texte du moment." }),
    tab: "referencement" as const,
    highlighted: ["relance"],
    lastSaveAt: "2026-10-16T18:00:00.000Z",
    fromCalendar: true,
    editorMode: "visual" as const,
    view: null,
    at,
  })

  it("ne sert qu'à l'article créé, sans être consommé par une simple lecture", () => {
    offerCreationHandoff(handoff(1_000))
    expect(peekCreationHandoff("22222222-2222-4222-8222-222222222222", 1_500)).toBeNull()
    expect(peekCreationHandoff(null, 1_500)).toBeNull()
    expect(peekCreationHandoff(ID, 1_500)?.latest().content).toBe("Texte du moment.")
    // Rendu en double du mode strict : la seconde lecture le voit encore
    expect(peekCreationHandoff(ID, 1_600)?.tab).toBe("referencement")
    expect(takeCreationHandoff(ID, 1_700)?.highlighted).toEqual(["relance"])
    expect(peekCreationHandoff(ID, 1_800)).toBeNull()
  })

  it("est oublié passé son délai", () => {
    offerCreationHandoff(handoff(1_000))
    expect(peekCreationHandoff(ID, 1_000 + HANDOFF_TTL_MS + 1)).toBeNull()
    expect(takeCreationHandoff(ID, 1_000)).toBeNull()
  })

  it("relève la vue une seule fois, au démontage de l'éditeur qui a créé l'article", () => {
    offerCreationHandoff(handoff(1_000))
    noteCreationHandoffView("autre", () => ({ scrollTop: 1, focus: null }))
    expect(peekCreationHandoff(ID, 1_100)?.view).toBeNull()
    noteCreationHandoffView(ID, () => ({ scrollTop: 640, focus: null }))
    noteCreationHandoffView(ID, () => ({ scrollTop: 0, focus: null }))
    expect(peekCreationHandoff(ID, 1_100)?.view).toEqual({ scrollTop: 640, focus: null })
  })

  it("relève puis rend le défilement et le champ actif, avec sa sélection", () => {
    document.body.innerHTML = `<div data-admin-scroll style="height:100px;overflow:auto"><div id="racine"><textarea id="blog-excerpt">Un chapeau assez long</textarea></div></div>`
    const scroller = document.querySelector<HTMLElement>("[data-admin-scroll]")!
    scroller.scrollTop = 120
    const field = document.getElementById("blog-excerpt") as HTMLTextAreaElement
    field.focus()
    field.setSelectionRange(3, 10)
    const view = captureEditorView(document.getElementById("racine"), null)
    expect(view.focus).toEqual({ kind: "field", id: "blog-excerpt", start: 3, end: 10 })

    // Nouvelle page : même champ, défilement et focus perdus
    field.blur()
    scroller.scrollTop = 0
    const notReady = { focus: vi.fn(), getSelection: () => null }
    expect(restoreEditorView(view, notReady)).toBe(false)
    expect(document.activeElement).not.toBe(field)

    const ready = { focus: vi.fn(), getSelection: () => ({ from: 1, to: 1 }) }
    expect(restoreEditorView(view, ready)).toBe(true)
    expect(document.activeElement).toBe(field)
    expect([field.selectionStart, field.selectionEnd]).toEqual([3, 10])
    expect(ready.focus).not.toHaveBeenCalled()
  })

  it("rend le curseur de la zone d'écriture", () => {
    document.body.innerHTML = `<div id="racine"><div class="ProseMirror" contenteditable="true" tabindex="0">Texte</div></div>`
    const pm = document.querySelector<HTMLElement>(".ProseMirror")!
    pm.focus()
    const view = captureEditorView(document.getElementById("racine"), { getSelection: () => ({ from: 12, to: 18 }) })
    expect(view.focus).toEqual({ kind: "editor", selection: { from: 12, to: 18 } })
    const editor = { focus: vi.fn(), getSelection: () => ({ from: 1, to: 1 }) }
    expect(restoreEditorView(view, editor)).toBe(true)
    expect(editor.focus).toHaveBeenCalledWith({ from: 12, to: 18 })
  })

  it("ignore un champ hors de l'éditeur", () => {
    document.body.innerHTML = `<input id="ailleurs" /><div id="racine"></div>`
    ;(document.getElementById("ailleurs") as HTMLInputElement).focus()
    expect(captureEditorView(document.getElementById("racine"), null).focus).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* Zone d'écriture                                                     */
/* ------------------------------------------------------------------ */

async function mountEditor(value: string, extra: { highlightTerms?: string[] } = {}) {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  const ref = React.createRef<RichEditorHandle>()
  const onChange = vi.fn()
  await act(async () => root!.render(React.createElement(RichEditor, { value, onChange, onRequestImage: async () => null, ref, ...extra })))
  await wait(40)
  const pm = host.querySelector(".ProseMirror") as (HTMLElement & { editor?: Editor }) | null
  return { ref, onChange, editor: pm?.editor as Editor }
}

describe("zone d'écriture", () => {
  const ENDINGS: [string, string][] = [
    ["une liste", "Intro.\n\n- un\n- deux"],
    ["un tableau", "Intro.\n\n| Étape | Délai |\n| --- | --- |\n| Rappel | J+7 |"],
    ["une image", `Intro.\n\n![Salle de bain rénovée](${IMAGE} "Chantier terminé")`],
    ["un titre", "Intro.\n\n## Dernier titre"],
    ["une citation", "Intro.\n\n> Une citation."],
  ]

  it.each(ENDINGS)("ouvrir un article qui finit par %s, mots-clés surlignés et focus compris, ne change rien", async (_label, md) => {
    const { onChange, ref, editor } = await mountEditor(md, { highlightTerms: ["intro", "rappel"] })
    expect(editor).toBeTruthy()
    await act(async () => {
      ref.current?.focus()
    })
    await wait(30)
    expect(onChange).not.toHaveBeenCalled()
    expect(ref.current?.getMarkdown()).toBe(md)
  })

  it("relit et rend la sélection (curseur repris après la création)", async () => {
    const { ref, editor, onChange } = await mountEditor("Premier paragraphe.\n\nSecond paragraphe.")
    await act(async () => {
      ref.current?.focus({ from: 3, to: 8 })
    })
    expect(ref.current?.getSelection()).toEqual({ from: 3, to: 8 })
    expect(editor.state.selection.from).toBe(3)
    // Positions hors du texte ramenées dans le texte (fin du dernier paragraphe)
    await act(async () => {
      ref.current?.focus({ from: 1, to: 10_000 })
    })
    const end = ref.current?.getSelection()?.to ?? 0
    expect(end).toBeGreaterThan(20)
    expect(end).toBeLessThanOrEqual(editor.state.doc.content.size)
    expect(onChange).not.toHaveBeenCalled()
  })
})
