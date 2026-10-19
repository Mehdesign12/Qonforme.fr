"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ArrowRight, BrickWall, Droplets, Grid3x3, Hammer, House, MousePointer2, PaintRoller, PlugZap, type LucideIcon } from "lucide-react"

import { DEMO_MS, demoFrame, inside, placeCard } from "@/components/home/trades-demo"
import { usePrefersReducedMotion } from "@/components/landing/carousels"
import { cn } from "@/lib/utils"

/**
 * Rangée des métiers de l'accueil, avec le détail qui montre qu'ils sont des
 * liens : au survol d'un métier (souris seulement), une petite carte avec la
 * photo du métier suit le pointeur et dit « Voir la page ». Quand la rangée entre
 * à l'écran, une souris de démonstration passe très lentement sur le premier
 * métier et la carte la suit, pour montrer le geste.
 *
 * Règles (CLAUDE.md) : la carte est une aide au survol, pas un élément posé sur
 * une photo ou une maquette ; ni backdrop-filter ni will-change (la position est
 * une transformation 2D réécrite à chaque image, sans couche à part) ; opacité et
 * échelle (transform: scale) seulement pour l'apparition. Rien sur écran tactile (ni survol ni
 * démonstration), rien d'automatique avec « Réduire les animations » (la carte
 * suit alors le pointeur sans retard), tout reste lisible sans JavaScript : ce
 * sont des liens ordinaires. La carte est décorative (aria-hidden) : le texte du
 * lien dit déjà où il mène ; au clavier, elle s'affiche sous le lien qui a le
 * focus, le suit quand la page défile (et se cache s'il sort de l'écran), et
 * Échap la ferme, au clavier comme à la souris.
 *
 * Les photos sont celles de la galerie des métiers (lib/landing/photos.ts), passées
 * par la page serveur ; elles ne se chargent qu'à l'approche de la rangée.
 */

export interface TradePhoto {
  src: string
  width: number
  height: number
}

export interface TradeItem {
  slug: string
  label: string
  photo: TradePhoto | null
  /** Cadrage de la photo dans la carte (object-position), pour garder le sujet. */
  focus?: string
}

const ICONS: Record<string, LucideIcon> = {
  electricien: PlugZap,
  plombier: Droplets,
  macon: BrickWall,
  peintre: PaintRoller,
  carreleur: Grid3x3,
  menuisier: Hammer,
  couvreur: House,
}

const STAGGER = ["", "lp-d1", "lp-d2", "lp-d3"]

/** Part de la rangée à l'écran pour lancer la démonstration. */
const DEMO_RATIO = 0.85
/** Délai avant de cacher la carte quand le pointeur quitte un lien (passer d'un métier au suivant sans clignoter). */
const HIDE_DELAY = 90
/** Durée pendant laquelle la carte du focus clavier est replacée à chaque image : l'apparition du lien (data-reveal) le décale. */
const SETTLE_MS = 1200
/** Sous cette ordonnée, le lien est sous l'en-tête fixe : la démonstration ne se joue pas pour rien. */
const DEMO_TOP = 74

/* ─────────────────────────────────────────────────────────
   Moteur : position de la carte (suit le pointeur avec un léger
   retard), souris de démonstration. Impératif : une transformation
   par image, sans repasser par React.
───────────────────────────────────────────────────────── */
interface Ui {
  shown(v: boolean): void
  active(i: number): void
  demo(v: boolean): void
}

interface Deps {
  link(i: number): HTMLElement | null
  layer(): HTMLElement | null
  cursor(): HTMLElement | null
  ui: Ui
  reduced(): boolean
}

