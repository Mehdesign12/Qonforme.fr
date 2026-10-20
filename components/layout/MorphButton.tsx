"use client"

/**
 * Bouton central de la barre mobile : « + » (créer) ou « Envoyer » dans un
 * éditeur de document. Le passage de l'un à l'autre est une goutte : le bouton
 * se resserre en gouttelette plus haute que large, puis s'étale en pilule
 * (ressorts sur la largeur et la hauteur, rebond léger). Pas de filtre « goo »,
 * pas de backdrop-filter, pas de will-change (règle iOS) : largeur, hauteur et
 * rayon, calculés image par image sur des éléments dont la place est fixe (la
 * case de 132 px ne bouge jamais, les onglets restent immobiles).
 * Avec « Réduire les animations », la bascule est immédiate.
 */
import { useEffect, useRef } from "react"
import { Loader2, Plus, Send } from "lucide-react"
import type { EditorAction } from "@/lib/ui/editor-action"

const ROUND = { w: 52, h: 52 }
const PILL = { w: 124, h: 52 }
const DROP = { w: 40, h: 60 }

interface Sim { w: number; h: number; vw: number; vh: number; tw: number; th: number }

export function MorphButton({
  action,
  onCreate,
}: {
  action: EditorAction | null
  onCreate: () => void
}) {
  const on = action !== null
  const btn = useRef<HTMLButtonElement>(null)
  const plus = useRef<HTMLSpanElement>(null)
  const send = useRef<HTMLSpanElement>(null)
  const sim = useRef<Sim>({ w: ROUND.w, h: ROUND.h, vw: 0, vh: 0, tw: ROUND.w, th: ROUND.h })
  const raf = useRef(0)
  const last = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const first = useRef(true)

  function paint() {
    const s = sim.current
    const b = btn.current, p = plus.current, e = send.current
    if (!b || !p || !e) return
    const k = Math.max(0, Math.min(1, (s.w - ROUND.w) / (PILL.w - ROUND.w - 8)))
    const plusOp = Math.max(0, 1 - k * 2.4)
    const sendOp = Math.max(0, Math.min(1, (k - 0.5) * 2.4))
    b.style.width = `${s.w.toFixed(2)}px`
    b.style.height = `${s.h.toFixed(2)}px`
    b.style.borderRadius = `${(s.h / 2).toFixed(2)}px`
    p.style.opacity = plusOp.toFixed(3)
    p.style.transform = `rotate(${(k * 135).toFixed(1)}deg) scale(${(1 - k * 0.5).toFixed(3)})`
    e.style.opacity = sendOp.toFixed(3)
    e.style.transform = `translateY(${((1 - sendOp) * 7).toFixed(2)}px)`
  }

  function tick(t: number) {
    const s = sim.current
    const dt = Math.min(0.032, last.current ? (t - last.current) / 1000 : 0.016)
    last.current = t
    // largeur souple (léger rebond), hauteur plus raide
    s.vw += (190 * (s.tw - s.w) - 17 * s.vw) * dt
    s.w += s.vw * dt
    s.vh += (300 * (s.th - s.h) - 22 * s.vh) * dt
    s.h += s.vh * dt
    paint()
    const still = Math.abs(s.tw - s.w) < 0.15 && Math.abs(s.th - s.h) < 0.15 && Math.abs(s.vw) < 1 && Math.abs(s.vh) < 1
    if (still) {
      s.w = s.tw; s.h = s.th; s.vw = 0; s.vh = 0
      paint()
      raf.current = 0
    } else {
      raf.current = requestAnimationFrame(tick)
    }
  }

  function aim(w: number, h: number) {
    sim.current.tw = w
    sim.current.th = h
    if (!raf.current) {
      last.current = 0
      raf.current = requestAnimationFrame(tick)
    }
  }

  useEffect(() => {
    const target = on ? PILL : ROUND
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    clearTimeout(timer.current)
    if (reduce || first.current) {
      first.current = false
      cancelAnimationFrame(raf.current)
      raf.current = 0
      Object.assign(sim.current, { w: target.w, h: target.h, vw: 0, vh: 0, tw: target.w, th: target.h })
      paint()
      return
    }
    // 1. la goutte se forme, 2. elle s'étale (ou se rétracte en rond)
    aim(on ? DROP.w : DROP.w, on ? DROP.h : 58)
    timer.current = setTimeout(() => aim(target.w, target.h), on ? 170 : 150)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on])

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current)
      clearTimeout(timer.current)
    },
    [],
  )

  const layer = "absolute inset-0 flex items-center justify-center gap-2 whitespace-nowrap text-base font-semibold"
  return (
    <div className="flex h-[60px] w-[132px] shrink-0 items-center justify-center">
      <button
        ref={btn}
        type="button"
        onClick={() => (action ? action.onSend() : onCreate())}
        disabled={action ? action.disabled : false}
        aria-label={action ? action.label : "Créer un document"}
        aria-haspopup={action ? undefined : "dialog"}
        className="relative shrink-0 overflow-hidden bg-[var(--q-accent)] p-0 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_8px_18px_-6px_rgba(37,99,235,.7)] touch-manipulation disabled:opacity-60"
        style={{ width: ROUND.w, height: ROUND.h, borderRadius: ROUND.h / 2 }}
      >
        <span ref={plus} className={layer} aria-hidden>
          <Plus className="size-6" strokeWidth={2.25} />
        </span>
        <span ref={send} className={layer} style={{ opacity: 0 }} aria-hidden>
          {action?.sending ? <Loader2 className="size-[18px] animate-spin" /> : <Send className="size-[18px]" strokeWidth={2} />}
          Envoyer
        </span>
      </button>
    </div>
  )
}
