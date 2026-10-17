"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
import { IPhone, MacBook, SCREENS, type ScreenProps } from "@/components/landing/devices"
import { cn } from "@/lib/utils"

/**
 * Carrousels animés de l'accueil (demande du fondateur, 17/10/2026) : les vraies
 * captures du produit (pages de démo, données d'exemple) qui défilent seules.
 *
 *  - défilement automatique toutes les 5,5 s, rythmé par la barre de progression
 *    de l'onglet actif (une animation CSS : sa fin passe à l'écran suivant) ;
 *  - en pause hors de l'écran, au survol, au clavier dans le carrousel, et par
 *    le bouton Pause (WCAG 2.2.2) ;
 *  - « Réduire les animations » : aucun défilement automatique ni mouvement,
 *    les onglets et les flèches restent ;
 *  - glisser au doigt (touch-action: pan-y, le défilement vertical reste libre) ;
 *  - opacité et transformations seulement, ni backdrop-filter ni will-change
 *    (règle iOS de CLAUDE.md).
 */

const INTERVAL_MS = 5500
const EASE = "cubic-bezier(.22,1,.36,1)"

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return reduced
}

/**
 * État commun : écran actif, lecture (bouton), visibilité, survol et focus.
 * `running` dit si la barre de progression avance.
 */
function useCarousel(count: number) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const el = rootRef.current
    if (!el || !("IntersectionObserver" in window)) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const go = useCallback((i: number) => setActive(((i % count) + count) % count), [count])
  const next = useCallback(() => setActive((a) => (a + 1) % count), [count])
  const prev = useCallback(() => setActive((a) => (a - 1 + count) % count), [count])

  const autoplay = playing && !reduced
  const running = autoplay && visible && !hovered && !focused

  // Glisser au doigt ou à la souris : 40 px suffisent, le défilement vertical reste libre
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const handlers = {
    onPointerEnter: (e: React.PointerEvent) => e.pointerType === "mouse" && setHovered(true),
    onPointerLeave: () => setHovered(false),
    onPointerDown: (e: React.PointerEvent) => {
      swipe.current = { x: e.clientX, y: e.clientY }
    },
    onPointerUp: (e: React.PointerEvent) => {
      const start = swipe.current
      swipe.current = null
      if (!start) return
      const dx = e.clientX - start.x
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - start.y)) (dx < 0 ? next : prev)()
    },
    onPointerCancel: () => {
      swipe.current = null
    },
    // Pause au clavier seulement : un clic qui laisse le focus sur un onglet ne fige pas le carrousel
    onFocus: (e: React.FocusEvent) => {
      if ((e.target as HTMLElement).matches?.(":focus-visible")) setFocused(true)
    },
    onBlur: (e: React.FocusEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
    },
  }

  return { rootRef, active, go, next, prev, playing, setPlaying, autoplay, running, reduced, handlers }
}

/** Barre de progression de l'onglet actif : sa fin passe à l'écran suivant. */
function Progress({ on, running, autoplay, onDone, tone }: { on: boolean; running: boolean; autoplay: boolean; onDone: () => void; tone: "light" | "dark" }) {
  return (
    <span aria-hidden className={cn("absolute inset-x-0 bottom-0 h-[2px] overflow-hidden rounded-full", tone === "dark" ? "bg-white/15" : "bg-q-line")}>
      {on && (
        <span
          className={cn("lp-progress-fill absolute inset-0 origin-left", tone === "dark" ? "bg-white" : "bg-q-accent")}
          style={
            autoplay
              ? { animationDuration: `${INTERVAL_MS}ms`, animationPlayState: running ? "running" : "paused" }
              : { animation: "none" }
          }
          onAnimationEnd={onDone}
        />
      )}
    </span>
  )
}

function PlayPause({ playing, onToggle, tone }: { playing: boolean; onToggle: () => void; tone: "light" | "dark" }) {
  const Icon = playing ? Pause : Play
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={playing ? "Mettre le défilement en pause" : "Reprendre le défilement"}
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        tone === "dark"
          ? "border-white/20 text-white hover:border-white/40 focus-visible:outline-white"
          : "border-q-line bg-q-surface text-q-ink-strong hover:border-q-field focus-visible:outline-q-accent",
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
    </button>
  )
}

