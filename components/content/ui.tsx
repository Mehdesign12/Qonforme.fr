import Link from "next/link"
import Image from "next/image"
import { ArrowRight, ChevronDown, ChevronRight, Monitor, ShieldCheck } from "lucide-react"
import PublicHeaderWrapper from "@/components/layout/PublicHeaderWrapper"
import Footer from "@/components/layout/Footer"
import { PHOTOS } from "@/lib/landing/photos"
import { cn } from "@/lib/utils"
import { fr } from "./text"

/**
 * Briques communes des pages de contenu (blog, guides, modèles, métiers,
 * glossaire), d'après le canevas « Main » v20 : fond #F6F8FB, cartes
 * blanches arrondies, titres en deux voix (Bricolage puis Instrument Serif
 * italique bleu), boutons en pilule, accent bleu unique.
 *
 * Couleurs par jetons --q-* (thème sombre compris). Aucun backdrop-filter,
 * aucun will-change, aucune animation infinie (règles iOS de CLAUDE.md).
 */

/** Largeur des pages de contenu : celle de l'en-tête public flottant. */
export const WRAP = "mx-auto w-full max-w-[1200px]"

/* ─────────────────────────────────────────────────────────
   Coque : en-tête public, contenu, pied de page
───────────────────────────────────────────────────────── */
export function ContentPage({
  children,
  bottomBarSpace = false,
}: {
  children: React.ReactNode
  /** Réserve la place d'une barre fixée en bas de l'écran sur mobile (partage du blog). */
  bottomBarSpace?: boolean
}) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-q-bg">
      <PublicHeaderWrapper />
      <main className="flex-1">{children}</main>
      <div className={cn(bottomBarSpace && "mb-[calc(56px+env(safe-area-inset-bottom))] lg:mb-0")}>
        <Footer />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   Fil d'Ariane visible (miroir du BreadcrumbList JSON-LD)
