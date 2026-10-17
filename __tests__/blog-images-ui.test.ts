// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as React from "react"
import { act, createElement, useState } from "react"
import { createRoot, type Root } from "react-dom/client"

// Les composants .tsx sont compilés ici en React.createElement (JSX classique de vitest)
;(globalThis as { React?: typeof React }).React = React

const toasts = vi.hoisted(() => ({ calls: [] as string[] }))
vi.mock("sonner", () => {
  const toast = Object.assign((m: string) => void toasts.calls.push(m), {
    success: (m: string) => void toasts.calls.push(m),
    error: (m: string) => void toasts.calls.push(m),
  })
  return { toast }
})

import { CoverField } from "@/components/admin/blog/CoverField"
import { useImageStudio } from "@/components/admin/blog/images/useImageStudio"
import type { PickedImage } from "@/lib/seo/articles/editor-types"

const SUPABASE = "https://proj.supabase.co"
const STORED = `${SUPABASE}/storage/v1/object/public/blog-covers/editor/2026/10/plombier-abc.jpg`

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root
const env = { ...process.env }

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE
  toasts.calls = []
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  document.body.innerHTML = ""
  process.env = { ...env }
  vi.unstubAllGlobals()
})

const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)))

function buttonByText(text: string | RegExp, scope: ParentNode = document): HTMLButtonElement {
  const list = Array.from(scope.querySelectorAll("button")) as HTMLButtonElement[]
  const found = list.find((b) => (typeof text === "string" ? b.textContent?.includes(text) : text.test(b.textContent ?? "")))
  if (!found) throw new Error(`Bouton introuvable : ${text}`)
  return found
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.click()
  })
  await flush()
}

/** Couverture contrôlée, comme dans l'éditeur. */
function Harness({ initial, onChange }: { initial: { url: string; alt: string }; onChange?: (v: { url: string; alt: string }) => void }) {
  const [value, setValue] = useState(initial)
  return createElement(CoverField, {
    url: value.url,
    alt: value.alt,
    id: "couverture",
    title: "Facturer le remplacement d'un chauffe-eau",
    keyword: "devis plombier",
    onChange: (next: { url: string; alt: string }) => {
      setValue(next)
      onChange?.(next)
    },
  })
}

