import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Check } from "lucide-react"
import { IPhone, type ScreenProps } from "@/components/landing/devices"
import { cn } from "@/lib/utils"

/**
 * Briques de l'accueil (app/page.tsx) : la structure et le rythme d'une page
 * de référence (note interne ANALYSE-LANDING-CONCURRENT-2026-10.md), au langage
 * de Qonforme (jetons --q-*, titres en deux voix, boutons lp-btn-*).
 *
 * Mêmes règles que l'accueil : contenu vrai seulement, aucun élément flottant
 * posé sur une photo ou une maquette, apparitions au défilement par data-reveal
 * (dans les deux sens), ni backdrop-filter ni will-change, rien d'infini.
 */

export const D_SECTION = "relative px-6 py-[clamp(80px,9vw,120px)]"
export const D_WRAP = "mx-auto w-full max-w-[1200px]"

/**
 * Lien d'inscription des boutons de la page. Pour un futur test A/B, marquer le
 * lien de la variante par ?ab=<nom> (nom déclaré dans LANDING_VARIANTS,
 * lib/auth/signup-input.ts) : il est enregistré dans user_metadata.landing_variant.
 */
export const SIGNUP_HREF = "/signup"

/* ─────────────────────────────────────────────────────────
   Liste à coches : les puces des blocs de fonctions
───────────────────────────────────────────────────────── */
export function CheckList({
  items,
  tone = "light",
  className,
}: {
  items: React.ReactNode[]
  /** dark : sur un bandeau bleu ou marine. */
  tone?: "light" | "dark"
  className?: string
}) {
  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {items.map((item, i) => (
        <li
          key={i}
          className={cn(
            "flex gap-3 text-[15px] leading-[1.45] sm:text-[17px] sm:leading-[1.55]",
            tone === "dark" ? "text-[#D5DBE5]" : "text-q-text-2",
          )}
        >
          <Check
            className={cn("mt-[4px] h-[17px] w-[17px] sm:mt-[5px] shrink-0", tone === "dark" ? "text-[#9DBBFF]" : "text-q-accent")}
            strokeWidth={2.25}
            aria-hidden
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

/* ─────────────────────────────────────────────────────────
   Lignes verticales en pointillés derrière les blocs de
   fonctions (colonne de 1 200 px, quatre travées)
───────────────────────────────────────────────────────── */
export function GridLines() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-y-0 left-6 right-6 mx-auto hidden max-w-[1200px] md:block">
      {[0, 25, 50, 75, 100].map((x) => (
        <span key={x} className="absolute inset-y-0 w-0 border-l border-dashed border-q-line" style={{ left: `${x}%` }} />
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   Fenêtre de navigateur : une vraie capture du produit
───────────────────────────────────────────────────────── */
export function BrowserFrame({ screen, className }: { screen: ScreenProps; className?: string }) {
  return (
    <div
      className={cn(
        "lp-clip rounded-[16px] border border-q-line bg-q-surface shadow-[0_40px_80px_-44px_rgba(10,17,34,.42),0_14px_28px_-18px_rgba(10,17,34,.2)]",
        className,
      )}
    >
      <div aria-hidden className="flex h-8 items-center gap-1.5 border-b border-q-line bg-q-bg px-3.5">
        <span className="h-2.5 w-2.5 rounded-full bg-q-field" />
        <span className="h-2.5 w-2.5 rounded-full bg-q-field" />
        <span className="h-2.5 w-2.5 rounded-full bg-q-field" />
      </div>
      <div className="relative aspect-[16/10] bg-[#F6F8FB]">
        <Image
          src={screen.src}
          alt={screen.alt}
          fill
          sizes={screen.sizes}
          priority={screen.priority}
          loading={screen.priority ? undefined : "lazy"}
          className="object-cover object-top"
        />
      </div>
    </div>
  )
}

/**
 * Capture d'ordinateur et téléphone qui la chevauche en bas, du côté du texte.
 * Sur téléphone, seule la capture mobile s'affiche : plus lisible.
 */
export function ScreenPair({
  desktop,
  phone,
  phoneSide = "left",
}: {
  desktop: ScreenProps
  phone: ScreenProps
  /** Côté du téléphone : celui du texte, pour que la composition s'ouvre vers l'extérieur. */
  phoneSide?: "left" | "right"
}) {
  return (
    <div className="relative">
      <div className="mx-auto w-[min(270px,68%)] sm:hidden">
        <IPhone screen={{ ...phone, sizes: "270px" }} />
      </div>
      <div className={cn("relative hidden pb-[12%] sm:block", phoneSide === "left" ? "pl-[14%]" : "pr-[14%]")}>
        <div data-reveal="zoom">
          <BrowserFrame screen={{ ...desktop, sizes: "(min-width: 1248px) 620px, (min-width: 1024px) 50vw, 86vw" }} />
        </div>
        <div
          data-reveal=""
          className={cn("lp-d2 absolute bottom-0 z-[2] w-[26%]", phoneSide === "left" ? "left-0" : "right-0")}
        >
          <IPhone screen={{ ...phone, sizes: "(min-width: 1024px) 170px, 24vw" }} />
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   Bloc de fonction : titre en deux voix, coches, bouton,
   capture d'un côté, lignes en pointillés derrière
───────────────────────────────────────────────────────── */
export interface FeatureLink {
  href: string
  label: string
}

export function FeatureBlock({
  id,
  title,
  accent,
  intro,
  items,
  note,
  cta,
  link,
  visual,
  reverse = false,
  className,
}: {
  id?: string
  title: string
  accent?: string
  intro?: string
  items: React.ReactNode[]
  /** Précision sous les coches (« avec la formule Essentiel »). */
  note?: React.ReactNode
  cta: FeatureLink
  /** Lien secondaire sous le bouton (guide, modèle, démo). */
  link?: FeatureLink
  visual: React.ReactNode
  /** Capture à gauche, texte à droite. */
  reverse?: boolean
  className?: string
}) {
  return (
    <section id={id} className={cn("relative scroll-mt-20 bg-q-surface px-6 py-[clamp(56px,6.5vw,96px)]", className)}>
      <GridLines />
      <div className={cn(D_WRAP, "relative grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10")}>
        <div
          data-reveal={reverse ? "right" : "left"}
          className={cn("flex flex-col items-start lg:col-span-5", reverse ? "lg:order-2 lg:col-start-8 lg:pl-4" : "lg:pr-4")}
        >
          <h2 className="font-display text-[clamp(30px,3.2vw,44px)] font-semibold leading-[1.08] tracking-[-0.03em] text-q-ink-strong [text-wrap:balance]">
            {title}
            {accent && (
              <>
                {" "}
                <span className="q-serif">{accent}</span>
              </>
            )}
          </h2>
          {intro && <p className="mt-4 max-w-[520px] text-[17px] leading-[1.6] text-q-text-3">{intro}</p>}
          <CheckList items={items} className="mt-6" />
          {note && <p className="mt-5 text-[14px] leading-[1.5] text-q-text-4">{note}</p>}
          <Link href={cta.href} className="lp-btn-p mt-8">
            {cta.label}
            <ArrowRight className="lp-btn-arrow h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          </Link>
          {link && (
            <Link href={link.href} className="mt-5 inline-flex items-center gap-1.5 text-[15px] font-semibold text-q-accent-strong hover:underline">
              {link.label} <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </Link>
          )}
        </div>
        <div className={cn("lg:col-span-7", reverse && "lg:order-1 lg:col-start-1")}>{visual}</div>
      </div>
    </section>
  )
}
