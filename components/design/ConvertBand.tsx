"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowRight, Check, FilePen, MousePointer2, ReceiptText, RotateCcw, Send } from "lucide-react"

import { CheckList, D_WRAP, SIGNUP_HREF } from "@/components/design/kit"
import { usePrefersReducedMotion } from "@/components/landing/carousels"
import { PLANS } from "@/lib/stripe/plans"
import { cn } from "@/lib/utils"

/**
 * Bandeau « Du devis accepté à la facture envoyée » de la variante B de
 * l'accueil (/design). Il tient la place du bandeau de signature électronique
 * de la page de référence : la signature en ligne n'est pas encore vendue
 * (« à venir » dans lib/stripe/plans.ts), le passage du devis à la facture l'est.
 *
 * La carte joue le vrai parcours quand elle entre à l'écran : le pointeur clique
 * « Convertir en facture » sur le devis accepté, une facture en brouillon apparaît
 * (à relire, comme dans l'application), puis le pointeur clique « Envoyer par
 * email » ; la facture passe à « Envoyée » et un ✓
 * se trace, avec quelques étincelles, une seule fois. Elle se rejoue à chaque
 * retour à l'écran et par le bouton « Rejouer ».
 *
 * Données d'exemple de la démo (devis accepté), passées par la page serveur :
 * ce composant client n'embarque pas lib/demo. Aucun numéro de facture inventé.
 *
 * Sûr par défaut : le rendu serveur, l'absence de JavaScript et « Réduire les
 * animations » montrent l'état final (facture envoyée, ✓ tracé), sans lecture
 * automatique ni bouton « Rejouer ». Opacité, translate, scale et trait du ✓
 * (stroke-dashoffset, classes dz-* de app/globals.css) seulement ; ni
 * backdrop-filter ni will-change, rien d'infini (règle iOS de CLAUDE.md).
 *
 * Le bandeau et la carte (un document papier) gardent les mêmes couleurs dans
 * les deux thèmes.
 */

export interface ConvertBandData {
  /** « D-2026-033 ». */
  quoteNumber: string
  clientName: string
  /** Déjà formaté : « 4 024,30 € ». */
  totalTtc: string
  /** Les trois premières lignes, montant HT formaté. */
  lines: { label: string; amount: string }[]
}

/*
 * Repères de la scène (ms) : 1 le pointeur rejoint « Convertir » · 2 clic ·
 * 3 la facture en brouillon · 4 le pointeur rejoint « Envoyer » · 5 clic ·
 * 6 la facture envoyée (état final).
 */
const MARKS = [900, 1500, 1800, 2700, 3300, 3600] as const
const FINAL = MARKS.length
const DRAFT = 3
/** Part de la carte à l'écran pour lancer la scène. */
const THRESHOLD = 0.45
const EASE = "ease-[cubic-bezier(.22,1,.36,1)]"

/** Une des couches superposées d'une zone qui bascule (même cellule de grille : hauteur stable). */
const layer = (on: boolean, hidden: string) =>
  cn(
    "col-start-1 row-start-1 transition-[opacity,transform] duration-500 motion-reduce:transition-none",
    EASE,
    on ? "translate-y-0 scale-100 opacity-100" : cn("pointer-events-none opacity-0", hidden),
  )

/* ─────────────────────────────────────────────────────────
   Le ✓ tracé, ses étincelles (une seule fois par scène)
───────────────────────────────────────────────────────── */
// Longueurs des tracés (légèrement arrondies au-dessus) : cercle r = 25 (2π × 25 ≈ 157,1), coche ≈ 29,4
const CIRCLE_LEN = 158
const TICK_LEN = 30
const SPARKS = [0, 45, 90, 135, 180, 225, 270, 315] as const

type CssVars = React.CSSProperties & Record<`--${string}`, string>

