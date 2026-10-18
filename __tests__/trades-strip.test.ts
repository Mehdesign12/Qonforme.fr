// @vitest-environment happy-dom
/**
 * Rangée des métiers de l'accueil (18/10/2026) : au survol, la carte photo suit
 * la souris ; quand la rangée entre à l'écran, une souris de démonstration passe
 * très lentement sur « Électriciens ». Ces tests gardent la trajectoire, le
 * placement de la carte, le moteur (démonstration, survol, clavier, Échap) et les
 * garde-fous : rien au doigt, rien d'automatique avec « Réduire les animations »,
 * liens ordinaires sans JavaScript, nettoyage au démontage.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import * as React from "react"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { Hammer } from "lucide-react"

import { DEMO_MS, demoFrame, inside, placeCard, type Box } from "@/components/home/trades-demo"
import type { TradeItem } from "@/components/home/TradesStrip"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let TradesStripLive: typeof import("@/components/home/TradesStrip").TradesStripLive
let createEngine: typeof import("@/components/home/TradesStrip").createEngine
let Doodles: typeof import("@/components/brand/Doodles").Doodles

beforeAll(async () => {
  // Le JSX du dépôt est compilé en React.createElement : React global avant le chargement des composants
  ;(globalThis as { React?: typeof React }).React = React
  ;({ TradesStripLive, createEngine } = await import("@/components/home/TradesStrip"))
  ;({ Doodles } = await import("@/components/brand/Doodles"))
})

const ITEMS: TradeItem[] = [
  { slug: "electricien", label: "Électriciens", photo: { src: "/landing/photos/electricien.webp", width: 1000, height: 1250 } },
  { slug: "plombier", label: "Plombiers", photo: { src: "/landing/photos/plombier.webp", width: 1000, height: 1250 } },
  { slug: "macon", label: "Maçons", photo: { src: "/landing/photos/macon.webp", width: 1000, height: 1250 } },
]

const LINK: Box = { left: 200, top: 480, right: 330, bottom: 506 }

describe("trajectoire de la souris de démonstration", () => {
  it("part invisible, devient visible, traverse le lien et repart invisible", () => {
    expect(demoFrame(0, LINK).opacity).toBe(0)
    expect(demoFrame(600, LINK).opacity).toBeGreaterThan(0.9)
    expect(demoFrame(DEMO_MS - 1, LINK).opacity).toBeLessThan(0.1)
    expect(demoFrame(DEMO_MS + 500, LINK).opacity).toBe(0)
  })

  it("entre sur le lien vers 1,7 s, le parcourt de gauche à droite et en sort", () => {
    const start = demoFrame(1700, LINK)
    expect(inside(LINK, start.x, start.y, 0)).toBe(true)
    const mid = demoFrame(3400, LINK)
    expect(inside(LINK, mid.x, mid.y, 0)).toBe(true)
    const end = demoFrame(5200, LINK)
    expect(inside(LINK, end.x, end.y, 0)).toBe(true)
    expect(start.x).toBeLessThan(mid.x)
    expect(mid.x).toBeLessThan(end.x)
    const out = demoFrame(DEMO_MS, LINK)
    expect(inside(LINK, out.x, out.y, 4)).toBe(false)
  })

  it("reste lente : jamais plus de 60 px par seconde sur le mot, ni 200 px par seconde ailleurs", () => {
    let max = 0
    let maxOnWord = 0
    for (let t = 0; t < DEMO_MS; t += 100) {
      const a = demoFrame(t, LINK)
      const b = demoFrame(t + 100, LINK)
      const v = Math.hypot(b.x - a.x, b.y - a.y) * 10 // px par seconde
      max = Math.max(max, v)
      if (t >= 1700 && t < 5200) maxOnWord = Math.max(maxOnWord, v)
    }
    expect(maxOnWord).toBeLessThan(60)
    expect(max).toBeLessThan(200)
  })

  it("suit le lien quand la page défile (boîte décalée = trajectoire décalée)", () => {
    const moved: Box = { left: LINK.left, top: LINK.top - 100, right: LINK.right, bottom: LINK.bottom - 100 }
    const a = demoFrame(3000, LINK)
    const b = demoFrame(3000, moved)
    expect(b.x).toBeCloseTo(a.x)
    expect(b.y).toBeCloseTo(a.y - 100)
  })
})

describe("placement de la carte", () => {
  it("se place en bas à droite du pointeur", () => {
    const p = placeCard(300, 400, 208, 190, 1440, 900)
    expect(p.x).toBeGreaterThan(300)
    expect(p.y).toBeGreaterThan(400)
  })

  it("passe à gauche du pointeur près du bord droit, au-dessus près du bas", () => {
    const right = placeCard(1400, 400, 208, 190, 1440, 900)
    expect(right.x + 208).toBeLessThanOrEqual(1400)
    const bottom = placeCard(300, 860, 208, 190, 1440, 900)
    expect(bottom.y + 190).toBeLessThanOrEqual(870)
  })

  it("ne sort jamais par le haut ni par la gauche", () => {
    const p = placeCard(4, 4, 600, 600, 500, 500)
    expect(p.x).toBeGreaterThanOrEqual(0)
    expect(p.y).toBeGreaterThanOrEqual(0)
  })
})

/* ─────────────────────────────────────────────────────────
   Moteur : images pilotées à la main, horloge fausse
───────────────────────────────────────────────────────── */
describe("moteur", () => {
  let now = 0
  let queue: (() => void)[] = []

  const frames = (ms: number, step = 16) => {
    const end = now + ms
    while (now < end) {
      now += step
      const run = queue
      queue = []
      run.forEach((f) => f())
    }
  }

  const translateOf = (el: HTMLElement) => {
    const m = el.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
    return m ? { x: Number(m[1]), y: Number(m[2]) } : null
  }

  function setup(opts: { reduced?: boolean } = {}) {
    // Le rectangle du lien est modifiable : la page défile, l'apparition du lien le décale
    const rect = { ...LINK }
    const link = document.createElement("a")
    link.getBoundingClientRect = () =>
      ({ ...rect, x: rect.left, y: rect.top, width: rect.right - rect.left, height: rect.bottom - rect.top, toJSON: () => ({}) }) as DOMRect
    const layer = document.createElement("div")
    Object.defineProperty(layer, "offsetWidth", { value: 208 })
    Object.defineProperty(layer, "offsetHeight", { value: 190 })
    const cursor = document.createElement("div")
    const calls = { shown: [] as boolean[], active: [] as number[], demo: [] as boolean[] }
    const engine = createEngine({
      link: (i) => (i === 0 || i === 1 ? link : null),
      layer: () => layer,
      cursor: () => cursor,
      ui: { shown: (v) => calls.shown.push(v), active: (i) => calls.active.push(i), demo: (v) => calls.demo.push(v) },
      reduced: () => opts.reduced ?? false,
    })
    const scroll = (dy: number) => {
      rect.top += dy
      rect.bottom += dy
      window.dispatchEvent(new Event("scroll"))
    }
    const lastShown = () => calls.shown[calls.shown.length - 1]
    return { engine, layer, cursor, calls, rect, scroll, lastShown }
  }

  beforeEach(() => {
    now = 0
    queue = []
    Object.defineProperty(window, "innerWidth", { value: 1440, configurable: true })
    Object.defineProperty(window, "innerHeight", { value: 900, configurable: true })
    vi.useFakeTimers()
    vi.stubGlobal("requestAnimationFrame", (f: () => void) => {
      queue.push(f)
      return queue.length
    })
    vi.stubGlobal("cancelAnimationFrame", () => {
      queue = []
    })
    vi.spyOn(performance, "now").mockImplementation(() => now)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("la démonstration montre la carte du premier métier pendant que la souris est sur le lien, puis s'arrête", () => {
    const { engine, cursor, calls, layer } = setup()
    engine.start()
    expect(calls.demo).toEqual([true])
    // Au début : souris hors du lien, pas de carte
    frames(800)
    expect(calls.shown).toEqual([])
    expect(Number(cursor.style.opacity)).toBeGreaterThan(0.9)
    // La souris entre sur l'icône vers 1,7 s
    frames(1200)
    expect(calls.shown).toEqual([true])
    expect(calls.active).toEqual([0])
    expect(layer.style.transform).toMatch(/^translate\(/)
    // Elle repart : la carte se cache, la démonstration prend fin
    frames(DEMO_MS)
    expect(calls.shown[calls.shown.length - 1]).toBe(false)
    expect(calls.demo).toEqual([true, false])
    expect(cursor.style.opacity).toBe("0")
    engine.destroy()
  })

  it("la carte se cache dès que la souris de démonstration quitte le lien, avant la fin de la démonstration", () => {
    const { engine, calls, lastShown } = setup()
    engine.start()
    frames(3000)
    expect(lastShown()).toBe(true)
    frames(3000) // 6 s : la souris est sortie du lien (5,2 s à 6,4 s), la démonstration court encore
    expect(lastShown()).toBe(false)
    expect(calls.demo).toEqual([true])
    engine.destroy()
  })

  it("la carte suit la souris de démonstration, image après image", () => {
    const { engine, layer } = setup()
    engine.start()
    frames(2000)
    const a = translateOf(layer)!
    frames(1500)
    const b = translateOf(layer)!
    expect(b.x).toBeGreaterThan(a.x + 20)
    engine.destroy()
  })

  it("la démonstration s'arrête quand le lien passe sous l'en-tête fixe ou sort par le bas", () => {
    const { engine, calls, rect } = setup()
    engine.start()
    frames(500)
    rect.top = 20
    rect.bottom = 46 // sous l'en-tête
    frames(100)
    expect(calls.demo).toEqual([true, false])
    engine.destroy()
    const second = setup()
    second.engine.start()
    frames(500)
    second.rect.top = 950
    second.rect.bottom = 976 // sous le bord bas de la fenêtre
    frames(100)
    expect(second.calls.demo).toEqual([true, false])
    second.engine.destroy()
  })

  it("ne se lance pas avec « Réduire les animations »", () => {
    const { engine, calls } = setup({ reduced: true })
    engine.start()
    frames(DEMO_MS)
    expect(calls.demo).toEqual([])
    expect(calls.shown).toEqual([])
  })

  it("un vrai survol interrompt la démonstration et prend la main", () => {
    const { engine, calls } = setup()
    engine.start()
    frames(2500)
    engine.enter(2, 600, 500)
    expect(calls.demo).toEqual([true, false])
    expect(calls.active[calls.active.length - 1]).toBe(2)
    expect(calls.shown[calls.shown.length - 1]).toBe(true)
    // La démonstration ne reprend pas par-dessus le survol
    engine.start()
    expect(calls.demo).toEqual([true, false])
    engine.destroy()
  })

  it("au survol, la carte se pose sur le pointeur puis le suit avec un léger retard", () => {
    const { engine, layer } = setup()
    engine.enter(1, 400, 300)
    expect(translateOf(layer)).toEqual({ x: 422, y: 326 })
    engine.move(700, 320)
    frames(16)
    const x = translateOf(layer)!.x
    expect(x).toBeGreaterThan(422)
    expect(x).toBeLessThan(722) // pas encore arrivée : elle suit, elle ne saute pas
    frames(1500)
    expect(translateOf(layer)).toEqual({ x: 722, y: 346 })
    engine.destroy()
  })

  it("avec « Réduire les animations », la carte suit le pointeur sans retard", () => {
    const { engine, layer } = setup({ reduced: true })
    engine.enter(1, 400, 300)
    engine.move(700, 320)
    frames(16)
    expect(translateOf(layer)).toEqual({ x: 722, y: 346 })
    engine.destroy()
  })

  it("quand le pointeur quitte le lien, la carte se cache après un court délai (passer d'un métier au suivant sans clignoter)", () => {
    const { engine, lastShown } = setup()
    engine.enter(1, 400, 300)
    engine.leave(1)
    engine.enter(0, 420, 300)
    vi.advanceTimersByTime(200)
    expect(lastShown()).toBe(true)
    engine.leave(0)
    vi.advanceTimersByTime(89)
    expect(lastShown()).toBe(true) // le délai n'est pas écoulé
    vi.advanceTimersByTime(20)
    expect(lastShown()).toBe(false)
    engine.destroy()
  })

  describe("au clavier", () => {
    it("la carte se pose sous le lien qui a le focus, jamais dessus", () => {
      const { engine, layer, calls, lastShown } = setup()
      engine.focus(0)
      expect(calls.active).toEqual([0])
      expect(lastShown()).toBe(true)
      expect(translateOf(layer)!.y).toBeGreaterThanOrEqual(LINK.bottom)
      engine.blur(0)
      vi.advanceTimersByTime(200)
      expect(lastShown()).toBe(false)
      engine.destroy()
    })

    it("pendant l'apparition du lien (il bouge), la carte est replacée à chaque image jusqu'à ce qu'il soit posé", () => {
      const { engine, layer, rect } = setup()
      // Au focus, le lien est encore décalé de 40 px par son animation d'apparition
      rect.top += 40
      rect.bottom += 40
      engine.focus(0)
      const early = translateOf(layer)!
      // Puis il arrive à sa place
      rect.top -= 40
      rect.bottom -= 40
      frames(48)
      const settled = translateOf(layer)!
      expect(settled.y).toBeLessThan(early.y)
      frames(1000)
      expect(translateOf(layer)!.y).toBeCloseTo(LINK.bottom + 12, 0)
      engine.destroy()
    })

    it("la carte suit son lien quand la page défile, et se cache s'il sort de l'écran", () => {
      const { engine, layer, scroll, lastShown } = setup()
      engine.focus(0)
      frames(1500) // fin de la période de replacement : seuls les évènements de défilement agissent
      const before = translateOf(layer)!
      scroll(-60)
      frames(1000)
      expect(translateOf(layer)!.y).toBeCloseTo(before.y - 60, 0)
      scroll(-700) // le lien est au-dessus de la fenêtre
      expect(lastShown()).toBe(false)
      scroll(+700) // il revient
      frames(1000)
      expect(lastShown()).toBe(true)
      expect(translateOf(layer)!.y).toBeCloseTo(before.y - 60, 0)
      engine.destroy()
    })

    it("Échap ferme la carte, qui ne revient pas tant que le focus reste sur ce lien", () => {
      const { engine, scroll, lastShown } = setup()
      engine.focus(0)
      expect(lastShown()).toBe(true)
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
      expect(lastShown()).toBe(false)
      scroll(-10)
      frames(100)
      expect(lastShown()).toBe(false)
      // Un autre métier au clavier la rouvre
      engine.focus(1)
      expect(lastShown()).toBe(true)
      engine.destroy()
    })

    it("souris puis retour au clavier : la carte revient au lien qui a le focus, pas au métier survolé", () => {
      const { engine, calls, lastShown, layer } = setup()
      engine.focus(0)
      engine.enter(1, 900, 700) // la souris passe sur un autre métier
      expect(calls.active[calls.active.length - 1]).toBe(1)
      engine.leave(1)
      vi.advanceTimersByTime(200)
      frames(100)
      expect(lastShown()).toBe(true)
      expect(calls.active[calls.active.length - 1]).toBe(0)
      frames(1000)
      expect(translateOf(layer)!.y).toBeCloseTo(LINK.bottom + 12, 0)
      engine.destroy()
    })
  })

  it("Échap ferme aussi la carte du survol, qui revient en entrant sur un métier", () => {
    const { engine, lastShown } = setup()
    engine.enter(1, 400, 300)
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    expect(lastShown()).toBe(false)
    engine.move(410, 305)
    frames(32)
    expect(lastShown()).toBe(false)
    engine.leave(1)
    engine.enter(0, 420, 300)
    expect(lastShown()).toBe(true)
    engine.destroy()
  })

  it("au démontage, les écouteurs de la fenêtre sont retirés", () => {
    const remove = vi.spyOn(window, "removeEventListener")
    const { engine } = setup()
    engine.destroy()
    const types = remove.mock.calls.map((c) => c[0])
    expect(types).toEqual(expect.arrayContaining(["scroll", "resize", "keydown"]))
  })
})

/* ─────────────────────────────────────────────────────────
   Composant
───────────────────────────────────────────────────────── */
describe("rangée des métiers", () => {
  it("sans JavaScript : sept liens ordinaires vers les pages métier, aucune carte ni souris dans la page", () => {
    const html = renderToString(createElement(TradesStripLive, { items: ITEMS }))
    expect((html.match(/<a /g) ?? []).length).toBe(ITEMS.length)
    for (const t of ITEMS) expect(html).toContain(`href="/facturation/${t.slug}"`)
    expect(html).not.toContain("fixed")
    expect(html).not.toContain("<img")
  })

  describe("dans le navigateur", () => {
    type Obs = { cb: (entries: unknown[]) => void; opts?: { rootMargin?: string; threshold?: number[] }; disconnected: boolean }
    let container: HTMLDivElement
    let root: Root
    let unmounted = false
    let observers: Obs[] = []
    let motionListeners: (() => void)[] = []
    let reducedNow = false
    let rafQueue: (() => void)[] = []
    let now = 0

    /** Les liens et les images de Next ont aussi leurs observateurs : on retrouve les nôtres par leurs options. */
    const near = () => observers.find((o) => o.opts?.rootMargin === "150px 0px")!
    const view = () => observers.find((o) => Array.isArray(o.opts?.threshold) && o.opts!.threshold!.includes(0.85))!

    const environment = (opts: { fine: boolean; reduced?: boolean }) => {
      reducedNow = !!opts.reduced
      motionListeners = []
      window.matchMedia = ((query: string) => ({
        get matches() {
          return query.includes("prefers-reduced-motion") ? reducedNow : query.includes("hover: hover") ? opts.fine : false
        },
        media: query,
        addEventListener: (_: string, l: () => void) => {
          if (query.includes("prefers-reduced-motion")) motionListeners.push(l)
        },
        removeEventListener: () => {},
      })) as unknown as typeof window.matchMedia
      observers = []
      class Observer {
        disconnected = false
        constructor(
          public cb: (entries: unknown[]) => void,
          public opts?: { rootMargin?: string; threshold?: number[] },
        ) {
          observers.push(this)
        }
        observe() {}
        unobserve() {}
        disconnect() {
          this.disconnected = true
        }
      }
      ;(window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = Observer
    }

    const mount = async () => {
      await act(async () => {
        root.render(createElement(TradesStripLive, { items: ITEMS }))
      })
    }

    const link = (slug: string) => container.querySelector(`a[href='/facturation/${slug}']`) as HTMLElement
    const fixedLayers = () => Array.from(document.body.children).filter((e) => e.getAttribute("aria-hidden") === "true" && e.className.includes("fixed")) as HTMLElement[]
    const card = () => fixedLayers()[0].firstElementChild as HTMLElement
    const cursor = () => fixedLayers()[1]
    const runFrames = async (ms: number) => {
      await act(async () => {
        const end = now + ms
        while (now < end) {
          now += 16
          const run = rafQueue
          rafQueue = []
          run.forEach((f) => f())
        }
      })
    }
    const hoverOver = (el: HTMLElement, pointerType = "mouse") =>
      act(async () => {
        el.dispatchEvent(new window.PointerEvent("pointerover", { pointerType, clientX: 300, clientY: 200, bubbles: true }))
      })

    beforeEach(() => {
      now = 0
      rafQueue = []
      unmounted = false
      container = document.createElement("div")
      document.body.appendChild(container)
      root = createRoot(container)
      Object.defineProperty(window, "innerWidth", { value: 1440, configurable: true })
      Object.defineProperty(window, "innerHeight", { value: 900, configurable: true })
      vi.spyOn(performance, "now").mockImplementation(() => now)
      vi.stubGlobal("requestAnimationFrame", (f: () => void) => {
        rafQueue.push(f)
        return rafQueue.length
      })
      vi.stubGlobal("cancelAnimationFrame", () => {
        rafQueue = []
      })
    })

    afterEach(() => {
      if (!unmounted) act(() => root.unmount())
      container.remove()
      vi.restoreAllMocks()
      vi.unstubAllGlobals()
      vi.useRealTimers()
    })

    it("souris : la carte et la souris de démonstration existent hors de la page, décoratives et sans clic", async () => {
      environment({ fine: true })
      await mount()
      const layers = fixedLayers()
      expect(layers).toHaveLength(2)
      for (const l of layers) expect(l.className).toContain("pointer-events-none")
      // Une couche par métier dans la carte, pas de photo avant l'approche de la rangée
      expect(layers[0].querySelectorAll("img")).toHaveLength(0)
    })

    it("la carte s'anime par l'opacité et la transformation (échelle), pas par une propriété que Tailwind 3 n'écrit pas", async () => {
      environment({ fine: true })
      await mount()
      expect(card().className).toContain("transition-[opacity,transform]")
      expect(card().className).not.toContain("transition-[opacity,scale]")
    })

    it("les photos ne se chargent qu'à l'approche de la rangée", async () => {
      // happy-dom n'applique pas les classes Tailwind : next/image s'en plaint (cadre « fill » sans hauteur), sans conséquence ici
      vi.spyOn(console, "warn").mockImplementation(() => {})
      vi.spyOn(console, "error").mockImplementation(() => {})
      environment({ fine: true })
      await mount()
      expect(fixedLayers()[0].querySelectorAll("img")).toHaveLength(0)
      await act(async () => {
        near().cb([{ isIntersecting: true, intersectionRatio: 0.1 }])
      })
      expect(fixedLayers()[0].querySelectorAll("img")).toHaveLength(ITEMS.length)
      for (const img of Array.from(fixedLayers()[0].querySelectorAll("img"))) expect(img.getAttribute("alt")).toBe("")
    })

    it("au toucher (pas de survol fin) : aucune carte, aucune souris, les liens restent", async () => {
      environment({ fine: false })
      await mount()
      expect(fixedLayers()).toHaveLength(0)
      expect(container.querySelectorAll("a[href^='/facturation/']")).toHaveLength(ITEMS.length)
    })

    it("un survol à la souris affiche la carte du bon métier", async () => {
      environment({ fine: true })
      await mount()
      await hoverOver(link("plombier"))
      expect(card().className).toContain("opacity-100")
      const stacked = Array.from(card().querySelectorAll(":scope > div > div"))
      expect(stacked[1].className).toContain("opacity-100")
      expect(stacked[0].className).toContain("opacity-0")
      expect(fixedLayers()[0].style.transform).toMatch(/^translate\(/)
    })

    it("quand le pointeur quitte le métier, la carte se cache après le court délai", async () => {
      vi.useFakeTimers()
      environment({ fine: true })
      await mount()
      await hoverOver(link("plombier"))
      expect(card().className).toContain("opacity-100")
      await act(async () => {
        link("plombier").dispatchEvent(new window.PointerEvent("pointerout", { pointerType: "mouse", bubbles: true, relatedTarget: document.body }))
      })
      await act(async () => {
        vi.advanceTimersByTime(200)
      })
      expect(card().className).toContain("opacity-0")
    })

    it("un doigt ne déclenche rien", async () => {
      environment({ fine: true })
      await mount()
      await hoverOver(link("macon"), "touch")
      expect(card().className).toContain("opacity-0")
    })

    it("au clavier (focus-visible), la carte apparaît ; à la souris (clic), non", async () => {
      environment({ fine: true })
      await mount()
      const a = link("electricien")
      a.getBoundingClientRect = () => ({ left: 200, top: 480, right: 330, bottom: 506, x: 200, y: 480, width: 130, height: 26, toJSON: () => ({}) }) as DOMRect
      const realMatches = a.matches.bind(a)
      a.matches = ((sel: string) => (sel === ":focus-visible" ? false : realMatches(sel))) as typeof a.matches
      await act(async () => {
        a.dispatchEvent(new FocusEvent("focusin", { bubbles: true }))
      })
      expect(card().className).toContain("opacity-0")
      a.matches = ((sel: string) => (sel === ":focus-visible" ? true : realMatches(sel))) as typeof a.matches
      await act(async () => {
        a.dispatchEvent(new FocusEvent("focusin", { bubbles: true }))
      })
      expect(card().className).toContain("opacity-100")
    })

    describe("démonstration", () => {
      const first = () => link("electricien")

      it("part quand presque toute la rangée est à l'écran, pas avant", async () => {
        environment({ fine: true })
        await mount()
        await act(async () => {
          view().cb([{ isIntersecting: true, intersectionRatio: 0.5 }])
        })
        expect(first().getAttribute("data-on")).toBeNull()
        // happy-dom ne fait pas de mise en page : le lien est posé à l'écran à la main
        first().getBoundingClientRect = () => ({ ...LINK, x: LINK.left, y: LINK.top, width: 130, height: 26, toJSON: () => ({}) }) as DOMRect
        await act(async () => {
          view().cb([{ isIntersecting: true, intersectionRatio: 1 }])
        })
        expect(first().getAttribute("data-on")).toBe("true")
        await runFrames(800)
        expect(Number(cursor().style.opacity)).toBeGreaterThan(0.5)
        // Lien sous l'en-tête fixe : la démonstration s'arrête d'elle-même
        first().getBoundingClientRect = () => ({ left: 200, top: 20, right: 330, bottom: 46, x: 200, y: 20, width: 130, height: 26, toJSON: () => ({}) }) as DOMRect
        await runFrames(64)
        expect(first().getAttribute("data-on")).toBeNull()
      })

      it("lit la zone vue sans l'en-tête fixe ni le bord bas où les liens ne sont pas encore révélés", async () => {
        environment({ fine: true })
        await mount()
        expect(view().opts?.rootMargin).toBe("-80px 0px -8% 0px")
      })

      it("s'arrête quand la rangée sort de l'écran", async () => {
        environment({ fine: true })
        await mount()
        await act(async () => {
          view().cb([{ isIntersecting: true, intersectionRatio: 1 }])
        })
        expect(first().getAttribute("data-on")).toBe("true")
        await act(async () => {
          view().cb([{ isIntersecting: false, intersectionRatio: 0 }])
        })
        expect(first().getAttribute("data-on")).toBeNull()
        expect(cursor().style.opacity).toBe("0")
      })

      it("s'arrête au premier appui n'importe où dans la page", async () => {
        environment({ fine: true })
        await mount()
        await act(async () => {
          view().cb([{ isIntersecting: true, intersectionRatio: 1 }])
        })
        await act(async () => {
          window.dispatchEvent(new Event("pointerdown"))
        })
        expect(first().getAttribute("data-on")).toBeNull()
      })

      it("ne repart plus une fois que le visiteur a survolé un métier", async () => {
        environment({ fine: true })
        await mount()
        await hoverOver(link("macon"))
        await act(async () => {
          view().cb([{ isIntersecting: true, intersectionRatio: 1 }])
        })
        expect(first().getAttribute("data-on")).toBeNull()
      })

      it("ne part pas avec « Réduire les animations »", async () => {
        environment({ fine: true, reduced: true })
        await mount()
        await act(async () => {
          view().cb([{ isIntersecting: true, intersectionRatio: 1 }])
        })
        expect(first().getAttribute("data-on")).toBeNull()
      })

      it("s'arrête si « Réduire les animations » est activé pendant qu'elle se joue", async () => {
        environment({ fine: true })
        await mount()
        await act(async () => {
          view().cb([{ isIntersecting: true, intersectionRatio: 1 }])
        })
        expect(first().getAttribute("data-on")).toBe("true")
        await act(async () => {
          reducedNow = true
          motionListeners.forEach((l) => l())
        })
        expect(first().getAttribute("data-on")).toBeNull()
      })
    })

    it("au démontage : observateurs déconnectés, écouteurs de la fenêtre retirés, carte et souris retirées de la page", async () => {
      environment({ fine: true })
      const remove = vi.spyOn(window, "removeEventListener")
      await mount()
      const ours = [near(), view()]
      await act(async () => root.unmount())
      unmounted = true
      for (const o of ours) expect(o.disconnected).toBe(true)
      const types = remove.mock.calls.map((c) => c[0])
      expect(types).toEqual(expect.arrayContaining(["pointerdown", "scroll", "resize", "keydown"]))
      expect(fixedLayers()).toHaveLength(0)
    })
  })
})

/* ─────────────────────────────────────────────────────────
   Pictogrammes de marque : ton clair et nouveaux cadrages
───────────────────────────────────────────────────────── */
describe("pictogrammes de marque", () => {
  const Icon = Hammer
  const render = (props: Record<string, unknown>) => renderToString(createElement(Doodles, props as never))

  it("ton clair : blanc, le sujet presque plein, le reste atténué ; jamais le bleu de marque", () => {
    const html = render({ layout: "band", tone: "light", icons: [Icon, Icon, Icon, Icon] })
    expect(html).toContain("text-white")
    expect(html).not.toContain("text-q-accent")
    expect(html).toContain("opacity-[.9]")
    expect(html).toContain("opacity-[.34]")
  })

  it("ton par défaut : bleu de marque, inchangé", () => {
    const html = render({ layout: "sides-short", icons: [Icon, Icon] })
    expect(html).toContain("text-q-accent")
    expect(html).not.toContain("text-white")
    expect(html).toContain("opacity-[.42]")
  })

  it.each([
    ["hero-split", 8],
    ["band", 4],
    ["band-split", 5],
  ])("le cadrage %s a %i emplacements, masqué sous 1 100 px", (layout, count) => {
    const html = render({ layout, icons: Array.from({ length: count }, () => Icon) })
    expect((html.match(/<svg/g) ?? []).length).toBe(count)
    expect(html).toContain("hidden")
    expect(html).toContain("min-[1100px]:block")
  })

  it("décor : caché aux lecteurs d'écran, sans clic, sans flou ni couche à part", () => {
    const html = render({ layout: "hero-split", icons: [Icon] })
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain("pointer-events-none")
    expect(html).not.toMatch(/backdrop|will-change/)
  })
})
