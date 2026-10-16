// @vitest-environment happy-dom
/**
 * Éditeur d'articles monté pour de vrai (React + Tiptap dans happy-dom) :
 * ouverture sans modification, annulation au caractère près, mode Markdown,
 * fidélité au chargement, assistant de rédaction et fenêtre de lien.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { Editor } from "@tiptap/core"
import { RichEditor, type RichEditorHandle, type RichEditorProps } from "@/components/admin/blog/editor/RichEditor"

// Composants compilés en JSX classique par Vitest : React doit être accessible
;(globalThis as unknown as { React: typeof React }).React = React
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const MD = "Intro avec **gras**.\n\n## Premier titre\n\nTexte du devis à reformuler ici.\n\n### Sous-titre\n\n- un\n- deux"

let root: Root | null = null
let host: HTMLDivElement | null = null

afterEach(async () => {
  await act(async () => root?.unmount())
  host?.remove()
  root = null
  host = null
  vi.unstubAllGlobals()
})

const wait = (ms: number) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)))

async function mount(props: Partial<RichEditorProps> & { value: string }) {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  const ref = React.createRef<RichEditorHandle>()
  const onChange = vi.fn()
  const onOutline = vi.fn()
  const all: RichEditorProps = { onChange, onOutline, onRequestImage: async () => null, ...props }
  await act(async () => root!.render(React.createElement(RichEditor, { ...all, ref })))
  await wait(30)
  const pm = host.querySelector(".ProseMirror") as (HTMLElement & { editor?: Editor }) | null
  return { ref, onChange, onOutline, editor: pm?.editor as Editor, rerender: (next: Partial<RichEditorProps>) => act(async () => root!.render(React.createElement(RichEditor, { ...all, ...next, ref }))) }
}

function button(label: string): HTMLButtonElement {
  const found = Array.from(host!.querySelectorAll("button")).find((b) => b.textContent?.trim().startsWith(label) || b.getAttribute("aria-label")?.startsWith(label))
  if (!found) throw new Error(`Bouton introuvable : ${label}`)
  return found as HTMLButtonElement
}

function select(editor: Editor, text: string) {
  let from = -1
  editor.state.doc.descendants((node, pos) => {
    if (from < 0 && node.isText && node.text?.includes(text)) from = pos + node.text.indexOf(text)
  })
  editor.chain().focus().setTextSelection({ from, to: from + text.length }).run()
}

describe("éditeur d'articles", () => {
  it("ouvrir ne modifie rien ; une modification annulée rend le texte d'origine", async () => {
    const { ref, onChange, onOutline, editor } = await mount({ value: MD })
    expect(editor).toBeTruthy()
    expect(onChange).not.toHaveBeenCalled()
    expect(onOutline).toHaveBeenLastCalledWith([
      { level: 2, text: "Premier titre" },
      { level: 3, text: "Sous-titre" },
    ])
    expect(host!.textContent).toContain("14 mots · 1 min de lecture")
    expect(ref.current?.getMarkdown()).toBe(MD)

    await act(async () => {
      editor.commands.insertContentAt(3, "X")
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0]).toBe(MD.replace("Intro", "InXtro"))
    await act(async () => {
      editor.commands.undo()
    })
    expect(onChange).toHaveBeenLastCalledWith(MD)
    expect(ref.current?.getMarkdown()).toBe(MD)
  })

  it("mode Markdown : texte enregistré, plan, retour au visuel", async () => {
    const { ref, onChange } = await mount({ value: MD })
    await act(async () => button("Markdown").click())
    const textarea = host!.querySelector("textarea") as HTMLTextAreaElement
    expect(textarea.value).toBe(MD)
    expect(host!.textContent).toContain("Mode Markdown")
    await act(async () => ref.current?.scrollToHeading(1))
    expect(textarea.selectionStart).toBe(MD.indexOf("### Sous-titre"))
    await act(async () => button("Visuel").click())
    expect(host!.querySelector("textarea")).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  it("mode Markdown : la zone qui défile garde sa position à chaque frappe (hauteur au contenu)", async () => {
    const { ref } = await mount({ value: MD })
    // Coque de l'admin : la page défile dans [data-admin-scroll]
    const scroller = document.createElement("div")
    scroller.setAttribute("data-admin-scroll", "")
    host!.parentNode!.insertBefore(scroller, host)
    scroller.appendChild(host!)
    await act(async () => button("Markdown").click())
    const textarea = host!.querySelector("textarea") as HTMLTextAreaElement
    // Comme un navigateur : « height: auto » raccourcit la page, le défilement est ramené dans la nouvelle limite
    let height = ""
    const style = {
      get height() {
        return height
      },
      set height(v: string) {
        height = v
        if (v === "auto") scroller.scrollTop = 0
      },
    }
    Object.defineProperty(textarea, "style", { configurable: true, get: () => style })
    scroller.scrollTop = 4000
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!
    await act(async () => {
      setValue.call(textarea, `${MD}\nUne ligne de plus.`)
      textarea.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(ref.current?.getMarkdown()).toContain("Une ligne de plus.")
    expect(height).toMatch(/px$/)
    expect(scroller.scrollTop).toBe(4000)
  })

  it("barre d'outils collée : son anneau et son ombre compilent bien en box-shadow (pas en couleur d'ombre)", async () => {
    const { readFileSync } = await import("node:fs")
    const postcss = (await import("postcss")).default
    const tailwind = (await import("tailwindcss")).default
    const source = readFileSync("components/admin/blog/editor/RichEditor.tsx", "utf8")
    const cls = source.match(/data-\[stuck=true\]:shadow-\[[^\s"]+/)?.[0]
    expect(cls).toBeTruthy()
    const css = (await postcss([tailwind({ content: [{ raw: `<div class="${cls}"></div>`, extension: "html" }], corePlugins: { preflight: false } })]).process("@tailwind utilities;", { from: undefined })).css
    expect(css).toMatch(/box-shadow:/)
    expect(css).not.toMatch(/--tw-shadow-color: 0 0 0 1px/)
  })

  it("mise en forme sans équivalent : ouverture en Markdown, avec la raison", async () => {
    const value = `${MD}\n\n<div style="color:red">Encadré</div>`
    const { onChange } = await mount({ value })
    const banner = host!.querySelector(".q-banner")
    expect(banner?.textContent).toContain("HTML brut sans équivalent")
    expect(banner?.textContent).toContain("Il s'ouvre en mode Markdown pour ne rien perdre.")
    expect((host!.querySelector("textarea") as HTMLTextAreaElement).value).toBe(value)
    await act(async () => button("Passer quand même en mode visuel").click())
    expect(host!.querySelector("textarea")).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  it("valeur changée par le parent : rechargée sans émettre", async () => {
    const { ref, onChange, rerender } = await mount({ value: MD })
    await rerender({ value: "## Nouveau\n\nTexte restauré." })
    expect(ref.current?.getMarkdown()).toBe("## Nouveau\n\nTexte restauré.")
    expect(host!.querySelector(".ProseMirror h2")?.textContent).toBe("Nouveau")
    expect(onChange).not.toHaveBeenCalled()
  })

  it("assistant : proposition, « Remplacer » en une étape annulable", async () => {
    const calls: unknown[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        calls.push(JSON.parse(String(init?.body)))
        return new Response(JSON.stringify({ text: "passage **réécrit**", warnings: ["Vérifiez : « 2025 » n'était pas dans le passage."] }), { status: 200 })
      }),
    )
    const { editor, onChange } = await mount({ value: MD, keyword: "devis", articleTitle: "Faire un devis" })
    await act(async () => select(editor, "à reformuler"))
    await wait(250)
    await act(async () => button("Assistant").click())
    const actions = Array.from(host!.querySelectorAll("[role=menuitem]")).map((b) => b.textContent)
    expect(actions).toEqual(["Reformuler", "Raccourcir", "Développer", "Simplifier", "Corriger l'orthographe", "Intégrer le mot-clé « devis »"])
    await act(async () => button("Reformuler").click())
    await wait(30)
    expect(calls[0]).toMatchObject({ action: "rephrase", text: "à reformuler", keyword: "devis", title: "Faire un devis" })
    const card = host!.querySelector('[aria-label="Proposition de l\'assistant"]')
    expect(card?.textContent).toContain("passage réécrit")
    expect(card?.textContent).toContain("« 2025 » n'était pas dans le passage")
    await act(async () => button("Remplacer").click())
    expect(onChange).toHaveBeenLastCalledWith(MD.replace("à reformuler", "passage **réécrit**"))
    await act(async () => {
      editor.commands.undo()
    })
    expect(onChange).toHaveBeenLastCalledWith(MD)
  })

  it("lien : Ctrl+K, recherche d'une page du site, Entrée", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            targets: [
              { title: "TVA des travaux", path: "/guide/tva-travaux", kind: "guide" },
              { title: "Accueil", path: "/", kind: "page" },
            ],
          }),
          { status: 200 },
        ),
      ),
    )
    const { editor, onChange } = await mount({ value: MD })
    await act(async () => select(editor, "Intro"))
    await act(async () => {
      editor.view.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))
    })
    await wait(30)
    const input = host!.querySelector("input[role=combobox]") as HTMLInputElement
    expect(input).toBeTruthy()
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "tva")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(Array.from(host!.querySelectorAll("[role=option]")).map((o) => o.textContent)).toEqual(["TVA des travaux/guide/tva-travaux"])
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    })
    expect(onChange).toHaveBeenLastCalledWith(MD.replace("Intro", "[Intro](/guide/tva-travaux)"))
    expect(host!.querySelector("input[role=combobox]")).toBeNull()
  })

  it("lien : adresse externe non officielle signalée", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ targets: [] }), { status: 200 })))
    const { editor } = await mount({ value: MD })
    await act(async () => select(editor, "Intro"))
    await act(async () => button("Lien").click())
    await wait(20)
    const input = host!.querySelector("input[role=combobox]") as HTMLInputElement
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "https://exemple.fr/page")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(host!.textContent).toContain("Le contrôle signale les liens vers des sites non officiels : seuls .gouv.fr et service-public.fr sont admis.")
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "https://www.service-public.gouv.fr/x")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(host!.textContent).not.toContain("sites non officiels")
  })
})

/* ------------------------------------------------------------------ */
/* Corrections de la relecture                                         */
/* ------------------------------------------------------------------ */

