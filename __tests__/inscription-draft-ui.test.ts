// @vitest-environment happy-dom
/**
 * Fenêtre « Bienvenue » : fermer sans valider ne perd plus ce qui est saisi.
 * Une entreprise complète est enregistrée comme un « Continuer » ; une saisie
 * incomplète part en brouillon, repris à la réouverture.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import * as React from "react"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const refresh = vi.fn()
const replace = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace, push: vi.fn() }) }))

let InscriptionDialog: typeof import("@/components/onboarding/InscriptionDialog").InscriptionDialog

beforeAll(async () => {
  ;(globalThis as { React?: typeof React }).React = React
  ;({ InscriptionDialog } = await import("@/components/onboarding/InscriptionDialog"))
})

type Call = { method: string; body: Record<string, unknown> }
let calls: Call[]
let root: Root
let host: HTMLElement
let closed: number

beforeEach(() => {
  calls = []
  closed = 0
  refresh.mockClear()
  replace.mockClear()
  globalThis.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
    calls.push({ method: String(init?.method), body })
    const company = body.step === "company" ? body.company : undefined
    return new Response(JSON.stringify(company ? { company, profileAvailable: true } : { ok: true }), { status: 200 })
  }) as unknown as typeof fetch
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  document.body.innerHTML = ""
})

const PROPS = {
  mode: "app" as const,
  open: true,
  justCreated: false,
  initialStep: "company" as const,
  profileAvailable: true,
  startAvailable: false,
  email: "a@b.fr",
  firstName: "",
  company: null,
  trade: null,
  vatRegime: null,
}

function mount(extra: Record<string, unknown> = {}) {
  act(() => {
    root.render(createElement(InscriptionDialog, { ...PROPS, onClose: () => { closed++ }, ...extra }))
  })
}

const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)) }) }

function button(text: RegExp): HTMLButtonElement {
  const el = Array.from(document.body.querySelectorAll("button")).find((b) => text.test(b.textContent ?? ""))
  if (!el) throw new Error(`bouton introuvable : ${text}`)
  return el
}

function type(placeholder: string, value: string) {
  const input = document.body.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`)
  if (!input) throw new Error(`champ introuvable : ${placeholder}`)
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
  act(() => {
    setter.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}

function openManual() {
  act(() => { button(/Je ne la trouve pas/).click() })
}

describe("fermer la fenêtre sans valider", () => {
  it("une entreprise saisie à la main et complète est enregistrée, sans SIREN", async () => {
    mount()
    openManual()
    type("Garnier Plâtrerie, ou vos prénom et nom", "Garnier Plâtrerie")
    type("14 rue des Lices", "14 rue des Lices")
    type("49100", "49100")
    type("Angers", "Angers")
    act(() => { button(/Passer au tableau de bord/).click() })
    expect(closed).toBe(1) // la fenêtre se ferme tout de suite
    await flush()

    expect(calls.map((c) => c.body.step)).toEqual(["company", "close"])
    expect(calls[0].body.company).toMatchObject({ name: "Garnier Plâtrerie", address: "14 rue des Lices", zip_code: "49100", city: "Angers", siren: null })
    expect(calls[1].body.draft).toBeNull()
  })

  it("une saisie incomplète part en brouillon, et la route de fermeture est appelée une fois", async () => {
    mount()
    openManual()
    type("Garnier Plâtrerie, ou vos prénom et nom", "Garnier Plâtrerie")
    type("Angers", "Angers")
    act(() => { button(/Passer au tableau de bord/).click() })
    await flush()

    expect(calls.map((c) => c.body.step)).toEqual(["close"])
    expect(calls[0].body.draft).toEqual({ company: { name: "Garnier Plâtrerie", city: "Angers", manual: true } })
    // Un second déclenchement (Échap, glisser) ne renvoie rien
    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })) })
    await flush()
    expect(calls).toHaveLength(1)
  })

  it("rien de saisi : fermeture sans brouillon", async () => {
    mount()
    act(() => { button(/Passer au tableau de bord/).click() })
    await flush()
    expect(calls.map((c) => c.body.step)).toEqual(["close"])
    expect(calls[0].body.draft).toBeNull()
  })

  it("un brouillon est repris dans le formulaire à la réouverture", () => {
    mount({ draft: { company: { name: "Garnier Plâtrerie", city: "Angers", manual: true } } })
    const name = document.body.querySelector<HTMLInputElement>('input[placeholder="Garnier Plâtrerie, ou vos prénom et nom"]')
    const city = document.body.querySelector<HTMLInputElement>('input[placeholder="Angers"]')
    expect(name?.value).toBe("Garnier Plâtrerie")
    expect(city?.value).toBe("Angers")
  })

  it("si l'enregistrement de l'étape échoue, les saisies restent en brouillon", async () => {
    globalThis.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
      calls.push({ method: String(init?.method), body })
      return body.step === "company"
        ? new Response(JSON.stringify({ error: "Panne" }), { status: 500 })
        : new Response(JSON.stringify({ ok: true }), { status: 200 })
    }) as unknown as typeof fetch
    mount()
    openManual()
    type("Garnier Plâtrerie, ou vos prénom et nom", "Garnier Plâtrerie")
    type("14 rue des Lices", "14 rue des Lices")
    type("49100", "49100")
    type("Angers", "Angers")
    act(() => { button(/Passer au tableau de bord/).click() })
    await flush()
    expect(calls.map((c) => c.body.step)).toEqual(["company", "close"])
    expect(calls[1].body.draft).toMatchObject({ company: { name: "Garnier Plâtrerie", city: "Angers", manual: true } })
  })
})

describe("tuile « Terminer votre inscription »", () => {
  it("ouvre la fenêtre sur place quand le tableau de bord l'écoute, sinon laisse le lien faire", async () => {
    const { RESUME_INSCRIPTION_EVENT, requestResumeInscription } = await import("@/components/dashboard/resume-inscription")
    expect(requestResumeInscription()).toBe(false) // personne n'écoute : le lien navigue

    const onResume = (e: Event) => e.preventDefault()
    window.addEventListener(RESUME_INSCRIPTION_EVENT, onResume)
    expect(requestResumeInscription()).toBe(true) // pas de navigation, pas d'attente du serveur
    window.removeEventListener(RESUME_INSCRIPTION_EVENT, onResume)
  })
})

describe("étapes enregistrées en arrière-plan", () => {
  const title = () => document.body.querySelector("h2")?.textContent ?? ""

  function fillManual() {
    openManual()
    type("Garnier Plâtrerie, ou vos prénom et nom", "Garnier Plâtrerie")
    type("14 rue des Lices", "14 rue des Lices")
    type("49100", "49100")
    type("Angers", "Angers")
  }

  it("l'étape suivante s'affiche tout de suite, sans attendre le serveur", async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    globalThis.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
      calls.push({ method: String(init?.method), body })
      await gate
      return new Response(JSON.stringify({ company: body.company, profileAvailable: true }), { status: 200 })
    }) as unknown as typeof fetch

    mount()
    fillManual()
    await act(async () => { button(/Continuer/).click() })
    expect(title()).toMatch(/Votre métier/) // le serveur n'a pas encore répondu
    expect(calls.map((c) => c.body.step)).toEqual(["company"])

    release()
    await flush()
    expect(title()).toMatch(/Votre métier/)
    expect(refresh).not.toHaveBeenCalled() // une seule mise à jour de la page, à la fin
  })

  it("échec de l'enregistrement : retour à l'étape avec le message, les saisies gardées", async () => {
    globalThis.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
      calls.push({ method: String(init?.method), body })
      return new Response(JSON.stringify({ error: "Panne du serveur." }), { status: 500 })
    }) as unknown as typeof fetch

    mount()
    fillManual()
    await act(async () => { button(/Continuer/).click() })
    await flush()

    expect(title()).toMatch(/à la main/)
    expect(document.body.querySelector('[role="alert"]')?.textContent).toContain("Panne du serveur.")
    expect(document.body.querySelector<HTMLInputElement>('input[placeholder="14 rue des Lices"]')?.value).toBe("14 rue des Lices")
  })
})
