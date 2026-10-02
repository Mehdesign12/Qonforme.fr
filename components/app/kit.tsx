/**
 * Kit de l'application — composants du canevas « Fondations visuelles ».
 *
 * Partagé par les pages réelles et leurs miroirs de démo (règle « Mode démo »
 * de CLAUDE.md) : une page et sa démo utilisent les mêmes briques, donc le
 * même rendu. Les styles vivent dans app/globals.css (classes q-*) et passent
 * par les jetons --q-*, thème sombre compris.
 */
import { Children } from "react"
import Link from "next/link"
import { Check, Clock, Send, X, Undo2, Search } from "lucide-react"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/* En-tête de page                                                     */
/* ------------------------------------------------------------------ */

/**
 * Titre de page : date ou surtitre, titre en Bricolage, sous-titre, actions à droite.
 * Sur mobile, le titre reste en haut de page (il n'y a pas de barre supérieure).
 */
export function PageHeader({
  title,
  eyebrow,
  subtitle,
  actions,
  backHref,
  backLabel,
  className,
}: {
  title: React.ReactNode
  eyebrow?: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  /** Lien de retour affiché au-dessus du titre sur mobile (la barre supérieure le montre sur ordinateur). */
  backHref?: string
  backLabel?: string
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        {backHref && (
          // Cible tactile de 44 px ; les marges négatives gardent la place qu'occupait le lien (23 px + mb-1)
          <Link href={backHref} className="q-link -mb-1.5 -mt-2.5 inline-flex min-h-11 items-center gap-1 text-[15px] lg:hidden">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            {backLabel ?? "Retour"}
          </Link>
        )}
        {eyebrow && <span className="text-sm text-[var(--q-text-4)]">{eyebrow}</span>}
        <h1 className="q-h1">{title}</h1>
        {subtitle && <p className="text-sm text-[var(--q-text-4)] md:text-[15px]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Cartes                                                              */
/* ------------------------------------------------------------------ */

/** Carte blanche bordée (rayon 16). `title` ajoute un en-tête séparé par un trait. */
export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
  as: Tag = "section",
  "aria-label": ariaLabel,
}: {
  title?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  as?: "section" | "div" | "aside"
  "aria-label"?: string
}) {
  return (
    <Tag className={cn("q-card overflow-hidden", className)} aria-label={ariaLabel}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
          {title && <h2 className="q-h2">{title}</h2>}
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </Tag>
  )
}

/** Indicateur chiffré : libellé, montant en chiffres tabulaires, ligne de contexte. */
export function Kpi({
  label,
  value,
  sub,
  tone = "default",
  icon,
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  sub?: React.ReactNode
  /** warn : bord ambré et libellé coloré (retards) ; ink : carte encre (montant principal). */
  tone?: "default" | "warn" | "ink"
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "q-kpi rounded-2xl border",
        tone === "ink"
          ? "border-[#0A1122] bg-[#0A1122] text-white"
          : "border-[var(--q-line)] bg-[var(--q-surface)]",
        tone === "warn" && "border-[var(--q-warn-line)]",
        className,
      )}
    >
      <span
        className={cn(
          "flex items-center gap-1.5 text-[13px]",
          tone === "warn" && "font-semibold text-[var(--q-warn)]",
          tone === "ink" && "text-white/70",
          tone === "default" && "text-[var(--q-text-3)]",
        )}
      >
        {icon}
        {label}
      </span>
      <span className={cn("q-kpi-value", tone === "ink" && "!text-white")}>{value}</span>
      {sub && <span className={cn("q-kpi-sub", tone === "ink" && "!text-white/60")}>{sub}</span>}
    </div>
  )
}

/**
 * Grille d'indicateurs : 2 colonnes sur mobile, jusqu'à 4 sur ordinateur. Quatre indicateurs
 * restent sur 2 colonnes jusqu'à 1280 px : à 1024 px, à côté de la barre latérale, une carte
 * sur quatre ne fait que 170 px et les montants en débordaient.
 */
export function KpiGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  const four = Children.toArray(children).length >= 4
  return <div className={cn("grid grid-cols-2 gap-3", four ? "xl:grid-cols-4" : "lg:grid-cols-4", className)}>{children}</div>
}

/* ------------------------------------------------------------------ */
/* Pastilles de statut                                                 */
/* ------------------------------------------------------------------ */

export type Tone = "ok" | "info" | "warn" | "danger" | "neutral"

/** Classes écrites en toutes lettres : Tailwind ne garde que les classes qu'il trouve dans le code. */
const TONE_CLASS: Record<Tone, string> = {
  ok: "q-pill-ok",
  info: "q-pill-info",
  warn: "q-pill-warn",
  danger: "q-pill-danger",
  neutral: "q-pill-neutral",
}