export function createEngine(d: Deps) {
  let raf = 0
  let last = 0
  const pos = { x: 0, y: 0 }
  const aim = { x: 0, y: 0 }
  /** La carte est à l'écran : sinon elle se pose directement sur sa cible, sans voler depuis l'ancienne place. */
  let visible = false
  let hover = -1
  let focus = -1
  /** Échap : la carte reste fermée tant que le pointeur ou le focus ne change pas de métier. */
  let dismissed = false
  /** Jusqu'à cet instant, la carte du focus clavier est replacée à chaque image (le lien bouge pendant son apparition). */
  let settleUntil = 0
  let demoStart: number | null = null
  let demoHover = false
  let hideTimer: ReturnType<typeof setTimeout> | undefined

  const setVisible = (v: boolean) => {
    visible = v
    d.ui.shown(v)
  }

  const write = () => {
    const layer = d.layer()
    if (layer) layer.style.transform = `translate(${Math.round(pos.x * 10) / 10}px, ${Math.round(pos.y * 10) / 10}px)`
  }

  const place = (cx: number, cy: number) => {
    const layer = d.layer()
    const w = layer?.offsetWidth || 220
    const h = layer?.offsetHeight || 196
    const p = placeCard(cx, cy, w, h, window.innerWidth, window.innerHeight)
    const first = !visible
    aim.x = p.x
    aim.y = p.y
    if (first) {
      pos.x = p.x
      pos.y = p.y
      write()
    }
  }

  /**
   * Focus clavier : la carte se pose sous le lien, dont la position est relue à
   * chaque appel (la page défile pour amener le lien, son apparition le décale).
   * Lien hors de l'écran : pas de carte flottante sans lien.
   */
  const placeAtFocus = () => {
    const link = d.link(focus)
    if (!link) return
    const box = link.getBoundingClientRect()
    if (box.bottom < 0 || box.top > window.innerHeight) {
      if (visible) setVisible(false)
      return
    }
    if (dismissed) return
    d.ui.active(focus)
    place(box.left + 12, box.bottom - 14)
    if (!visible) setVisible(true)
  }

  const frame = () => {
    raf = 0
    const now = performance.now()
    const dt = Math.min(64, now - last)
    last = now
    const settling = focus >= 0 && hover < 0 && demoStart === null && now < settleUntil
    if (settling) placeAtFocus()
    if (demoStart !== null) stepDemo(now)
    const k = d.reduced() ? 1 : 1 - Math.exp(-dt / 110)
    pos.x += (aim.x - pos.x) * k
    pos.y += (aim.y - pos.y) * k
    write()
    const moving = Math.abs(aim.x - pos.x) > 0.4 || Math.abs(aim.y - pos.y) > 0.4
    if (!moving) {
      // Arrivée : on se pose exactement sur la cible, pas à 0,4 px près
      pos.x = aim.x
      pos.y = aim.y
      write()
    }
    if (demoStart !== null || moving || settling) raf = requestAnimationFrame(frame)
  }

  const kick = () => {
    if (raf) return
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }

  const stepDemo = (now: number) => {
    const link = d.link(0)
    const t = now - (demoStart ?? now)
    const box = link?.getBoundingClientRect()
    // Fin du temps, ou lien tout à fait hors de vue (sous l'en-tête fixe, sous le bord bas) : la démonstration s'arrête
    if (!box || t >= DEMO_MS || box.bottom < DEMO_TOP || box.top > window.innerHeight) {
      stop()
      return
    }
    const f = demoFrame(t, box)
    const cursor = d.cursor()
    if (cursor) {
      cursor.style.transform = `translate(${Math.round(f.x - 3)}px, ${Math.round(f.y - 3)}px)`
      cursor.style.opacity = String(Math.round(f.opacity * 100) / 100)
    }
    const over = f.opacity > 0.5 && inside(box, f.x, f.y, 4)
    if (over) {
      if (!demoHover) {
        demoHover = true
        d.ui.active(0)
        place(f.x, f.y)
        setVisible(true)
      } else {
        place(f.x, f.y)
      }
    } else if (demoHover) {
      demoHover = false
      if (hover < 0 && focus < 0) setVisible(false)
    }
  }

  const stop = () => {
    if (demoStart === null) return
    demoStart = null
    const cursor = d.cursor()
    if (cursor) cursor.style.opacity = "0"
    d.ui.demo(false)
    if (demoHover && hover < 0 && focus < 0) setVisible(false)
    demoHover = false
  }

  /** Le pointeur a quitté un lien : la carte se cache, ou revient au lien qui a toujours le focus clavier. */
  const hideSoon = () => {
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      if (hover >= 0 || demoHover) return
      if (focus >= 0) {
        placeAtFocus()
        kick()
      } else {
        setVisible(false)
      }
    }, HIDE_DELAY)
  }

  /** Défilement ou redimensionnement : la carte du focus clavier suit son lien. */
  const onViewport = () => {
    if (focus < 0 || hover >= 0 || demoStart !== null) return
    placeAtFocus()
    kick()
  }

  const dismiss = () => {
    if (!visible) return
    dismissed = true
    setVisible(false)
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") dismiss()
  }

  window.addEventListener("scroll", onViewport, { passive: true })
  window.addEventListener("resize", onViewport, { passive: true })
  window.addEventListener("keydown", onKey)

  return {
    /** Le pointeur entre sur le métier `i` (souris). */
    enter(i: number, x: number, y: number) {
      stop()
      if (hideTimer) clearTimeout(hideTimer)
      hover = i
      dismissed = false
      d.ui.active(i)
      place(x, y)
      setVisible(true)
      kick()
    },
    move(x: number, y: number) {
      if (hover < 0 || dismissed) return
      place(x, y)
      kick()
    },
    leave(i: number) {
      if (hover === i) hover = -1
      hideSoon()
    },
    /** Focus clavier : la carte se pose sous le lien et le suit. */
    focus(i: number) {
      if (!d.link(i)) return
      stop()
      if (hideTimer) clearTimeout(hideTimer)
      focus = i
      dismissed = false
      settleUntil = performance.now() + SETTLE_MS
      // Pose directe sous le lien (pas de glissement depuis l'ancienne place) ; le masquer puis le montrer dans le même tour ne clignote pas
      setVisible(false)
      placeAtFocus()
      kick()
    },
    blur(i: number) {
      if (focus === i) focus = -1
      hideSoon()
    },
    start() {
      if (d.reduced() || demoStart !== null || hover >= 0 || focus >= 0) return
      demoStart = performance.now()
      d.ui.demo(true)
      kick()
    },
    stop,
    dismiss,
    destroy() {
      stop()
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      if (hideTimer) clearTimeout(hideTimer)
      window.removeEventListener("scroll", onViewport)
      window.removeEventListener("resize", onViewport)
      window.removeEventListener("keydown", onKey)
    },
  }
}