describe("CoverField", () => {
  it("vide : zone d'ajout, le focus de la liste de contrôle va au premier bouton", async () => {
    await act(async () => root.render(createElement(Harness, { initial: { url: "", alt: "" } })))
    expect(container.textContent).toContain("Ajouter une image de couverture")
    expect(container.textContent).toContain("Glissez une image ici, ou :")
    const group = document.getElementById("couverture")!
    expect(group.getAttribute("tabindex")).toBe("-1")
    await act(async () => group.focus())
    expect(document.activeElement?.textContent).toContain("Créer la couverture")
  })

  it("« Créer la couverture » : la couverture Qonforme avec le titre et le mot-clé, texte alternatif = titre", async () => {
    const changes: { url: string; alt: string }[] = []
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ url: `${STORED}#w=1600&h=900`, width: 1600, height: 900, alt: "Facturer le remplacement d'un chauffe-eau", family: "metier" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)
    await act(async () => root.render(createElement(Harness, { initial: { url: "", alt: "" }, onChange: (v) => changes.push(v) })))
    await click(buttonByText("Créer la couverture", container))
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/admin/blog/images/cover")
    expect(JSON.parse(init.body as string)).toEqual({ title: "Facturer le remplacement d'un chauffe-eau", keyword: "devis plombier" })
    // Adresse sans le fragment des dimensions, texte alternatif repris de la réponse
    expect(changes.at(-1)).toEqual({ url: STORED, alt: "Facturer le remplacement d'un chauffe-eau" })
    expect(toasts.calls).toContain("Couverture créée : vérifiez le titre sur l'image.")
    // Remplie : « Recréer » refait la couverture avec le titre du moment
    await click(buttonByText("Recréer", container))
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(toasts.calls).toContain("Couverture recréée avec le titre actuel")
  })

  it("« Créer la couverture » : l'erreur du serveur est affichée, rien n'est changé", async () => {
    const changes: { url: string; alt: string }[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "Le titre ou le mot-clé nomme un concurrent : il serait écrit sur l'image publique." }), { status: 422, headers: { "Content-Type": "application/json" } })),
    )
    await act(async () => root.render(createElement(Harness, { initial: { url: "", alt: "" }, onChange: (v) => changes.push(v) })))
    await click(buttonByText("Créer la couverture", container))
    await flush()
    expect((container.querySelector('[role="alert"]') as HTMLElement).textContent).toContain("nomme un concurrent")
    expect(changes).toEqual([])
  })

  it("studio : description d'après le métier, couverture en 16:9, image générée puis choisie", async () => {
    const changes: { url: string; alt: string }[] = []
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ url: `${STORED}#w=1600&h=900`, width: 1600, height: 900, model: "Nano Banana 2.1", notice: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)
    await act(async () => root.render(createElement(Harness, { initial: { url: "", alt: "" }, onChange: (v) => changes.push(v) })))

    await click(buttonByText("Photo avec Gemini", container))
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog).toBeTruthy()
    expect(dialog.textContent).toContain("Image de couverture")

    const textarea = dialog.querySelector("textarea") as HTMLTextAreaElement
    expect(textarea.value).toMatch(/^Un plombier/)
    // Couverture : seul le 16:9 est proposé
    const formats = Array.from(dialog.querySelectorAll('button[aria-label^="Paysage"], button[aria-label^="Photo"], button[aria-label^="Carré"]')) as HTMLButtonElement[]
    expect(formats.map((b) => [b.getAttribute("aria-label"), b.disabled])).toEqual([
      ["Paysage 16:9", false],
      ["Photo 4:3", true],
      ["Carré 1:1", true],
    ])

    const use = buttonByText("Utiliser cette image", dialog)
    expect(use.disabled).toBe(true)

    await click(buttonByText(/^Générer/, dialog.querySelector("form")!))
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body).toMatchObject({ aspect: "16:9", purpose: "cover", title: "Facturer le remplacement d'un chauffe-eau" })

    const preview = dialog.querySelector(`img[src="${STORED}#w=1600&h=900"]`)
    expect(preview).toBeTruthy()
    expect(dialog.textContent).toContain("Nano Banana 2.1")
    const alt = dialog.querySelector('input[aria-required="true"]') as HTMLInputElement
    expect(alt.value).toMatch(/^Un plombier/)
    expect(alt.value.endsWith(".")).toBe(false)
    expect(dialog.textContent).toContain("Images de cette session")

    await click(buttonByText("Utiliser cette image", dialog))
    expect(changes.at(-1)).toEqual({ url: STORED, alt: alt.value })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    // Remplie : image en 16:9 et texte alternatif modifiable
    expect(container.querySelector(`img[src="${STORED}"]`)).toBeTruthy()
    expect(toasts.calls).toContain("Couverture ajoutée")
  })

  it("clé absente (503) : bannière expliquée et passage à l'import proposé", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "Clé GEMINI_API_KEY absente : ajoutez-la.", code: "not_configured" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    )
    await act(async () => root.render(createElement(Harness, { initial: { url: "", alt: "" } })))
    await click(buttonByText("Photo avec Gemini", container))
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement
    await click(buttonByText(/^Générer/, dialog.querySelector("form")!))
    await flush()
    const alert = dialog.querySelector('[role="alert"]') as HTMLElement
    expect(alert.textContent).toContain("pas encore configurée")
    expect(alert.textContent).toContain("GEMINI_API_KEY")
    await click(buttonByText("Importer une image", alert))
    expect(dialog.textContent).toContain("Glissez une image ici")
    expect(dialog.textContent).toContain("JPEG, PNG ou WebP · 5 Mo au plus")
  })

  it("remplie : badge « Image externe », focus vers le texte alternatif manquant, retrait annulable", async () => {
    const changes: { url: string; alt: string }[] = []
    await act(async () =>
      root.render(createElement(Harness, { initial: { url: "https://exemple.fr/photo.jpg", alt: "" }, onChange: (v) => changes.push(v) })),
    )
    expect(container.textContent).toContain("Image externe")
    const group = document.getElementById("couverture")!
    await act(async () => group.focus())
    expect((document.activeElement as HTMLInputElement).id).toMatch(/-alt$/)

    await click(buttonByText("Retirer", container))
    expect(changes.at(-1)).toEqual({ url: "", alt: "" })
    expect(container.textContent).toContain("Ajouter une image de couverture")
    expect(toasts.calls).toContain("Couverture retirée")
  })

  it("image du blog : pas de badge externe ; adresse avancée validée", async () => {
    const changes: { url: string; alt: string }[] = []
    await act(async () => root.render(createElement(Harness, { initial: { url: STORED, alt: "Un plombier" }, onChange: (v) => changes.push(v) })))
    expect(container.textContent).not.toContain("Image externe")
    const input = container.querySelector('input[type="url"]') as HTMLInputElement
    expect(input.value).toBe(STORED)
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
      setter.call(input, "ftp://exemple.fr/a.jpg")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    })
    expect(container.textContent).toContain("Adresse attendue : https://")
    expect(changes).toHaveLength(0)
  })
})

describe("CoverField : images hors du stockage du blog", () => {
  it("image d'un autre site : avertissement visible sous l'aperçu (le blog ne l'affichera pas)", async () => {
    await act(async () => root.render(createElement(Harness, { initial: { url: "https://exemple.fr/photo.jpg", alt: "Un chantier" } })))
    expect(container.textContent).toContain("Image externe")
    expect(container.textContent).toContain("le blog ne l'affichera pas")
    expect(buttonByText("Importer une image", container)).toBeTruthy()
  })

  it("image du stockage du projet, autre compartiment : badge seulement, aucun avertissement", async () => {
    const other = `${SUPABASE}/storage/v1/object/public/brand-studio/photo.jpg`
    await act(async () => root.render(createElement(Harness, { initial: { url: other, alt: "Un chantier" } })))
    expect(container.textContent).toContain("Image externe")
    expect(container.textContent).not.toContain("le blog ne l'affichera pas")
  })

  it("un clic dans le bloc ne déplace pas le focus (seule la liste de contrôle le renvoie)", async () => {
    await act(async () => root.render(createElement(Harness, { initial: { url: STORED, alt: "" } })))
    const group = document.getElementById("couverture")!
    const img = group.querySelector("img")!
    await act(async () => {
      img.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))
      group.focus()
    })
    expect(document.activeElement).toBe(group)
  })
})