/* ─────────────────────────────────────────────────────────
   Téléphones en carrousel : l'écran actif au centre, ses voisins
   en retrait de chaque côté, le dernier caché derrière
───────────────────────────────────────────────────────── */
const PHONE_SLIDES: { label: string; text: string; screen: ScreenProps }[] = [
  { label: "Accueil", text: "À encaisser, en retard, à faire : l'essentiel d'un coup d'œil.", screen: { ...SCREENS.mobileTableauDeBord, sizes: "" } },
  { label: "Devis", text: "Chiffré devant le client, envoyé avant de partir.", screen: { ...SCREENS.mobileDevis, sizes: "" } },
  { label: "Facture", text: "Envoyée par email avec votre IBAN, relancée si besoin.", screen: { ...SCREENS.mobileFacture, sizes: "" } },
  { label: "Factures", text: "Chaque facture avec son statut : envoyée, payée, en retard.", screen: { ...SCREENS.mobileFactures, sizes: "" } },
]

/** Position d'un téléphone selon son écart avec l'écran actif (−1 à gauche, 0 au centre, +1 à droite, 2 derrière). */
function phoneStyle(offset: number): React.CSSProperties {
  if (offset === 0) return { transform: "translateX(0) scale(1)", opacity: 1, zIndex: 3 }
  if (Math.abs(offset) === 1) return { transform: `translateX(${offset * 74}%) scale(.8)`, opacity: 0.4, zIndex: 2 }
  return { transform: "translateX(0) scale(.6)", opacity: 0, zIndex: 1 }
}

