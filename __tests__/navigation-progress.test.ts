// @vitest-environment happy-dom
/**
 * Barre de progression au toucher d'un lien : elle part dès le toucher d'un
 * lien interne, se remplit quand la nouvelle page arrive, et ne réagit ni aux
 * liens externes, ni aux nouveaux onglets, ni à la page où l'on est déjà.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import * as React from "react"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let pathname = "/dashboard"
let search = ""
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(search),
}))

let NavigationProgress: typeof import("@/components/layout/NavigationProgress").NavigationProgress
let isInternalNavigation: typeof import("@/components/layout/NavigationProgress").isInternalNavigation

beforeAll(async () => {
  ;(globalThis as { React?: typeof React }).React = React
  ;({ NavigationProgress, isInternalNavigation } = await import("@/components/layout/NavigationProgress"))
})

let root: Root
let host: HTMLElement

beforeEach(() => {
  vi.useFakeTimers()
  ;(window as unknown as { happyDOM: { setURL(u: string): void } }).happyDOM.setURL("http://localhost/dashboard")
  pathname = "/dashboard"
  search = ""
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(createElement(NavigationProgress)))
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  document.body.innerHTML = ""
  vi.useRealTimers()
})

const phase = () => document.body.querySelector("[data-nav-progress]")?.getAttribute("data-nav-progress")

function click(href: string, attrs: Record<string, string> = {}, init: MouseEventInit = {}) {
  const a = document.createElement("a")
  a.href = href
  for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v)
  document.body.appendChild(a)
  // happy-dom suit le lien (la fenêtre changerait d'adresse) : on l'en empêche après la phase de capture
  const stop = (e: Event) => e.preventDefault()
  document.addEventListener("click", stop)
  act(() => { a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init })) })
  document.removeEventListener("click", stop)
  a.remove()
}

describe("barre de progression", () => {
  it("repos au départ", () => {
    expect(phase()).toBe("idle")
  })

  it("part au toucher d'un lien interne, se remplit à l'arrivée de la page, puis disparaît", () => {
    click("/invoices")
    expect(phase()).toBe("loading")

    pathname = "/invoices"
    act(() => root.render(createElement(NavigationProgress)))
    expect(phase()).toBe("done")
    act(() => { vi.advanceTimersByTime(300) })
    expect(phase()).toBe("idle")
  })

  it("un changement d'adresse qui ne change que la requête compte aussi", () => {
    click("/dashboard?periode=mois")
    expect(phase()).toBe("loading")
    search = "periode=mois"
    act(() => root.render(createElement(NavigationProgress)))
    expect(phase()).toBe("done")
  })

  it("rien pour un lien externe, un nouvel onglet, un téléchargement, un clic modifié, la page actuelle", () => {
    click("https://example.com/x")
    expect(phase()).toBe("idle")
    click("/invoices", { target: "_blank" })
    expect(phase()).toBe("idle")
    click("/api/export/fec", { download: "" })
    expect(phase()).toBe("idle")
    click("/invoices", {}, { metaKey: true })
    expect(phase()).toBe("idle")
    click("/dashboard")
    expect(phase()).toBe("idle")
    click("/dashboard#contenu")
    expect(phase()).toBe("idle")
  })

  it("si la page n'arrive pas, la barre disparaît d'elle-même", () => {
    click("/invoices")
    expect(phase()).toBe("loading")
    act(() => { vi.advanceTimersByTime(13_000) })
    expect(phase()).toBe("idle")
  })

  it("liens internes reconnus", () => {
    const a = document.createElement("a")
    a.href = "/clients"
    expect(isInternalNavigation(a)).toBe(true)
    a.href = "https://qonforme.fr.evil.example/clients"
    expect(isInternalNavigation(a)).toBe(false)
  })
})