───────────────────────────────────────────────────────── */
export interface Crumb {
  label: string
  href?: string
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Fil d'Ariane" className={className}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-q-text-4">
        {items.map((c, i) => {
          const last = i === items.length - 1
          return (
            <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {c.href && !last ? (
                <Link href={c.href} className="rounded transition-colors hover:text-q-accent-strong">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={cn("truncate", last && "max-w-[240px] font-medium text-q-text-2 sm:max-w-[420px]")}>
                  {c.label}
                </span>
              )}
              {!last && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-q-placeholder" aria-hidden />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/* ─────────────────────────────────────────────────────────
   Boutons en pilule (mêmes classes que l'accueil)
───────────────────────────────────────────────────────── */
export function CtaButtons({
  className,
  align = "center",
  primary = { href: "/signup", label: "Créer mon premier devis" },
  secondary = { href: "/demo", label: "Voir la démo" },
}: {
  className?: string
  align?: "center" | "start"
  primary?: { href: string; label: string }
  secondary?: { href: string; label: string } | null
}) {
  return (
    <div
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

/* ─────────────────────────────────────────────────────────
   En-tête de page : surtitre, titre en deux voix, chapeau
───────────────────────────────────────────────────────── */
export function ContentHero({
  crumbs,
  eyebrow,
  title,
  accent,
  sub,
  align = "center",
  size = "lg",
  children,
  media,
  className,
}: {
  crumbs?: Crumb[]
  eyebrow?: React.ReactNode
  title: React.ReactNode
  /** Seconde voix, en Instrument Serif italique bleu. */
  accent?: React.ReactNode
  sub?: React.ReactNode
  align?: "center" | "start"
  /** lg : pages d'index ; md : pages de détail (titres plus longs). */
  size?: "lg" | "md"
  /** Boutons, méta ou recherche, sous le chapeau. */
  children?: React.ReactNode
  /** Visuel à droite sur grand écran, sous le texte sur mobile (photo de métier). */
  media?: React.ReactNode
  className?: string
}) {
  const center = align === "center" && !media
  const text = (
    <div className={cn("flex min-w-0 flex-col", center ? "items-center text-center" : "items-start")}>
      {crumbs && <Breadcrumbs items={crumbs} className="mb-6" />}
      {eyebrow && <p className="q-eyebrow mb-4 inline-flex items-center gap-2">{eyebrow}</p>}
      <h1
        className={cn(
          "font-display font-semibold tracking-[-0.03em] text-q-ink-strong [text-wrap:balance]",
          size === "lg" ? "max-w-[900px] text-[clamp(36px,5vw,60px)] leading-[1.04]" : "max-w-[860px] text-[clamp(30px,4vw,48px)] leading-[1.08]",
        )}
      >
        {title}
        {accent && (
          <>
            {" "}
            <span className="q-serif">{accent}</span>
          </>
        )}
      </h1>
      {sub && (
        <p className={cn("mt-5 max-w-[640px] text-[17px] leading-[1.6] text-q-text-3 sm:text-[18px]", center && "mx-auto")}>{sub}</p>
      )}
      {children}
    </div>
  )
  return (
    <header
      className={cn("relative px-4 pb-10 pt-[112px] sm:px-6 sm:pb-14 sm:pt-[140px]", className)}
      style={{ backgroundImage: "var(--q-glow)" }}
    >
      {media ? (
        <div className={cn(WRAP, "grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14")}>
          {text}
          {media}
        </div>
      ) : (
        <div className={WRAP}>{text}</div>
      )}
    </header>
  )
}

/* ─────────────────────────────────────────────────────────
   Titre de section en deux voix
───────────────────────────────────────────────────────── */
export function SectionHeading({
  eyebrow,
  title,
  accent,
  sub,
  align = "start",
  id,
  className,
  as: Tag = "h2",
}: {
  eyebrow?: string
  title: React.ReactNode
  accent?: React.ReactNode
  sub?: React.ReactNode
  align?: "center" | "start"
  id?: string
  className?: string
  as?: "h2" | "h3"
}) {
  return (
    <div className={cn("flex flex-col", align === "center" && "items-center text-center", className)}>
      {eyebrow && <p className="q-eyebrow mb-3">{eyebrow}</p>}
      <Tag id={id} className="scroll-mt-28 font-display text-[clamp(26px,2.8vw,36px)] font-semibold leading-[1.1] tracking-[-0.03em] text-q-ink-strong [text-wrap:balance]">
        {title}
        {accent && (
          <>
            {" "}
            <span className="q-serif">{accent}</span>
          </>
        )}
      </Tag>
      {sub && <p className="mt-3 max-w-[620px] text-[16px] leading-[1.6] text-q-text-3">{sub}</p>}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   Carte-lien (guide, modèle, métier, terme)
───────────────────────────────────────────────────────── */
export function LinkCard({
  href,
  title,
  text,
  icon,
  kicker,
  cta,
  as: Tag = "h2",
  className,
}: {
  href: string
  title: string
  text?: string
  icon?: React.ReactNode
  kicker?: React.ReactNode
  cta?: string
  as?: "h2" | "h3"
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col rounded-[20px] border border-q-line bg-q-surface p-6 shadow-[var(--q-shadow-card)] transition-[border-color,box-shadow,transform] duration-200",
        "hover:-translate-y-0.5 hover:border-q-wash-line hover:shadow-[0_18px_36px_-22px_rgba(10,17,34,.35)] motion-reduce:hover:translate-y-0",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-q-accent",
        className,
      )}
    >
      {(icon || kicker) && (
        <div className="mb-5 flex items-center justify-between gap-3">
          {icon && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-q-wash text-q-accent-strong [&_svg]:h-5 [&_svg]:w-5">{icon}</span>}
          {kicker}
        </div>
      )}
      <Tag className="font-display text-[19px] font-semibold leading-[1.25] tracking-[-0.02em] text-q-ink-strong transition-colors group-hover:text-q-accent-strong">
        {fr(title)}
      </Tag>
      {text && <p className="mt-2 line-clamp-3 flex-1 text-[14px] leading-[1.6] text-q-text-3">{fr(text)}</p>}
      {cta && (
        <span className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-semibold text-q-accent-strong">
          {cta}
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
        </span>
      )}
    </Link>
  )
}

/* ─────────────────────────────────────────────────────────
   Liens en pastilles (maillage interne)
───────────────────────────────────────────────────────── */
export function ChipLinks({ links, className }: { links: { href: string; label: string }[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {links.map((l) => (
        <li key={l.href}>
          <Link
            href={l.href}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-q-line bg-q-surface px-4 py-2 text-[14px] font-medium text-q-ink transition-colors hover:border-q-wash-line hover:text-q-accent-strong"
          >
            {fr(l.label)}
          </Link>
        </li>
      ))}
    </ul>
  )
}

/* ─────────────────────────────────────────────────────────
   Questions fréquentes : <details> natif (clavier, sans JavaScript),
   la première réponse ouverte. Le texte reste dans le DOM pour le
   JSON-LD FAQPage, qui doit refléter le contenu visible.
───────────────────────────────────────────────────────── */
export function FaqList({ items, className }: { items: { question: string; answer: string }[]; className?: string }) {
  return (
    <div className={cn("border-b border-q-line", className)}>
      {items.map((item, i) => (
        <details key={item.question} open={i === 0} className="group border-t border-q-line">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left [&::-webkit-details-marker]:hidden">
            <h3 className="text-[16px] font-semibold leading-[1.4] text-q-ink-strong">{fr(item.question)}</h3>
            <ChevronDown className="h-[18px] w-[18px] shrink-0 text-q-text-4 transition-transform duration-300 group-open:rotate-180 motion-reduce:transition-none" strokeWidth={1.75} aria-hidden />
          </summary>
          <p className="max-w-[680px] pb-6 text-[15px] leading-[1.65] text-q-text-3">{fr(item.answer)}</p>
        </details>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   Appel final : texte sur fond clair, photo à droite (canevas « Main »)
   Promesse vraie uniquement : devis gratuits et illimités, paiement
   à partir de la première facture (DECISIONS-STRATEGIQUES.md).
───────────────────────────────────────────────────────── */
export function ContentCta({
  title = "Votre premier devis,",
  accent = "gratuit et sans carte bancaire.",
  sub = "Les devis sont gratuits et illimités. Vous ne choisissez une formule qu'au moment d'envoyer votre première facture.",
  links,
  className,
}: {
  title?: React.ReactNode
  accent?: React.ReactNode
  sub?: React.ReactNode
  /** Maillage interne affiché sous le bloc. */
  links?: { href: string; label: string }[]
  className?: string
}) {
  const photo = PHOTOS.appelFinal
  return (
    <section className={cn("px-4 py-16 sm:px-6 sm:py-20", className)}>
      <div className={cn(WRAP, "grid grid-cols-1 overflow-hidden rounded-[28px] border border-q-line bg-q-surface md:grid-cols-[1.1fr_1fr]")}>
        <div className="flex flex-col items-start px-6 py-10 sm:px-12 sm:py-14">
          <h2 className="font-display text-[clamp(30px,3.4vw,44px)] font-semibold leading-[1.06] tracking-[-0.03em] text-q-ink-strong [text-wrap:balance]">
            {title}
            {accent && (
              <>
                {" "}
                <span className="q-serif">{accent}</span>
              </>
            )}
          </h2>
          {sub && <p className="mt-4 max-w-[460px] text-[16px] leading-[1.6] text-q-text-3 sm:text-[17px]">{sub}</p>}
          <CtaButtons align="start" className="mt-8" />
        </div>
        {photo && (
          <div className="relative min-h-[240px] bg-q-sunken md:min-h-[360px]">
            <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 1200px) 560px, (min-width: 768px) 48vw, 100vw" loading="lazy" className="object-cover" />
            <div aria-hidden className="absolute bottom-4 left-4 flex items-center gap-3 rounded-2xl border border-q-line bg-q-surface px-3.5 py-2.5 shadow-[var(--q-shadow-pop)] sm:bottom-5 sm:left-5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-q-wash text-q-accent-strong">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <span className="flex flex-col">
                <span className="text-[13px] font-semibold text-q-ink">Mentions obligatoires</span>
                <span className="text-[12px] text-q-text-4">SIREN, TVA, durée de validité</span>
              </span>
            </div>
          </div>
        )}
      </div>
      {links && links.length > 0 && (
        <nav aria-label="Ressources" className={cn(WRAP, "mt-8")}>
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[14px]">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="font-medium text-q-text-3 transition-colors hover:text-q-accent-strong">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </section>
  )
}