function SentCheck({ play }: { play: boolean }) {
  return (
    <span data-play={play ? "on" : undefined} aria-hidden className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 56 56" className="h-14 w-14" fill="none">
        <circle cx="28" cy="28" r="25" fill="#ECFDF5" />
        <circle
          cx="28"
          cy="28"
          r="25"
          stroke="#059669"
          strokeWidth="2.5"
          strokeLinecap="round"
          transform="rotate(-90 28 28)"
          className="dz-draw"
          style={{ "--dz-len": String(CIRCLE_LEN), "--dz-delay": "0s" } as CssVars}
        />
        <path
          d="M18 28.5 L25 35.5 L38.5 21.5"
          stroke="#059669"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="dz-draw"
          style={{ "--dz-len": String(TICK_LEN), "--dz-delay": ".3s" } as CssVars}
        />
      </svg>
      {/* Étincelles : le pied de chaque trait est au centre du ✓, la rotation les répartit tout autour */}
      {SPARKS.map((a, i) => (
        <span
          key={a}
          className="dz-spark absolute bottom-1/2 left-1/2 -ml-[1.5px] h-[22px] w-[3px]"
          style={{ "--dz-a": `${a}deg`, "--dz-delay": ".8s" } as CssVars}
        >
          <span className={cn("absolute inset-x-0 top-0 h-2 rounded-full", i % 2 ? "bg-[#2563EB]" : "bg-[#10B981]")} />
        </span>
      ))}
    </span>
  )
}

/* ─────────────────────────────────────────────────────────
   En-tête et bouton d'une étape
───────────────────────────────────────────────────────── */
function DocHeader({ title, sub, mono = false, pill }: { title: string; sub: string; mono?: boolean; pill: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="font-display text-[22px] font-semibold leading-none tracking-[-0.02em]">{title}</p>
        <p className={cn("mt-2 text-[12.5px] text-[#64748B]", mono && "font-mono")}>{sub}</p>
      </div>
      {pill}
    </div>
  )
}

const PILL = "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold"

