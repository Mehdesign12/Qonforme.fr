import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Monitor } from "lucide-react"
import type { LandingPhoto } from "@/lib/landing/photos"
import { cn } from "@/lib/utils"

/**
 * Briques de l'accueil, d'après le canevas « Main » v20.
 *
 * Couleurs par jetons --q-* (thème sombre compris), sauf les fonds photo et
 * le bandeau marine, identiques dans les deux thèmes. Mouvement : apparitions
 * au défilement par l'attribut data-reveal (components/motion/ScrollReveal.tsx),
 * classes lp-* dans app/globals.css, section « Accueil ».
 */

/* ─────────────────────────────────────────────────────────
   Titre de section en deux voix : Bricolage, puis la fin en
   Instrument Serif italique bleu (.q-serif)
───────────────────────────────────────────────────────── */
export function SectionTitle({
  eyebrow,
  title,
  accent,
  sub,
  align = "left",
  tone = "light",
  className,
  as: Tag = "h2",
}: {
  /** Surtitre court en capitales bleues (canevas : « Ce que dit la loi »). */
  eyebrow?: string
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
      {eyebrow && <p data-reveal="" className="q-eyebrow mb-3">{eyebrow}</p>}
      <Tag
        data-reveal=""
        className={cn(
          "font-display text-[clamp(32px,3.6vw,48px)] font-semibold leading-[1.08] tracking-[-0.03em] [text-wrap:balance]",
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
          data-reveal=""
          className={cn(
            "lp-d1 mt-4 max-w-[620px] text-[17px] leading-[1.6] [text-wrap:pretty] sm:text-[18px]",
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
   Bande photo pleine largeur : phrase en deux voix en bas
───────────────────────────────────────────────────────── */
export function PhotoBand({
  photo,
  title,
  accent,
  label,
  stack = false,
}: {
  photo: LandingPhoto
  title: string
  accent: string
  label: string
  /** Seconde voix sur sa propre ligne. */
  stack?: boolean
}) {
  return (
    <section aria-label={label} className="bg-q-surface px-6">
      <div data-reveal="scale" className="lp-clip relative mx-auto h-[clamp(320px,40vw,540px)] max-w-[1200px] rounded-[22px] bg-[#1B2333] sm:rounded-[28px]">
        <PanPhoto photo={photo} sizes="(min-width: 1248px) 1200px, 100vw" />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,17,34,0)_40%,rgba(10,17,34,.72)_100%)]" />
        <p className="absolute bottom-[clamp(24px,4vw,44px)] left-[clamp(24px,4vw,48px)] right-6 m-0 max-w-[680px] font-display text-[clamp(26px,3.2vw,42px)] font-semibold leading-[1.1] tracking-[-0.03em] text-white [text-wrap:balance]">
          {title} <span className={cn("q-serif !text-white", stack && "block")}>{accent}</span>
        </p>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   Les deux appels à l'action (inscription par défaut, démo).
   Libellés vrais seulement : devis gratuits, aucune carte bancaire.
───────────────────────────────────────────────────────── */
export interface CtaLink {
  href: string
  label: string
}

export function CtaButtons({
  className,
  align = "center",
  primary = { href: "/signup", label: "Créer mon premier devis" },
  secondary = { href: "/demo", label: "Voir la démo" },
  reveal = false,
}: {
  className?: string
  align?: "center" | "start"
  primary?: CtaLink
  /** null : bouton principal seul. */
  secondary?: CtaLink | null
  /** Apparition au défilement (hors du héros, qui a sa propre entrée). */
  reveal?: boolean
}) {
  return (
    <div
      data-reveal={reveal ? "" : undefined}
      className={cn(
        "flex w-full max-w-[360px] flex-col items-stretch gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center",
        align === "center" ? "mx-auto sm:justify-center" : "sm:justify-start",
        className,
      )}
    >
      <Link href={primary.href} className="lp-btn-p">
        {primary.label}
        <ArrowRight className="lp-btn-arrow h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
      </Link>
      {secondary && (
        <Link href={secondary.href} className="lp-btn-s">
          <span className="lp-btn-s-ic" aria-hidden>
            <Monitor className="h-[15px] w-[15px]" strokeWidth={2} />
          </span>
          {secondary.label}
        </Link>
      )}
    </div>
  )
}