const SUPABASE = "https://abcd.supabase.co"
const PHOTO = `${SUPABASE}/storage/v1/object/public/blog-covers/editor/2026/10/pose-mf3k2a.jpg`

function toolbarButton(label: string): HTMLButtonElement {
  const bar = host!.querySelector('[role=toolbar][aria-label="Mise en forme du texte"]')
  const found = Array.from(bar?.querySelectorAll("button") ?? []).find((b) => b.getAttribute("aria-label")?.startsWith(label))
  if (!found) throw new Error(`Bouton de la barre introuvable : ${label}`)
  return found as HTMLButtonElement
}

function setInput(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value)
  input.dispatchEvent(new Event("input", { bubbles: true }))
}

describe("éditeur d'articles : cas limites", () => {
  it("écho en retard du parent : ignoré, la dernière frappe reste", async () => {
    const { editor, onChange, rerender, ref } = await mount({ value: MD })
    await act(async () => {
      editor.commands.insertContentAt(3, "X")
    })
    const first = onChange.mock.calls[0][0] as string
    await act(async () => {
      editor.commands.insertContentAt(4, "Y")
    })
    const second = onChange.mock.calls[1][0] as string
    expect(second).toBe(MD.replace("Intro", "InXYtro"))
    // Le parent rend encore la valeur précédente : rien n'est rechargé
    await rerender({ value: first })
    expect(ref.current?.getMarkdown()).toBe(second)
    expect(editor.getText()).toContain("InXYtro")
    await rerender({ value: second })
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it("image demandée depuis une liste : insérée après la liste", async () => {
    const value = "Intro.\n\n- un\n- deux"
    const onRequestImage = vi.fn(async () => ({ url: `${PHOTO}#w=1600&h=900`, width: 1600, height: 900, alt: "Pose du carrelage terminée" }))
    const { editor, onChange } = await mount({ value, onRequestImage })
    await act(async () => select(editor, "un"))
    await act(async () => toolbarButton("Image").click())
    await wait(20)
    expect(onRequestImage).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith(`${value}\n\n![Pose du carrelage terminée](${PHOTO}#w=1600&h=900)`)
  })

  it("barre d'outils : seulement ce que le blog affiche", async () => {
    const { editor } = await mount({ value: "- un\n- deux\n\n> Une citation\n\nTexte." })
    await act(async () => select(editor, "un"))
    expect(toolbarButton("Citation").disabled).toBe(true)
    expect(toolbarButton("Liste à puces").disabled).toBe(false)
    await act(async () => select(editor, "Une citation"))
    expect(toolbarButton("Liste à puces").disabled).toBe(true)
    expect(toolbarButton("Liste numérotée").disabled).toBe(true)
    expect(toolbarButton("Citation").disabled).toBe(false)
    await act(async () => select(editor, "Texte"))
    expect(toolbarButton("Citation").disabled).toBe(false)
    expect(toolbarButton("Lien").disabled).toBe(false)
  })

  it("assistant dans une cellule : le passage part sans syntaxe de tableau ; refus sans « Réessayer »", async () => {
    const calls: { text: string }[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        calls.push(JSON.parse(String(init?.body)))
        return new Response(JSON.stringify({ error: "Le passage sélectionné nomme un concurrent : retirez-le avant de demander une réécriture." }), { status: 422 })
      }),
    )
    const { editor } = await mount({ value: "| Poste | Prix |\n| --- | --- |\n| Pose du carrelage | 1 080 € |" })
    await act(async () => select(editor, "Pose du carrelage"))
    await wait(250)
    await act(async () => button("Assistant").click())
    await act(async () => button("Reformuler").click())
    await wait(30)
    expect(calls[0].text).toBe("Pose du carrelage")
    const alert = host!.querySelector("[role=alert]")
    expect(alert?.textContent).toContain("nomme un concurrent")
    expect(Array.from(alert?.querySelectorAll("button") ?? []).map((b) => b.textContent?.trim())).toEqual(["Fermer"])
  })

  it("image : texte alternatif et légende enregistrés sur l'image d'origine", async () => {
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE
    try {
      const value = `Avant.\n\n![Photo du chantier](${PHOTO}#w=1600&h=900)\n\nAprès.`
      const { editor, onChange } = await mount({ value })
      let pos = -1
      editor.state.doc.descendants((node, p) => {
        if (node.type.name === "image") pos = p
      })
      await act(async () => {
        editor.chain().focus().setNodeSelection(pos).run()
      })
      await wait(250)
      await act(async () => button("Texte alternatif et légende").click())
      const alt = host!.querySelector("#q-editor-image-alt") as HTMLInputElement
      const caption = host!.querySelector("#q-editor-image-caption") as HTMLInputElement
      expect(alt.value).toBe("Photo du chantier")
      await act(async () => {
        setInput(alt, "Salle de bain rénovée, carrelage gris")
        setInput(caption, "Chantier terminé en mars")
      })
      await act(async () => button("Enregistrer").click())
      expect(onChange).toHaveBeenLastCalledWith(value.replace("![Photo du chantier](", "![Salle de bain rénovée, carrelage gris](").replace("#w=1600&h=900)", '#w=1600&h=900 "Chantier terminé en mars")'))
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previous
    }
  })
})