/** Bouton de la carte, avec le pointeur qui le rejoint puis clique. */
function SceneButton({
  icon: Icon, label, cursor, pressed,
}: {
  icon: typeof ReceiptText
  label: string
  cursor: boolean
  pressed: boolean
}) {
  return (
    <div className="relative">
      <span
        className={cn(
          "relative flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] text-[15px] font-semibold text-white transition-transform duration-150 motion-reduce:transition-none",
          pressed ? "scale-[.96]" : "scale-100",
        )}
      >
        <span
          className={cn(
            "absolute inset-0 rounded-xl shadow-[0_0_0_6px_rgba(37,99,235,.25)] transition-opacity duration-150 motion-reduce:transition-none",
            pressed ? "opacity-100" : "opacity-0",
          )}
        />
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        {label}
      </span>
      <span
        className={cn(
          "pointer-events-none absolute left-[62%] top-[55%] z-10 transition-[transform,opacity] duration-[550ms] ease-out motion-reduce:transition-none",
          cursor ? "translate-x-0 translate-y-0 opacity-100" : "translate-x-10 translate-y-8 opacity-0",
          pressed && "scale-[.82]",
        )}
      >
        <MousePointer2 className="h-6 w-6 fill-[#0A1122] stroke-white" strokeWidth={1.5} />
      </span>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   La carte : devis accepté → facture en brouillon → facture envoyée
───────────────────────────────────────────────────────── */
function DocumentCard({ data, step, play }: { data: ConvertBandData; step: number; play: boolean }) {
  const quote = step < DRAFT
  const draft = step >= DRAFT && step < FINAL
  const sent = step >= FINAL
  return (
    <>
      {/* En-tête : Devis → Facture en brouillon → Facture envoyée */}
      <div className="grid">
        <div className={layer(quote, "-translate-y-1.5")}>
          <DocHeader
            title="Devis"
            sub={data.quoteNumber}
            mono
            pill={
              <span className={cn(PILL, "bg-[#ECFDF5] text-[#047857]")}>
                <Check className="h-3 w-3" strokeWidth={2.5} />
                Accepté
              </span>
            }
          />
        </div>
        <div className={layer(draft, quote ? "translate-y-1.5" : "-translate-y-1.5")}>
          <DocHeader
            title="Facture"
            sub="À relire avant l'envoi"
            pill={
              <span className={cn(PILL, "bg-[#F1F5F9] text-[#475569]")}>
                <FilePen className="h-3 w-3" strokeWidth={2} />
                Brouillon
              </span>
            }
          />
        </div>
        <div className={layer(sent, "translate-y-1.5")}>
          <DocHeader
            title="Facture"
            sub="Numérotée à la suite des précédentes"
            pill={
              <span className={cn(PILL, "bg-[#EEF3FF] text-[#1D4ED8]")}>
                <Send className="h-3 w-3" strokeWidth={2} />
                Envoyée
              </span>
            }
          />
        </div>
      </div>

      {/* Client, lignes et total : repris tels quels */}
      <div className="mt-5 flex items-baseline justify-between gap-4 border-b border-[#E6E9F0] pb-3 text-[14px]">
        <span className="text-[#64748B]">Client</span>
        <span className="min-w-0 truncate font-semibold">{data.clientName}</span>
      </div>
      <ul className="text-[14px]">
        {data.lines.map((l, i) => (
          <li key={`${i}-${l.label}`} className="flex items-baseline justify-between gap-4 border-b border-[#EEF1F5] py-2.5">
            <span className="min-w-0 truncate text-[#334155]">{l.label}</span>
            <span className="shrink-0 font-medium tabular-nums">{l.amount}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between gap-4 pt-4">
        <span className="text-[13px] font-semibold text-[#475569]">Total TTC</span>
        <span className="font-display text-[24px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{data.totalTtc}</span>
      </div>

      {/* Pied : « Convertir » → « Envoyer par email » → envoyée, ✓ tracé */}
      <div className="mt-6 grid min-h-14 items-center">
        <div className={layer(quote, "scale-[.96]")}>
          <SceneButton icon={ReceiptText} label="Convertir en facture" cursor={step === 1 || step === 2} pressed={step === 2} />
        </div>
        <div className={layer(draft, quote ? "translate-y-2" : "scale-[.96]")}>
          <SceneButton icon={Send} label="Envoyer par email" cursor={step === 4 || step === 5} pressed={step === 5} />
        </div>
        <div className={layer(sent, "translate-y-2")}>
          <div className="flex items-center gap-5">
            <SentCheck play={play} />
            <p className="min-w-0 text-[14px] leading-[1.45] text-[#475569]">
              <span className="block text-[15px] font-semibold text-[#0F172A]">Envoyée par email</span>à {data.clientName}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────────────────
   Le bandeau
───────────────────────────────────────────────────────── */
const POINTS = [
  "Client, lignes et TVA repris tels quels",
  "Un brouillon à relire avant l'envoi",
  "Des factures numérotées à la suite",
  "PDF envoyé par email, avec votre IBAN",
]

export function ConvertBand({ data }: { data: ConvertBandData }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const armed = useRef(false)
  const reduced = usePrefersReducedMotion()
  // Rendu serveur et premier rendu : l'état final
  const [step, setStep] = useState<number>(FINAL)
  const [play, setPlay] = useState(false)
  /** La scène peut se jouer (JavaScript, mouvement permis) : le bouton « Rejouer » s'affiche. */
  const [live, setLive] = useState(false)

  const stop = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t))
    timers.current = []
  }, [])

  const run = useCallback(() => {
    stop()
    armed.current = false
    setPlay(false)
    setStep(0)
    timers.current = MARKS.map((ms, i) =>
      setTimeout(() => {
        setStep(i + 1)
        if (i + 1 === FINAL) setPlay(true)
      }, ms),
    )
  }, [stop])

  useEffect(() => {
    const el = cardRef.current
    const still = reduced || window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!el || still || !("IntersectionObserver" in window)) {
      stop()
      setLive(false)
      setStep(FINAL)
      setPlay(false)
      return
    }
    setLive(true)

    // Hors de l'écran : le devis se prépare, la scène se jouera à l'entrée
    const prepare = () => {
      stop()
      armed.current = true
      setPlay(false)
      setStep(0)
    }
    // Déjà visible à l'arrivée, même en partie : l'état final reste, rien ne bascule sous les yeux
    let first = true
    const io = new IntersectionObserver(
      ([e]) => {
        if (first) {
          first = false
          if (!e.isIntersecting) prepare()
          return
        }
        if (!e.isIntersecting) prepare()
        else if (e.intersectionRatio >= THRESHOLD && armed.current) run()
      },
      { threshold: [0, THRESHOLD] },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      stop()
    }
  }, [reduced, run, stop])

  const label = `Exemple : le devis ${data.quoteNumber} accepté par ${data.clientName}, ${data.totalTtc} TTC, est converti en facture en brouillon avec le même client et les mêmes lignes, puis la facture part par email.`

  // Ordre du document = ordre de lecture sur téléphone (texte, puis carte) ; la carte passe à gauche sur grand écran
  return (
    <section aria-labelledby="convert-title" className="lp-clip relative bg-[#1E40AF] px-6 py-[clamp(72px,8vw,112px)] text-white">
      <div className={cn(D_WRAP, "grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10")}>
        <div data-reveal="right" className="flex flex-col items-start lg:col-span-6 lg:col-start-7 lg:row-start-1 lg:pl-6">
          <p className="inline-flex h-8 items-center rounded-full border border-white/25 bg-white/10 px-3.5 text-[13px] font-semibold text-white">
            Envoi avec la formule {PLANS.starter.name}
          </p>
          <h2
            id="convert-title"
            className="mt-5 font-display text-[clamp(30px,3.2vw,44px)] font-semibold leading-[1.08] tracking-[-0.03em] text-white [text-wrap:balance]"
          >
            Du devis accepté <span className="q-serif !text-[#BFD3FF]">à la facture envoyée.</span>
          </h2>
          <p className="mt-4 max-w-[520px] text-[17px] leading-[1.6] text-[#DBE4FF] sm:text-[18px]">
            Le devis accepté devient une facture en brouillon, sans ressaisie. Vous la relisez, puis elle part par email avec votre IBAN.
          </p>
          <CheckList items={POINTS} tone="dark" className="mt-6" />
          <Link href={SIGNUP_HREF} className="lp-btn-p mt-8 focus-visible:!outline-white">
            Essayer gratuitement
            <ArrowRight className="lp-btn-arrow h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          </Link>
        </div>

        <div data-reveal="left" className="lg:col-span-6 lg:col-start-1 lg:row-start-1">
          <div className="mx-auto w-full max-w-[440px] lg:mx-0">
            <div
              ref={cardRef}
              role="img"
              aria-label={label}
              className="rounded-[20px] bg-white p-6 text-[#0F172A] shadow-[0_40px_80px_-40px_rgba(5,12,40,.6),0_14px_28px_-16px_rgba(5,12,40,.4)] sm:p-7"
            >
              <DocumentCard data={data} step={step} play={play} />
            </div>
            <div className="mt-4 flex items-center justify-between gap-4">
              <span className="text-[13px] text-[#BFD3FF]">Données d&apos;exemple</span>
              <button
                type="button"
                onClick={run}
                aria-label="Rejouer la scène : du devis à la facture envoyée"
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-[14px] font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                  !live && "invisible",
                )}
              >
                <RotateCcw className="h-4 w-4" strokeWidth={2} aria-hidden />
                Rejouer
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