export function StatusPill({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: Tone
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={cn("q-pill", TONE_CLASS[tone], className)}>
      {icon}
      {children}
    </span>
  )
}

type PillDef = { label: string; tone: Tone; icon?: "check" | "send" | "clock" | "x" | "undo" }

const ICONS = {
  check: <Check strokeWidth={2.75} aria-hidden />,
  send: <Send strokeWidth={2.25} aria-hidden />,
  clock: <Clock strokeWidth={2.25} aria-hidden />,
  x: <X strokeWidth={2.75} aria-hidden />,
  undo: <Undo2 strokeWidth={2.25} aria-hidden />,
}

/** Statuts de facture : chaque statut porte un libellé (et souvent une icône), jamais la couleur seule. */
export const INVOICE_PILLS: Record<string, PillDef> = {
  draft:     { label: "Brouillon",  tone: "neutral" },
  sent:      { label: "Envoyée",    tone: "info",    icon: "send" },
  pending:   { label: "En attente", tone: "neutral", icon: "clock" },
  received:  { label: "Reçue",      tone: "info" },
  accepted:  { label: "Acceptée",   tone: "ok",      icon: "check" },
  rejected:  { label: "Rejetée",    tone: "danger",  icon: "x" },
  paid:      { label: "Payée",      tone: "ok",      icon: "check" },
  overdue:   { label: "En retard",  tone: "warn",    icon: "clock" },
  cancelled: { label: "Annulée",    tone: "neutral", icon: "x" },
  credited:  { label: "Avoir émis", tone: "neutral", icon: "undo" },
}

export const QUOTE_PILLS: Record<string, PillDef> = {
  draft:    { label: "Brouillon", tone: "neutral" },
  sent:     { label: "Envoyé",    tone: "info",   icon: "send" },
  accepted: { label: "Accepté",   tone: "ok",     icon: "check" },
  rejected: { label: "Refusé",    tone: "danger", icon: "x" },
}

export const PURCHASE_ORDER_PILLS: Record<string, PillDef> = {
  draft:     { label: "Brouillon", tone: "neutral" },
  sent:      { label: "Envoyé",    tone: "info",   icon: "send" },
  confirmed: { label: "Confirmé",  tone: "ok",     icon: "check" },
  cancelled: { label: "Annulé",    tone: "danger", icon: "x" },
}

/** Pastille d'un document selon son type et son statut. `label` remplace le libellé (ex. « Retard 12 j »). */
export function DocStatusPill({
  kind,
  status,
  label,
  className,
}: {
  kind: "invoice" | "quote" | "purchase_order"
  status: string
  label?: string
  className?: string
}) {
  const map = kind === "invoice" ? INVOICE_PILLS : kind === "quote" ? QUOTE_PILLS : PURCHASE_ORDER_PILLS
  const def = map[status] ?? { label: status, tone: "neutral" as Tone }
  return (
    <StatusPill tone={def.tone} icon={def.icon ? ICONS[def.icon] : undefined} className={className}>
      {label ?? def.label}
    </StatusPill>
  )
}

/* ------------------------------------------------------------------ */
/* Contrôles                                                           */
/* ------------------------------------------------------------------ */

/** Interrupteur accessible (role="switch"). */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
  id,
}: {
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  /** Nom accessible, si aucun <label htmlFor> ne le donne. */
  label?: string
  id?: string
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className="q-switch"
    />
  )
}

/** Champ de recherche avec loupe (listes). */
export function SearchField({
  value,
  onChange,
  placeholder = "Rechercher…",
  className,
  "aria-label": ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  "aria-label"?: string
}) {
  return (
    <label className={cn("q-fw relative flex h-[42px] items-center gap-2 rounded-[10px] border border-[var(--q-field)] bg-[var(--q-surface)] px-3", className)}>
      <Search className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="h-full w-full min-w-0 bg-transparent text-base text-[var(--q-ink)] outline-none placeholder:text-[var(--q-placeholder)] md:text-sm"
      />
    </label>
  )
}

/* ------------------------------------------------------------------ */
/* États                                                               */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon,
  title,
  text,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: React.ReactNode
  text?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("q-empty", className)}>
      {icon && <span className="q-empty-icon">{icon}</span>}
      <p className="text-base font-semibold text-[var(--q-ink)]">{title}</p>
      {text && <p className="max-w-sm text-sm text-[var(--q-text-4)]">{text}</p>}
      {action && <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

/** Initiales d'un nom (2 lettres) pour les avatars. */
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? "").replace(/[&.,()«»"/]/g, " ").trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/** Avatar à initiales (rayon 9). `ink` : carré encre (entreprise). */
export function Initials({ name, ink, className }: { name: string | null | undefined; ink?: boolean; className?: string }) {
  return (
    <span className={cn("q-avatar", ink && "q-avatar-ink", className)} aria-hidden>
      {initialsOf(name)}
    </span>
  )
}
