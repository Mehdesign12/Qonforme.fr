// @vitest-environment happy-dom
/**
 * Glisser vers le bas pour fermer une feuille du bas : décision (distance,
 * geste rapide), départ du geste (barre, haut de la feuille, jamais un bouton),
 * retour de la feuille quand la fermeture est refusée.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  DISMISS_DISTANCE, FLICK_MIN, TOP_ZONE, attachSheetDrag, pressEscape, releaseVelocity, shouldDismiss,
} from "@/lib/ui/sheet-drag"

describe("quand la feuille se ferme", () => {
  it("tirée assez loin : 120 px, ou 30 % d'une petite feuille", () => {
    expect(shouldDismiss(DISMISS_DISTANCE, 700, 0)).toBe(true)
    expect(shouldDismiss(DISMISS_DISTANCE - 1, 700, 0)).toBe(false)
    expect(shouldDismiss(60, 200, 0)).toBe(true) // 30 % de 200
    expect(shouldDismiss(59, 200, 0)).toBe(false)
  })

  it("un geste rapide ferme même court, pas un geste lent ni minuscule", () => {
    expect(shouldDismiss(FLICK_MIN, 700, 0.6)).toBe(true)
    expect(shouldDismiss(FLICK_MIN - 1, 700, 2)).toBe(false)
    expect(shouldDismiss(80, 700, 0.1)).toBe(false)
  })

  it("jamais en remontant", () => {
    expect(shouldDismiss(0, 700, 3)).toBe(false)
    expect(shouldDismiss(-50, 700, 3)).toBe(false)
  })

  it("vitesse sur les 100 derniers ms", () => {
    expect(releaseVelocity([])).toBe(0)
    expect(releaseVelocity([{ y: 0, t: 0 }, { y: 100, t: 200 }, { y: 130, t: 250 }, { y: 160, t: 300 }])).toBeCloseTo(0.6, 1)
  })
})

function touch(type: string, target: Element, y: number) {
  const point = { clientX: 100, clientY: y, identifier: 1, target }
  const ev = new Event(type, { bubbles: true, cancelable: true }) as Event & { touches: unknown[] }
  ev.touches = type === "touchend" || type === "touchcancel" ? [] : [point]
  target.dispatchEvent(ev)
  return ev
}

describe("geste sur la feuille", () => {
  let panel: HTMLElement
  let grip: HTMLElement
  let title: HTMLElement
  let button: HTMLButtonElement
  let dismissed: number
  let detach: () => void
  let now = 0

  beforeEach(() => {
    vi.useFakeTimers()
    now = 0
    vi.spyOn(performance, "now").mockImplementation(() => now)
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true })
    panel = document.createElement("section")
    panel.setAttribute("role", "dialog")
    panel.getBoundingClientRect = () => ({ top: 400, bottom: 800, height: 400, left: 0, right: 390, width: 390, x: 0, y: 400, toJSON() {} })
    grip = document.createElement("div")
    grip.setAttribute("data-sheet-grip", "")
    title = document.createElement("h2")
    button = document.createElement("button")
    const far = document.createElement("p")
    far.id = "far"
    panel.append(grip, title, button, far)
    document.body.append(panel)
    dismissed = 0
    detach = attachSheetDrag(panel, () => { dismissed++ })
  })

  afterEach(() => {
    detach()
    panel.remove()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function drag(from: Element, y0: number, moves: number[], stepMs = 16) {
    touch("touchstart", from, y0)
    for (const y of moves) {
      now += stepMs
      touch("touchmove", from, y)
    }
    now += stepMs
    touch("touchend", from, moves[moves.length - 1] ?? y0)
  }

  it("tirer la barre loin vers le bas ferme la feuille", () => {
    drag(grip, 410, [440, 480, 520, 560], 40)
    expect(panel.style.transform).toBe("translateY(100%)")
    vi.advanceTimersByTime(200)
    expect(dismissed).toBe(1)
  })

  it("la feuille suit le doigt pendant le geste, sans will-change", () => {
    touch("touchstart", grip, 410)
    touch("touchmove", grip, 450)
    expect(panel.style.transform).toBe("translateY(40px)")
    expect(panel.style.transition).toBe("none")
    expect(panel.style.willChange).toBe("")
    touch("touchend", grip, 450)
  })

  it("un geste court et lent ramène la feuille, sans la fermer", () => {
    drag(grip, 410, [420, 430, 440], 300)
    vi.advanceTimersByTime(400)
    expect(dismissed).toBe(0)
    expect(panel.style.transform).toBe("")
  })

  it("le geste part aussi du titre, pas d'un bouton ni du bas de la feuille", () => {
    drag(title, 420, [500, 560, 620], 40)
    vi.advanceTimersByTime(200)
    expect(dismissed).toBe(1)

    dismissed = 0
    panel.style.transform = ""
    drag(button, 420, [500, 560, 620], 40)
    vi.advanceTimersByTime(200)
    expect(dismissed).toBe(0)

    const far = panel.querySelector("#far")!
    drag(far, 400 + TOP_ZONE + 20, [500, 560, 700], 40)
    vi.advanceTimersByTime(200)
    expect(dismissed).toBe(0)
  })

  it("un mouvement vers le haut laisse la page défiler", () => {
    touch("touchstart", grip, 410)
    const ev = touch("touchmove", grip, 380)
    expect(ev.defaultPrevented).toBe(false)
    expect(panel.style.transform).toBe("")
  })

  it("une feuille qui n'est pas collée au bas de l'écran n'est pas touchée (carte centrée)", () => {
    panel.getBoundingClientRect = () => ({ top: 200, bottom: 600, height: 400, left: 0, right: 390, width: 390, x: 0, y: 200, toJSON() {} })
    drag(grip, 210, [300, 400, 500], 40)
    vi.advanceTimersByTime(300)
    expect(dismissed).toBe(0)
    expect(panel.style.transform).toBe("")
  })

  it("fermeture refusée : la feuille revient à sa place", () => {
    drag(grip, 410, [440, 480, 520, 560], 40)
    vi.advanceTimersByTime(200)
    expect(dismissed).toBe(1)
    expect(panel.style.transform).toBe("translateY(100%)")
    vi.advanceTimersByTime(700) // la feuille est toujours là
    expect(panel.style.transform).toBe("")
  })

  it("avec « Réduire les animations », elle se ferme tout de suite, sans animation", () => {
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
    drag(grip, 410, [440, 480, 520, 560], 40)
    expect(dismissed).toBe(1)
  })

  it("Échap : fermeture par défaut, la même que le clavier", () => {
    const seen: string[] = []
    document.addEventListener("keydown", (e) => seen.push(e.key), { once: true })
    pressEscape()
    expect(seen).toEqual(["Escape"])
  })
})