export function PhoneCarousel() {
  const n = PHONE_SLIDES.length
  const c = useCarousel(n)
  return (
    <div
      ref={c.rootRef}
      role="group"
      aria-roledescription="carrousel"
      aria-label="Qonforme sur téléphone"
      className="mx-auto w-full max-w-[560px]"
      {...c.handlers}
    >
      <div className="relative grid touch-pan-y select-none justify-items-center [&_img]:pointer-events-none">
        {PHONE_SLIDES.map((s, i) => {
          let offset = (i - c.active + n) % n
          if (offset > n / 2) offset -= n
          const on = offset === 0
          return (
            // Les onglets servent au clavier ; un clic sur un téléphone voisin l'amène au centre
            <div
              key={s.label}
              aria-hidden={!on || undefined}
              onClick={() => !on && c.go(i)}
              className={cn("w-[min(250px,60%)] [grid-area:1/1] sm:w-[min(250px,52%)]", !on && "cursor-pointer")}
              style={{
                ...phoneStyle(offset),
                transition: c.reduced ? "none" : `transform .9s ${EASE}, opacity .7s ${EASE}`,
              }}
            >
              <IPhone screen={{ ...s.screen, alt: on ? s.screen.alt : "", sizes: "(min-width: 1024px) 250px, 60vw" }} />
            </div>
          )
        })}
      </div>

      <div className="mt-9 flex items-center gap-3">
        <div role="tablist" aria-label="Écrans" className="grid flex-1 grid-cols-4 gap-2.5">
          {PHONE_SLIDES.map((s, i) => {
            const on = c.active === i
            return (
              <button
                key={s.label}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => c.go(i)}
                className={cn(
                  "relative pb-3 text-left text-[13.5px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white",
                  on ? "text-white" : "text-[#8C9AB2] hover:text-[#D5DBE5]",
                )}
              >
                {s.label}
                <Progress on={on} running={c.running} autoplay={c.autoplay} onDone={c.next} tone="dark" />
              </button>
            )
          })}
        </div>
        {!c.reduced && <PlayPause playing={c.playing} onToggle={() => c.setPlaying((p) => !p)} tone="dark" />}
      </div>
      <p className="mt-4 min-h-[48px] text-[15px] leading-[1.55] text-[#AFBDD3]" aria-live={c.running ? "off" : "polite"}>
        {PHONE_SLIDES[c.active].text}
      </p>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   Écran de l'ordinateur en carrousel : le devis, la facture,
   le suivi. Sur téléphone, les mêmes écrans dans un iPhone.
───────────────────────────────────────────────────────── */
const SCREEN_SLIDES: { n: string; label: string; text: string; desk: (typeof SCREENS)[keyof typeof SCREENS]; mobile: (typeof SCREENS)[keyof typeof SCREENS] }[] = [
  { n: "01", label: "Le devis", text: "Vos prestations depuis le catalogue, la TVA ligne par ligne, l'aperçu PDF à un clic.", desk: SCREENS.devis, mobile: SCREENS.mobileDevis },
  { n: "02", label: "La facture", text: "Le devis accepté devient facture en un clic, numérotée à la suite.", desk: SCREENS.facture, mobile: SCREENS.mobileFacture },
  { n: "03", label: "Le suivi", text: "Envoyée, payée, en retard : chaque facture avec son statut.", desk: SCREENS.factures, mobile: SCREENS.mobileFactures },
]

function Stack({ slides, active, sizes, reduced }: { slides: (typeof SCREEN_SLIDES)[number]["desk"][]; active: number; sizes: string; reduced: boolean }) {
  return (
    <>
      {slides.map((screen, i) => {
        const on = active === i
        return (
          <div
            key={screen.src}
            aria-hidden={!on}
            className="absolute inset-0"
            style={{
              opacity: on ? 1 : 0,
              transform: on ? "none" : "scale(1.035)",
              transition: reduced ? "none" : `opacity .8s ${EASE}, transform 1.2s ${EASE}`,
            }}
          >
            <Image src={screen.src} alt={on ? screen.alt : ""} fill sizes={sizes} loading="lazy" className="object-cover object-top" />
          </div>
        )
      })}
    </>
  )
}

export function ScreenCarousel() {
  const c = useCarousel(SCREEN_SLIDES.length)
  return (
    <div ref={c.rootRef} role="group" aria-roledescription="carrousel" aria-label="Du devis à la facture" {...c.handlers}>
      <div className="touch-pan-y select-none [&_img]:pointer-events-none">
        <MacBook className="hidden sm:block">
          <Stack slides={SCREEN_SLIDES.map((s) => s.desk)} active={c.active} sizes="(min-width: 1088px) 1040px, 92vw" reduced={c.reduced} />
        </MacBook>
        <div className="relative mx-auto w-[min(290px,74%)] sm:hidden">
          <IPhone>
            <Stack slides={SCREEN_SLIDES.map((s) => s.mobile)} active={c.active} sizes="290px" reduced={c.reduced} />
          </IPhone>
          <button
            type="button"
            onClick={c.prev}
            aria-label="Écran précédent"
            className="absolute left-[-52px] top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-q-line bg-q-surface text-q-ink-strong"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={c.next}
            aria-label="Écran suivant"
            className="absolute right-[-52px] top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-q-line bg-q-surface text-q-ink-strong"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-[900px] items-start gap-4">
        <div role="tablist" aria-label="Étapes" className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          {SCREEN_SLIDES.map((s, i) => {
            const on = c.active === i
            return (
              <button
                key={s.n}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => c.go(i)}
                className={cn(
                  "relative flex flex-col gap-1.5 pb-4 text-left transition-opacity duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-q-accent",
                  on ? "opacity-100" : "opacity-[.55] hover:opacity-80",
                  !on && "max-sm:hidden",
                )}
              >
                <span className="flex items-baseline gap-2.5">
                  <span className="font-mono text-[12px] text-q-accent-strong">{s.n}</span>
                  <span className="text-[16px] font-semibold text-q-ink-strong">{s.label}</span>
                </span>
                <span className="text-[14.5px] leading-[1.55] text-q-text-3">{s.text}</span>
                <Progress on={on} running={c.running} autoplay={c.autoplay} onDone={c.next} tone="light" />
              </button>
            )
          })}
        </div>
        {!c.reduced && <PlayPause playing={c.playing} onToggle={() => c.setPlaying((p) => !p)} tone="light" />}
      </div>
    </div>
  )
}