/** Événement de glisser-déposer avec un fichier (happy-dom n'a pas de DragEvent). */
function dropEvent(file: File) {
  const event = new Event("drop", { bubbles: true, cancelable: true })
  Object.defineProperty(event, "dataTransfer", { value: { types: ["Files"], files: [file], dropEffect: "none" } })
  return event
}

function pasteEvent(file: File) {
  const event = new Event("paste", { bubbles: true, cancelable: true })
  Object.defineProperty(event, "clipboardData", { value: { items: [{ kind: "file", type: file.type, getAsFile: () => file }] } })
  return event
}

const imageFile = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "photo.png", { type: "image/png" })

/** Studio des images du texte ouvert ; rend la promesse de requestImage. */
async function openInlineStudio() {
  let request: (() => Promise<PickedImage | null>) | null = null
  function Host() {
    const studio = useImageStudio({ title: "Poser un carrelage", keyword: null })
    request = studio.requestImage
    return createElement("div", null, studio.dialog)
  }
  await act(async () => root.render(createElement(Host)))
  const outcome: { value: PickedImage | null | undefined } = { value: undefined }
  await act(async () => {
    void request!().then((r) => {
      outcome.value = r
    })
  })
  await flush()
  return { dialog: document.querySelector('[role="dialog"]') as HTMLElement, outcome }
}

describe("ImageStudioDialog", () => {
  it("image collée pendant une génération : expliquée, jamais ignorée ; « Annuler » interrompt l'attente", async () => {
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("annulé", "AbortError")))
        }),
    )
    vi.stubGlobal("fetch", fetchMock)
    const { dialog } = await openInlineStudio()
    await click(buttonByText(/^Générer/, dialog.querySelector("form")!))
    expect(dialog.textContent).toContain("Gemini compose l'image")
    expect(dialog.textContent).toContain("Génération en cours")
    expect(buttonByText("Utiliser cette image", dialog).disabled).toBe(true)

    await act(async () => {
      document.dispatchEvent(pasteEvent(imageFile()))
    })
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((dialog.querySelector('[role="alert"]') as HTMLElement).textContent).toContain("en cours de génération")
    // L'onglet ne bascule pas pendant la génération
    expect(dialog.querySelector("form")).toBeTruthy()

    await click(buttonByText(/^Annuler$/, dialog.querySelector('[aria-busy="true"]')!))
    await flush()
    expect(dialog.textContent).not.toContain("Gemini compose l'image")
    expect(dialog.textContent).toContain("Génération annulée.")
  })

  it("image déposée hors de la zone de dépôt : importée (le navigateur n'ouvre pas le fichier)", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ url: `${STORED}#w=800&h=600`, width: 800, height: 600 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)
    const { dialog } = await openInlineStudio()
    const event = dropEvent(imageFile())
    await act(async () => {
      dialog.querySelector("h2, [id]")!.dispatchEvent(event)
    })
    await flush()
    expect(event.defaultPrevented).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("/api/admin/blog/images/upload")
    expect(dialog.querySelector(`img[src="${STORED}#w=800&h=600"]`)).toBeTruthy()
    expect(dialog.textContent).toContain("Importée")
  })

  it("bouton « Fermer » : la demande se règle à null", async () => {
    const { dialog, outcome } = await openInlineStudio()
    const close = dialog.querySelector('button[aria-label="Fermer"]') as HTMLButtonElement
    expect(close.className).toContain("size-11")
    await click(close)
    await flush()
    expect(outcome.value).toBeNull()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
})

describe("useImageStudio", () => {
  it("rend null quand le studio est fermé sans choix", async () => {
    let request: (() => Promise<PickedImage | null>) | null = null
    function Host() {
      const studio = useImageStudio({ title: "Poser un carrelage", keyword: null })
      request = studio.requestImage
      return createElement("div", null, studio.dialog)
    }
    await act(async () => root.render(createElement(Host)))
    let result: PickedImage | null | undefined
    await act(async () => {
      void request!().then((r) => {
        result = r
      })
    })
    await flush()
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog.textContent).toContain("Insérer une image")
    expect((dialog.querySelector("textarea") as HTMLTextAreaElement).value).toMatch(/^Un carreleur/)
    expect(dialog.textContent).toContain("Légende")
    await click(buttonByText(/^Annuler$/, dialog))
    await flush()
    expect(result).toBeNull()
  })
})