type Engine = ReturnType<typeof createEngine>

/* ─────────────────────────────────────────────────────────
   Carte et souris de démonstration (hors de la page : portail
   sur <body>, hors de tout parent transformé)
───────────────────────────────────────────────────────── */
function Floating({
  items,
  armed,
  shown,
  active,
  layerRef,
  cursorRef,
}: {
  items: TradeItem[]
  armed: boolean
  shown: boolean
  active: number
  layerRef: React.RefObject<HTMLDivElement>
  cursorRef: React.RefObject<HTMLDivElement>
}) {
  return createPortal(
    <>
      <div ref={layerRef} aria-hidden className="pointer-events-none fixed left-0 top-0 z-[80]">
        <div
          className={cn(
            "w-[208px] rounded-[16px] border border-q-line bg-q-surface p-1.5 shadow-[shadow:var(--q-shadow-pop)] transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none",
            shown ? "scale-100 opacity-100" : "scale-95 opacity-0",
          )}
        >
          {/* Une couche par métier dans la même cellule : on passe de l'une à l'autre en fondu, la carte garde sa taille */}
          <div className="grid">
            {items.map((t, i) => (
              <div
                key={t.slug}
                className={cn(
                  "col-start-1 row-start-1 transition-opacity duration-150 motion-reduce:transition-none",
                  i === active ? "opacity-100" : "opacity-0",
                )}
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-[11px] bg-q-bg">
                  {armed && t.photo ? (
                    <Image
                      src={t.photo.src}
                      alt=""
                      fill
                      sizes="196px"
                      className="object-cover"
                      style={{ objectPosition: t.focus ?? "50% 50%" }}
                    />
                  ) : null}
                </div>
                <p className="flex items-center justify-between gap-2 px-1.5 pb-1 pt-2.5 text-[13px] font-semibold leading-none text-q-ink-strong">
                  {t.label}
                  <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-q-accent-strong">
                    Voir la page
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Souris de démonstration : pleine opacité imposée par le moteur, qui l'écrit à chaque image */}
      <div
        ref={cursorRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[81] opacity-0 transition-opacity duration-300 motion-reduce:transition-none"
      >
        <MousePointer2 className="h-6 w-6 fill-q-ink-strong stroke-q-surface" strokeWidth={1.5} />
      </div>
    </>,
    document.body,
  )
}

/** Focus venu du clavier (et non d'un clic) ; faux si le navigateur ne connaît pas :focus-visible. */
function keyboardFocus(el: HTMLElement): boolean {
  try {
    return el.matches(":focus-visible")
  } catch {
    return false
  }
}

/* ─────────────────────────────────────────────────────────
   La rangée
───────────────────────────────────────────────────────── */
export function TradesStripLive({ items }: { items: TradeItem[] }) {
  const reduced = usePrefersReducedMotion()
  const reducedRef = useRef(false)
  const ulRef = useRef<HTMLUListElement>(null)
  const links = useRef<(HTMLAnchorElement | null)[]>([])
  const layerRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const engine = useRef<Engine | null>(null)
  /** Le visiteur a déjà survolé un métier : plus besoin de lui montrer le geste. */
  const learned = useRef(false)

  /** Souris fine seulement : ni survol ni démonstration au doigt. */
  const [fine, setFine] = useState(false)
  const [armed, setArmed] = useState(false)
  const [shown, setShown] = useState(false)
  const [active, setActive] = useState(0)
  const [demo, setDemo] = useState(false)

  useEffect(() => {
    reducedRef.current = reduced
    // « Réduire les animations » activé pendant la démonstration : elle s'arrête
    if (reduced) engine.current?.stop()
  }, [reduced])

  useEffect(() => {
    setFine(window.matchMedia("(hover: hover) and (pointer: fine)").matches)
  }, [])

  useEffect(() => {
    if (!fine) return
    const e = createEngine({
      link: (i) => links.current[i] ?? null,
      layer: () => layerRef.current,
      cursor: () => cursorRef.current,
      ui: { shown: setShown, active: setActive, demo: setDemo },
      reduced: () => reducedRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    })
    engine.current = e

    const ul = ulRef.current
    const observers: IntersectionObserver[] = []
    if (ul && "IntersectionObserver" in window) {
      // Les photos se chargent à l'approche de la rangée, pas avant
      const near = new IntersectionObserver(([en]) => en.isIntersecting && setArmed(true), { rootMargin: "150px 0px" })
      near.observe(ul)
      // La démonstration part quand presque toute la rangée est à l'écran, et s'arrête quand elle en sort
      const view = new IntersectionObserver(
        ([en]) => {
          if (!en.isIntersecting) e.stop()
          else if (en.intersectionRatio >= DEMO_RATIO && !learned.current) e.start()
        },
        // Marges de la zone vue : l'en-tête fixe en haut, 8 % en bas (là où l'apparition des liens, data-reveal, n'a pas encore eu lieu)
        { threshold: [0, DEMO_RATIO], rootMargin: "-80px 0px -8% 0px" },
      )
      view.observe(ul)
      observers.push(near, view)
    } else {
      setArmed(true)
    }

    const stopOnPress = () => e.stop()
    window.addEventListener("pointerdown", stopOnPress)
    return () => {
      window.removeEventListener("pointerdown", stopOnPress)
      observers.forEach((o) => o.disconnect())
      e.destroy()
      engine.current = null
    }
  }, [fine])

  return (
    <>
      <ul ref={ulRef} className="mt-7 flex flex-wrap justify-center gap-y-6">
        {items.map(({ label, slug }, i) => {
          const Icon = ICONS[slug] ?? House
          return (
            <li key={slug} data-reveal="" className={cn("flex w-1/2 justify-center sm:w-1/4 lg:w-auto lg:flex-1", STAGGER[i % STAGGER.length])}>
              <Link
                ref={(el) => {
                  links.current[i] = el
                }}
                href={`/facturation/${slug}`}
                data-on={demo && i === 0 ? "true" : undefined}
                onPointerEnter={(ev) => {
                  if (ev.pointerType !== "mouse") return
                  learned.current = true
                  setArmed(true)
                  engine.current?.enter(i, ev.clientX, ev.clientY)
                }}
                onPointerMove={(ev) => {
                  if (ev.pointerType === "mouse") engine.current?.move(ev.clientX, ev.clientY)
                }}
                onPointerLeave={(ev) => {
                  if (ev.pointerType === "mouse") engine.current?.leave(i)
                }}
                onFocus={(ev) => {
                  if (keyboardFocus(ev.currentTarget)) {
                    setArmed(true)
                    engine.current?.focus(i)
                  }
                }}
                onBlur={() => engine.current?.blur(i)}
                className="inline-flex items-center gap-2.5 font-display text-[17px] font-semibold tracking-[-0.02em] text-q-text-4 transition-colors hover:text-q-accent-strong data-[on=true]:text-q-accent-strong"
              >
                <Icon className="h-[22px] w-[22px] shrink-0" strokeWidth={1.75} aria-hidden />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
      {fine ? <Floating items={items} armed={armed} shown={shown} active={active} layerRef={layerRef} cursorRef={cursorRef} /> : null}
    </>
  )
}
