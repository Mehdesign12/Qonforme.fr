import Link from "next/link"
import { ArrowRight, ChevronDown, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { PublicHeader } from "@/components/layout/PublicHeader"
import Footer from "@/components/layout/Footer"
import { cn } from "@/lib/utils"

/**
 * Briques des pages /outils, d'après le canevas (« Main » v20 et « Fondations
 * visuelles ») : fond #F6F8FB, cartes blanches q-card, libellés 13/600,
 * montants en chiffres tabulaires, références en DM Mono, boutons en pilule.
 *
 * Les 12 outils et le hub passent par ces briques : un changement ici les
 * modifie tous de la même façon. Couleurs par jetons --q-* (thème sombre
 * compris). Aucun backdrop-filter, aucun will-change, aucune animation
 * infinie (règles iOS de CLAUDE.md).
 */

/** Typographie française : espace insécable avant « ? : ; ! % € » et après « « ». */
export function frSpaces(s: string): string {
  return s.replace(/ ([?:;!%€»])/g, "\u00a0$1").replace(/« /g, "«\u00a0")
}

/* ─────────────────────────────────────────────────────────
   Coque : en-tête public, contenu, pied de page (avec son appel final)
───────────────────────────────────────────────────────── */
export function ToolShell({ children, ctaBar }: { children: ReactNode; ctaBar?: ReactNode }) {
  return (
    <div
      className={cn(
        "flex min-h-screen flex-col overflow-x-clip bg-q-bg",
        // Place de la barre d'appel fixée en bas sur mobile
        ctaBar && "pb-[calc(76px+env(safe-area-inset-bottom))] sm:pb-0",
      )}
    >
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <Footer />
      {ctaBar}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   Zone de l'outil, sous le titre
───────────────────────────────────────────────────────── */
const WIDTHS = {
  sm: "max-w-[600px]",
  md: "max-w-[720px]",
  lg: "max-w-[1120px]",
} as const

export function ToolArea({
  children,
  width = "sm",
  className,
}: {
  children: ReactNode
  width?: keyof typeof WIDTHS
  className?: string
}) {
  return (
    <section className={cn("px-4 sm:px-6", className)}>
      <div className={cn("mx-auto flex w-full flex-col gap-4", WIDTHS[width])}>{children}</div>
    </section>
  )
}

/** Carte blanche de l'outil (q-card). */
export function ToolPanel({
  children,
  className,
  padded = true,
  as: Tag = "div",
}: {
  children: ReactNode
  className?: string
  padded?: boolean
  as?: "div" | "section"
}) {
  return <Tag className={cn("q-card", padded && "p-5 sm:p-7", className)}>{children}</Tag>
}

/** Libellé 13/600 + champ + aide (Fondations › Champs). */
export function Field({
  label,
  htmlFor,
  hint,
  aside,
  children,
  className,
}: {
  label: ReactNode
  htmlFor?: string
  hint?: ReactNode
  /** Contrôle à droite du libellé (sélecteur de période…). */
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex min-h-[20px] items-center justify-between gap-3">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="q-label">
            {label}
          </label>
        ) : (
          <span className="q-label">{label}</span>
        )}
        {aside}
      </div>
      {children}
      {hint && <p className="q-field-hint">{hint}</p>}
    </div>
  )
}

/** Petit titre de bloc dans une carte. */
export function PanelTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="q-h2">{children}</h2>
      {aside}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   Résultats : montant principal + lignes (Fondations › Chiffres)
───────────────────────────────────────────────────────── */
type Tone = "ink" | "accent" | "ok" | "warn" | "danger" | "muted"

const TONE_TEXT: Record<Tone, string> = {
  ink: "text-q-ink",
  accent: "text-q-accent-strong",
  ok: "text-q-ok",
  warn: "text-q-warn",
  danger: "text-q-danger",
  muted: "text-q-text-4",
}

export function ResultBox({
  label,
  value,
  sub,
  tone = "ink",
  children,
  footer,
  className,
}: {
  /** Libellé du montant principal (« Montant TTC »). */
  label?: ReactNode
  value?: ReactNode
  sub?: ReactNode
  tone?: Tone
  /** Lignes de détail (ResultRow). */
  children?: ReactNode
  footer?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-2xl border border-q-line bg-q-surface-2 p-5 sm:p-6", className)} aria-live="polite">
      {label && <p className="text-[13px] text-q-text-4">{label}</p>}
      {value !== undefined && (
        <p className={cn("mt-1 font-display text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] tabular-nums sm:text-[40px]", TONE_TEXT[tone])}>
          {value}
        </p>
      )}
      {sub && <p className="mt-1.5 text-[13px] text-q-text-4">{sub}</p>}
      {children && <dl className={cn("flex flex-col gap-2.5", (label || value !== undefined) && "mt-5 border-t border-q-line pt-4")}>{children}</dl>}
      {footer && <div className="mt-4 flex flex-wrap items-center justify-end gap-2">{footer}</div>}
    </div>
  )
}

export function ResultRow({
  label,
  value,
  strong,
  tone = "ink",
  divider,
}: {
  label: ReactNode
  value: ReactNode
  strong?: boolean
  tone?: Tone
  /** Trait au-dessus (avant un total). */
  divider?: boolean
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", divider && "mt-1 border-t border-q-line pt-3")}>
      <dt className={cn("min-w-0 text-[15px]", strong ? "font-semibold text-q-ink" : "text-q-text-3")}>{label}</dt>
      <dd className={cn("shrink-0 text-right tabular-nums", strong ? "text-[17px] font-semibold" : "text-[15px] font-medium", TONE_TEXT[tone])}>
        {value}
      </dd>
    </div>
  )
}

/** Rangée de 2 à 4 indicateurs (HT · TVA · TTC). */
export function StatGrid({ items, className }: { items: { label: ReactNode; value: ReactNode; tone?: Tone }[]; className?: string }) {
  return (
    <dl className={cn("grid divide-x divide-q-line overflow-hidden rounded-xl border border-q-line bg-q-surface", items.length === 2 ? "grid-cols-2" : items.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3", className)}>
      {items.map((it, i) => (
        <div key={i} className="flex min-w-0 flex-col gap-1 px-3 py-3 sm:px-4">
          <dt className="truncate text-[12px] text-q-text-4">{it.label}</dt>
          <dd className={cn("truncate text-[15px] font-semibold tabular-nums sm:text-[16px]", TONE_TEXT[it.tone ?? "ink"])}>{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Jauge (Fondations › Contrôles › Avancement). */
export function Gauge({
  label,
  value,
  percent,
  tone = "accent",
  marker,
  scale,
}: {
  label: ReactNode
  value: ReactNode
  /** 0 à 100. */
  percent: number
  tone?: "accent" | "ok" | "warn" | "danger"
  /** Repère vertical, en pourcentage de la largeur. */
  marker?: number
  /** Graduations sous la barre. */
  scale?: ReactNode[]
}) {
  const bar = { accent: "bg-q-accent", ok: "bg-q-ok", warn: "bg-q-warn", danger: "bg-q-danger" }[tone]
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-q-text-3">{label}</span>
        <span className="text-[14px] font-semibold tabular-nums text-q-ink">{value}</span>
      </div>
      <div
        className="relative h-2 overflow-hidden rounded-full bg-[var(--q-line-soft)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(Math.max(percent, 0), 100))}
      >
        <span className={cn("block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none", bar)} style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }} />
        {marker !== undefined && <span aria-hidden className="absolute top-0 h-full w-0.5 bg-q-text-4" style={{ left: `${marker}%` }} />}
      </div>
      {scale && (
        <div className="flex justify-between text-[12px] tabular-nums text-q-text-4">
          {scale.map((s, i) => (
            <span key={i}>{s}</span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   Bandeaux (information, attention, alerte)
───────────────────────────────────────────────────────── */
const CALLOUT = {
  info: "border-[var(--q-info-line)] bg-q-info-bg text-q-accent-ink dark:text-q-ink",
  ok: "border-[var(--q-ok-line)] bg-q-ok-bg text-q-ok",
  warn: "border-[var(--q-warn-line)] bg-q-warn-bg text-q-warn",
  danger: "border-[var(--q-danger-line)] bg-q-danger-bg text-q-danger",
  neutral: "border-q-line bg-q-surface-2 text-q-text-3",
} as const

export function Callout({
  tone = "info",
  icon: Icon,
  title,
  children,
  className,
}: {
  tone?: keyof typeof CALLOUT
  icon?: LucideIcon
  title?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-start gap-3 rounded-[14px] border px-4 py-3.5 text-[14px] leading-[1.55]", CALLOUT[tone], className)} role={tone === "danger" || tone === "warn" ? "status" : undefined}>
      {Icon && <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden />}
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", tone !== "neutral" && "opacity-90")}>{children}</div>}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   Appel à l'action propre à l'outil, sous la carte.
   Une seule promesse vraie : ce que Qonforme fait déjà.
───────────────────────────────────────────────────────── */
export function ToolCta({
  title,
  text,
  cta = "Créer mon premier devis",
  href = "/signup",
  className,
}: {
  title: ReactNode
  text: ReactNode
  cta?: string
  href?: string
  className?: string
}) {
  return (
    <aside className={cn("q-card flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6", className)}>
      <div className="min-w-0">
        <p className="text-[16px] font-semibold text-q-ink">{title}</p>
        <p className="mt-1 text-[14px] leading-[1.55] text-q-text-3">{text}</p>
      </div>
      <Link href={href} className="lp-btn-p !h-11 shrink-0 !gap-2 !px-5 !text-[15px]">
        {cta}
        <ArrowRight className="lp-btn-arrow h-4 w-4" strokeWidth={2} aria-hidden />
      </Link>
    </aside>
  )
}

/* ─────────────────────────────────────────────────────────
   Contenu explicatif (SEO) : titre en deux voix, texte, FAQ, maillage
───────────────────────────────────────────────────────── */
export function ToolGuide({
  title,
  accent,
  children,
}: {
  title: ReactNode
  accent?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mt-16 border-t border-q-line bg-q-surface px-4 py-14 sm:mt-20 sm:px-6 sm:py-20">
      <div className="mx-auto w-full max-w-[760px]">
        <h2 className="font-display text-[clamp(26px,3vw,36px)] font-semibold leading-[1.1] tracking-[-0.03em] text-q-ink-strong [text-wrap:balance]">
          {title}
          {accent && (
            <>
              {" "}
              <span className="q-serif">{accent}</span>
            </>
          )}
        </h2>
        {children}
      </div>
    </section>
  )
}

/** Corps de texte : paragraphes, listes, sous-titres, tableaux. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        "mt-6 flex flex-col gap-4 text-[16px] leading-[1.65] text-q-text-3",
        "[&_strong]:font-semibold [&_strong]:text-q-ink",
        "[&_h3]:pt-4 [&_h3]:text-[19px] [&_h3]:font-semibold [&_h3]:tracking-[-0.01em] [&_h3]:text-q-ink",
        "[&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-6 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-2 [&_ol]:pl-6",
        "[&_li]:marker:text-q-placeholder",
      )}
    >
      {children}
    </div>
  )
}

/** Encadré de formule : les références et formules en DM Mono. */
export function Formula({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1.5 rounded-xl border border-q-line bg-q-surface-2 px-4 py-3.5 font-mono text-[14px] leading-[1.6] text-q-ink">{children}</div>
}

/** Tableau de barème (q-table). */
export function RateTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-q-line">
      <div className="overflow-x-auto">
        <table className="q-table">
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={h} className={i > 0 ? "is-num" : undefined}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => (
                  <td key={ci} className={ci > 0 ? "is-num font-medium" : "text-q-text-2"}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Questions fréquentes : <details> natif (clavier, sans JavaScript), la
 * première ouverte. Le texte reste dans le DOM pour le JSON-LD FAQPage.
 */
export function ToolFaq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="mt-14">
      <h2 className="font-display text-[clamp(24px,2.6vw,30px)] font-semibold tracking-[-0.03em] text-q-ink-strong">
        Questions <span className="q-serif">fréquentes.</span>
      </h2>
      <div className="mt-5 border-b border-q-line">
        {items.map((item, i) => (
          <details key={item.q} open={i === 0} className="group border-t border-q-line">
            <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 py-4 text-left [&::-webkit-details-marker]:hidden">
              <h3 className="text-[16px] font-semibold leading-[1.4] text-q-ink">{frSpaces(item.q)}</h3>
              <ChevronDown className="h-[18px] w-[18px] shrink-0 text-q-text-4 transition-transform duration-300 group-open:rotate-180 motion-reduce:transition-none" strokeWidth={1.75} aria-hidden />
            </summary>
            <p className="max-w-[680px] pb-5 text-[15px] leading-[1.65] text-q-text-3">{frSpaces(item.a)}</p>
          </details>
        ))}
      </div>
    </div>
  )
}

/** Maillage interne : outils complémentaires, en pastilles. */
export function ToolLinks({ links, title = "Outils complémentaires" }: { links: { href: string; label: string }[]; title?: string }) {
  return (
    <nav aria-label={title} className="mt-12">
      <p className="q-eyebrow mb-3">{title}</p>
      <ul className="flex flex-wrap gap-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-q-line bg-q-surface px-4 py-2 text-[14px] font-medium text-q-ink transition-colors hover:border-q-wash-line hover:text-q-accent-strong"
            >
              {l.label}
              <ArrowRight className="h-3.5 w-3.5 text-q-text-4" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Données structurées (WebApplication, FAQPage…). */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}

/** WebApplication commun aux 12 outils (gratuit, éditeur Qonforme). */
export function toolJsonLd(name: string, path: string, description?: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name,
    ...(description ? { description } : {}),
    url: `https://qonforme.fr${path}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    author: { "@type": "Organization", name: "Qonforme", url: "https://qonforme.fr" },
  }
}

/** FAQPage à partir des mêmes questions que la FAQ affichée. */
export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({ "@type": "Question", name: frSpaces(i.q), acceptedAnswer: { "@type": "Answer", text: frSpaces(i.a) } })),
  }
}
