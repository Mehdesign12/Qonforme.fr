import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Monitor, type LucideIcon } from "lucide-react"
import type { LandingPhoto } from "@/lib/landing/photos"
import { cn } from "@/lib/utils"

/**
 * Briques de l'accueil, d'après le canevas « Main » v20.
 *
 * Couleurs par jetons --q-* (thème sombre compris), sauf les fonds photo et
 * le bandeau marine, identiques dans les deux thèmes. Les classes lp-*
 * (mouvement) vivent dans app/globals.css, section « Accueil ».
 */

/* ─────────────────────────────────────────────────────────
   Titre de section en deux voix : Bricolage, puis la fin en
   Instrument Serif italique bleu (.q-serif)
───────────────────────────────────────────────────────── */
export function SectionTitle({
  title,
  accent,
  sub,
  align = "left",
  tone = "light",
  className,
  as: Tag = "h2",
}: {
  title: React.ReactNode
  /** Seconde voix, en italique bleu. */
  accent?: React.ReactNode
  sub?: React.ReactNode
  align?: "left" | "center"
  /** dark : sur le bandeau marine. */
  tone?: "light" | "dark"
  className?: string
  as?: "h2" | "h3"
}) {
  return (
    <div className={cn("flex flex-col", align === "center" && "items-center text-center", className)}>
      <Tag
        className={cn(
          "lp-reveal font-display text-[clamp(32px,3.6vw,48px)] font-semibold leading-[1.08] tracking-[-0.03em] [text-wrap:balance]",
          align === "center" ? "max-w-[860px]" : "max-w-[820px]",
          tone === "dark" ? "text-white" : "text-q-ink-strong",
        )}
      >
        {title}
        {accent && (
          <>
            {" "}
            <span className="q-serif inline-block">{accent}</span>
          </>
        )}
      </Tag>
      {sub && (
        <p
          className={cn(
            "lp-reveal mt-4 max-w-[620px] text-[17px] leading-[1.6] [text-wrap:pretty] sm:text-[18px]",
            tone === "dark" ? "text-[#AFBDD3]" : "text-q-text-3",
          )}
        >
          {sub}
        </p>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   Élément flottant (notification) près d'une maquette.
   Toujours décoratif : aria-hidden, le contenu est dit ailleurs.
───────────────────────────────────────────────────────── */
const TONES = {
  ok: "bg-q-ok-bg text-q-ok",
  info: "bg-q-info-bg text-q-info",
  warn: "bg-q-warn-bg text-q-warn",
} as const

export function Floater({
  icon: Icon,
  tone = "info",
  title,
  sub,
  bob = 1,
}: {
  icon: LucideIcon
  tone?: keyof typeof TONES
  title: string
  sub: string
  /** Variante d'ondulation (durée et départ décalés) ; elle s'arrête d'elle-même. */
  bob?: 1 | 2 | 3
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 whitespace-nowrap rounded-2xl border border-q-line bg-q-surface py-2.5 pl-2.5 pr-4 text-left shadow-[0_1px_2px_rgba(10,17,34,.05),0_18px_36px_-16px_rgba(10,17,34,.28)]",
        bob === 1 ? "lp-bob" : bob === 2 ? "lp-bob-2" : "lp-bob-3",
      )}
    >
      <span className={cn("grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px]", TONES[tone])}>
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <span className="flex flex-col gap-px">
        <span className="text-[13px] font-semibold text-q-ink-strong">{title}</span>
        <span className="text-[12px] text-q-text-3">{sub}</span>
      </span>
    </div>
  )
}

/** Puce flottante (une fonction, une icône). */
export function Chip({ icon: Icon, label, bob = 1 }: { icon: LucideIcon; label: string; bob?: 1 | 2 | 3 }) {
  return (
    <span
      className={cn(
        "inline-flex h-[38px] items-center gap-2 whitespace-nowrap rounded-full border border-q-line bg-q-surface px-3.5 text-[13px] font-semibold text-q-ink-strong shadow-[0_1px_2px_rgba(10,17,34,.05),0_14px_28px_-14px_rgba(10,17,34,.26)]",
        bob === 1 ? "lp-bob" : bob === 2 ? "lp-bob-2" : "lp-bob-3",
      )}
    >
      <Icon className="h-[15px] w-[15px] text-q-accent" strokeWidth={1.75} />
      {label}
    </span>
  )
}

/* ─────────────────────────────────────────────────────────
   Photo qui glisse doucement au défilement (.lp-pan) dans un
   cadre arrondi. Le parent doit être positionné et découpé.
───────────────────────────────────────────────────────── */
export function PanPhoto({ photo, sizes, className }: { photo: LandingPhoto; sizes: string; className?: string }) {
  return (
    <div className={cn("lp-pan absolute inset-x-0 top-[-10%] h-[120%]", className)}>
      <Image src={photo.src} alt={photo.alt} fill sizes={sizes} loading="lazy" className="object-cover" />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   Bande photo pleine largeur : phrase en deux voix en bas,
   notification en haut à droite (masquée sur téléphone)
───────────────────────────────────────────────────────── */
export function PhotoBand({
  photo,
  title,
  accent,
  floater,
  label,
}: {
  photo: LandingPhoto
  title: string
  accent: string
  floater?: React.ReactNode
  label: string
}) {
  return (
    <section aria-label={label} className="bg-q-surface px-4 sm:px-6">
      <div className="lp-reveal lp-clip relative mx-auto h-[clamp(320px,40vw,540px)] max-w-[1200px] rounded-[22px] bg-[#1B2333] sm:rounded-[28px]">
        <PanPhoto photo={photo} sizes="(min-width: 1248px) 1200px, 100vw" />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,17,34,0)_40%,rgba(10,17,34,.72)_100%)]" />
        <p className="absolute bottom-[clamp(24px,4vw,44px)] left-[clamp(24px,4vw,48px)] right-6 m-0 max-w-[680px] font-display text-[clamp(26px,3.2vw,42px)] font-semibold leading-[1.1] tracking-[-0.03em] text-white [text-wrap:balance]">
          {title} <span className="q-serif !text-white">{accent}</span>
        </p>
        {floater && (
          <div aria-hidden className="absolute right-[clamp(24px,4vw,48px)] top-[clamp(24px,4vw,44px)] z-[5] hidden md:block">
            {floater}
          </div>
        )}
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   Les deux appels à l'action (inscription, démo)
───────────────────────────────────────────────────────── */
export function CtaButtons({ className, align = "center" }: { className?: string; align?: "center" | "start" }) {
  return (
    <div
      className={cn(
        "flex w-full max-w-[360px] flex-col items-stretch gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center",
        align === "center" ? "sm:justify-center" : "sm:justify-start",
        className,
      )}
    >
      <Link href="/signup" className="lp-btn-p">
        Créer mon premier devis
        <ArrowRight className="lp-btn-arrow h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
      </Link>
      <Link href="/demo" className="lp-btn-s">
        <span className="lp-btn-s-ic" aria-hidden>
          <Monitor className="h-[15px] w-[15px]" strokeWidth={2} />
        </span>
        Voir la démo
      </Link>
    </div>
  )
}
