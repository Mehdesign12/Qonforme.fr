// @vitest-environment happy-dom
/**
 * Garde « modifications non enregistrées » : un nouveau compte avait tapé un
 * devis, cliqué sur « Créer un client » sans enregistrer, et perdu le devis
 * sans avertissement. Désormais un lien interne est retenu tant que le
 * formulaire a des modifications, et une fenêtre propose d'enregistrer,
 * de quitter ou de rester.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as React from "react"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { leavingTarget } from "@/lib/ui/unsaved-guard"
import { hasEnteredContent } from "@/components/documents/model"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
;(globalThis as { React?: typeof React }).React = React

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/quotes/new",
  useSearchParams: () => new URLSearchParams(),
}))

const here = { origin: "https://qonforme.fr", pathname: "/quotes/new", search: "" }

describe("leavingTarget", () => {
  it("retient un lien interne vers une autre page", () => {
    expect(leavingTarget({ href: "/clients/new" }, here)).toBe("/clients/new")
    expect(leavingTarget({ href: "https://qonforme.fr/quotes?x=1#a" }, here)).toBe("/quotes?x=1#a")
    expect(leavingTarget({ href: "/quotes/new?client=1" }, here)).toBe("/quotes/new?client=1")
  })
  it("laisse passer ce qui ne quitte pas la page", () => {
    expect(leavingTarget({ href: "#lignes" }, here)).toBeNull()
    expect(leavingTarget({ href: "/quotes/new#lignes" }, here)).toBeNull()
    expect(leavingTarget({ href: "/quotes/new" }, here)).toBeNull()
    expect(leavingTarget({ href: "/clients", target: "_blank" }, here)).toBeNull()
    expect(leavingTarget({ href: "/api/quotes/1/pdf", download: true }, here)).toBeNull()
    expect(leavingTarget({ href: "/clients", modified: true }, here)).toBeNull()
    expect(leavingTarget({ href: "https://autre-site.fr/" }, here)).toBeNull()
    expect(leavingTarget({ href: "mailto:a@b.fr" }, here)).toBeNull()
    expect(leavingTarget({ href: "" }, here)).toBeNull()
  })
})

describe("hasEnteredContent", () => {
  const base = { client_id: "", issue_date: "2026-11-03", due_date: "", valid_until: "", delivery_date: "", reference: "", notes: "", autoliquidation: false }
  const line = (d = "", p = "") => ({ id: "l", description: d, quantity: "1", unit_price_ht: p, vat_rate: 20 as const })
  it("un document vide (ou seulement un client choisi) ne retient pas", () => {
    expect(hasEnteredContent({ ...base, lines: [line()] } as never)).toBe(false)
    expect(hasEnteredContent({ ...base, client_id: "c1", lines: [line()] } as never)).toBe(false)
  })
  it("une ligne, un prix ou une note retiennent", () => {
    expect(hasEnteredContent({ ...base, lines: [line("Pose de prises")] } as never)).toBe(true)
    expect(hasEnteredContent({ ...base, lines: [line("", "300")] } as never)).toBe(true)
    expect(hasEnteredContent({ ...base, notes: "Acompte 30 %", lines: [line()] } as never)).toBe(true)
  })
})

describe("fenêtre avant de quitter", () => {
  let root: Root
  let host: HTMLDivElement
  const onSave = vi.fn()

  beforeEach(async () => {
    push.mockReset(); onSave.mockReset()
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as never
    window.history.replaceState(null, "", "/quotes/new")
    const { useUnsavedChanges } = await import("@/components/shared/UnsavedChangesGuard")
    function Form({ dirty }: { dirty: boolean }) {
      const { guard } = useUnsavedChanges({ dirty, title: "Ce devis n'est pas enregistré", saveLabel: "Enregistrer le brouillon", onSave })
      return createElement("div", null, createElement("a", { href: "/clients/new", id: "lien" }, "Créer un client"), guard)
    }
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
    ;(globalThis as { renderForm?: (d: boolean) => void }).renderForm = (dirty) => act(() => root.render(createElement(Form, { dirty })))
  })
  afterEach(() => { act(() => root.unmount()); host.remove(); document.body.innerHTML = "" })

  const render = (dirty: boolean) => (globalThis as unknown as { renderForm: (d: boolean) => void }).renderForm(dirty)
  const click = (el: Element) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })) })
  const button = (label: string) => Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes(label))!

  it("sans modification, le lien part normalement", () => {
    render(false)
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
    act(() => { document.getElementById("lien")!.dispatchEvent(event) })
    expect(document.body.textContent).not.toContain("Ce devis n'est pas enregistré")
  })

  it("avec des modifications, le lien est retenu et la fenêtre s'ouvre", () => {
    render(true)
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
    act(() => { document.getElementById("lien")!.dispatchEvent(event) })
    expect(event.defaultPrevented).toBe(true)
    expect(document.body.textContent).toContain("Ce devis n'est pas enregistré")
    expect(document.body.textContent).toContain("ce que vous avez saisi sera perdu")
    expect(push).not.toHaveBeenCalled()
  })

  it("« Quitter sans enregistrer » emmène à la page demandée", () => {
    render(true)
    click(document.getElementById("lien")!)
    click(button("Quitter sans enregistrer"))
    expect(push).toHaveBeenCalledWith("/clients/new")
    expect(onSave).not.toHaveBeenCalled()
  })

  it("« Enregistrer le brouillon » enregistre en donnant la page demandée", async () => {
    render(true)
    click(document.getElementById("lien")!)
    await act(async () => { button("Enregistrer le brouillon").click() })
    expect(onSave).toHaveBeenCalledWith("/clients/new")
  })

  it("« Rester sur la page » ne fait rien", () => {
    render(true)
    click(document.getElementById("lien")!)
    click(button("Rester sur la page"))
    expect(push).not.toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it("fermer l'onglet déclenche l'avertissement du navigateur", () => {
    render(true)
    const event = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })
})

describe("bouton Retour du navigateur", () => {
  it("popAction : retour depuis l'entrée ajoutée → fenêtre ; sans saisie → on saute", async () => {
    const { popAction, HISTORY_MARK } = await import("@/lib/ui/history-guard")
    const base = { [HISTORY_MARK]: "base" }
    const top = { [HISTORY_MARK]: "top" }
    expect(popAction(base, { armed: true, skipping: false })).toBe("hold")
    expect(popAction(base, { armed: false, skipping: false })).toBe("back")
    expect(popAction(top, { armed: false, skipping: false })).toBe("back-skip")
    expect(popAction(top, { armed: true, skipping: false })).toBe("none")
    expect(popAction(base, { armed: false, skipping: true })).toBe("consume")
    expect(popAction({ __NA: true }, { armed: true, skipping: false })).toBe("none")
    expect(popAction(null, { armed: true, skipping: false })).toBe("none")
  })

  it("holdBack ajoute une entrée identique et un retour ouvre la fenêtre", async () => {
    const mod = await import("@/lib/ui/history-guard")
    mod.resetHistoryGuard()
    window.history.replaceState({ __NA: true }, "", "/quotes/new")
    const length = window.history.length
    const open = vi.fn()
    const release = mod.holdBack({ open })
    expect(window.history.length).toBe(length + 1)
    expect((window.history.state as Record<string, unknown>)[mod.HISTORY_MARK]).toBe("top")
    window.dispatchEvent(new PopStateEvent("popstate", { state: { [mod.HISTORY_MARK]: "base" } }))
    expect(open).toHaveBeenCalledTimes(1)
    release()
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {})
    window.dispatchEvent(new PopStateEvent("popstate", { state: { [mod.HISTORY_MARK]: "base" } }))
    expect(open).toHaveBeenCalledTimes(1)
    expect(back).toHaveBeenCalledTimes(1)
    back.mockRestore()
  })
})
