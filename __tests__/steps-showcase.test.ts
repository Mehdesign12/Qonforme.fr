// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import * as React from "react"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { StepsData } from "@/components/landing/steps-showcase"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let StepsShowcase: typeof import("@/components/landing/steps-showcase").StepsShowcase
let data: StepsData

beforeAll(async () => {
  // Le JSX du dépôt est compilé en React.createElement : React global avant le chargement des composants
  ;(globalThis as { React?: typeof React }).React = React
  ;({ StepsShowcase } = await import("@/components/landing/steps-showcase"))
  const { EXAMPLE_COMPANY, EXAMPLE_PRODUCTS, EXAMPLES } = await import("@/components/landing/examples")
  const { DEMO_PRODUCTS } = await import("@/lib/demo/data")
  data = { company: EXAMPLE_COMPANY, products: EXAMPLE_PRODUCTS, newProduct: DEMO_PRODUCTS.find((p) => p.id === "ba13")!, quote: EXAMPLES.devis }
})

let container: HTMLDivElement
let root: Root

/** Réduction des animations demandée ou non, et un observateur qui voit toujours le carrousel à l'écran. */
function environment(reducedMotion: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reducedMotion && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
  class Visible {
    constructor(private cb: (entries: { isIntersecting: boolean }[]) => void) {}
    observe() {
      this.cb([{ isIntersecting: true }])
    }
    unobserve() {}
    disconnect() {}
  }
  ;(window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = Visible
}

const clean = (t: string | null | undefined) => (t ?? "").replace(/[\s\u00a0\u202f]+/g, " ")
/** Une scène (les trois sont dans la page, une seule est visible). */
const scene = (i: number) => container.querySelectorAll('[role="tabpanel"] > div[aria-hidden]')[i] as HTMLElement
const sceneText = (i: number) => clean(scene(i)?.textContent)
const companyCard = () => Array.from(scene(0).querySelectorAll("div.rounded-2xl")).find((el) => el.textContent?.startsWith("GPGarnier"))

/** Fait avancer l'horloge par petits pas, chacun dans son `act` : les effets qui lancent la suite (saisie, comptage) doivent avoir le temps de s'installer. */
async function advance(ms: number) {
  for (let t = 0; t < ms; t += 50) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50)
    })
  }
}

async function mount() {
  await act(async () => {
    root.render(createElement(StepsShowcase, { data }))
  })
}

beforeEach(() => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
})

describe("StepsShowcase", () => {
  it("avec « Réduire les animations » : chaque scène est terminée, sans bouton de pause", async () => {
    environment(true)
    await mount()
    expect(sceneText(0)).toContain("948 211 375")
    expect(companyCard()?.className).toContain("opacity-100")
    expect(sceneText(0)).toContain("NomAdresseN° de TVA")
    expect(container.querySelector('button[aria-label*="pause"]')).toBeNull()

    const tabs = container.querySelectorAll('[role="tab"]')
    expect(tabs).toHaveLength(3)
    await act(async () => {
      ;(tabs[2] as HTMLElement).click()
    })
    expect(tabs[2].getAttribute("aria-selected")).toBe("true")
    expect(sceneText(2)).toContain("Total TTC4 024,30 €")
    expect(sceneText(2)).toContain(`Devis envoyéà ${data.quote.client.email}`)
  })

  it("animé : la scène repart de zéro, se joue, puis passe à l'étape suivante", async () => {
    environment(false)
    vi.useFakeTimers()
    await mount()
    // Au départ, rien n'est tapé et le résultat n'est pas affiché
    expect(sceneText(0)).toContain("9 chiffres")
    expect(sceneText(0)).not.toContain("948 211 375")
    expect(companyCard()?.className).toContain("opacity-0")
    // Une fois la saisie finie, le clic fait, l'entreprise est trouvée
    await advance(2600)
    expect(sceneText(0)).toContain("948 211 375")
    expect(companyCard()?.className).toContain("opacity-100")
    // Un clic sur l'étape 2 rejoue le catalogue depuis le début
    const tabs = container.querySelectorAll('[role="tab"]')
    await act(async () => {
      ;(tabs[1] as HTMLElement).click()
    })
    await advance(100)
    expect(sceneText(1)).toContain("3 prestations")
    await advance(4000)
    expect(sceneText(1)).toContain("4 prestations")
  })

  it("le bouton de pause arrête le défilement automatique", async () => {
    environment(false)
    vi.useFakeTimers()
    await mount()
    const pause = container.querySelector('button[aria-label="Mettre le défilement en pause"]') as HTMLElement
    expect(pause).not.toBeNull()
    await act(async () => pause.click())
    expect(container.querySelector('button[aria-label="Reprendre le défilement"]')).not.toBeNull()
  })
})
