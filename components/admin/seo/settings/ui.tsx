/**
 * Briques des écrans Paramètres de l'onglet SEO (planches Parametres-*.dc.html) :
 * carte à titre et pied, champ avec libellé, indication et erreur, menu
 * déroulant, bouton « Enregistrer », ligne « Utilisé par ».
 *
 * Sans hook : utilisables dans les composants serveur et client. Champs à
 * 16 px sur téléphone (classe q-input), boutons de 48 px pleine largeur sur
 * téléphone, 40 px sur ordinateur.
 */
import Link from "next/link"
import { Check, ChevronDown, Info, LoaderCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export function SettingsCard({
  id,
  title,
  tag,
  subtitle,
  action,
  children,
  footer,
  className,
  bodyClassName,
}: {
  id: string
  title: React.ReactNode
  tag?: React.ReactNode
  subtitle?: React.ReactNode
  action?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section aria-labelledby={id} className={cn("q-card overflow-hidden", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-2 pt-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 id={id} className="q-h2">
              {title}
            </h2>
            {tag}
          </div>
          {subtitle && <p className="text-[13px] text-[var(--q-text-4)]">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children !== undefined && <div className={cn("flex flex-col gap-4 px-5 pb-5", bodyClassName)}>{children}</div>}
      {footer}
    </section>
  )
}

/** Pied de carte : ligne d'usage à gauche, actions à droite (empilées sur téléphone). */
export function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-5 py-3.5 md:flex-row md:flex-wrap md:items-center md:justify-between",
        className,
      )}
    >
      {children}
    </div>
  )
}

/** « Utilisé par : génération d'articles, suivi de la visibilité IA ». */
export function UsedBy({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <p className="text-[13px] text-[var(--q-text-4)]">
      Utilisé par&nbsp;:{" "}
      {items.map((item, i) => (
        <span key={item.label}>
          {i > 0 && ", "}
          {item.href ? (
            <Link
              href={item.href}
              className="font-semibold text-[var(--q-text-2)] underline decoration-[var(--q-text-4)] underline-offset-2 hover:text-[var(--q-ink)]"
            >
              {item.label}
            </Link>
          ) : (
            item.label
          )}
        </span>
      ))}
    </p>
  )
}

/** Identifiants d'aide et d'erreur d'un champ (aria-describedby). */
export function describedBy(id: string, hint?: React.ReactNode, error?: string | null): string | undefined {
  const ids = [hint ? `${id}-aide` : null, error ? `${id}-erreur` : null].filter(Boolean)
  return ids.length ? ids.join(" ") : undefined
}

/** Champ : libellé (et mention à droite), contrôle, indication, erreur. */
export function Field({
  id,
  label,
  aside,
  hint,
  error,
  className,
  children,
}: {
  id: string
  label: React.ReactNode
  aside?: React.ReactNode
  hint?: React.ReactNode
  error?: string | null
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="q-label">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {hint && (
        <span id={`${id}-aide`} className="q-field-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-erreur`} role="alert" className="q-field-error">
          {error}
        </span>
      )}
    </div>
  )
}

/** Menu déroulant à la peau des champs (chevron à droite). */
export function SelectBox({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={cn("q-input cursor-pointer appearance-none pr-9", className)}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--q-text-4)]" aria-hidden />
    </div>
  )
}

/** Compteur discret à droite d'un libellé (« 1 / 20 », « 2 termes »). */
export function Counter({ children }: { children: React.ReactNode }) {
  return <span className="text-xs tabular-nums text-[var(--q-text-4)]">{children}</span>
}

/**
 * « Enregistrer » : primaire en pied de la première carte, secondaire ensuite.
 * Désactivé tant que rien n'a changé, et pendant tout enregistrement de
 * l'écran (`busy`) ; l'indicateur de chargement reste sur la carte concernée.
 */
export function SaveButton({
  primary = false,
  dirty,
  saving,
  busy = false,
  onClick,
  label = "Enregistrer",
  ariaLabel,
}: {
  primary?: boolean
  dirty: boolean
  /** Cette carte est en cours d'enregistrement. */
  saving: boolean
  /** Un enregistrement de l'écran est en cours (cette carte ou une autre). */
  busy?: boolean
  onClick: () => void
  label?: string
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!dirty || saving || busy}
      aria-label={ariaLabel}
      className={cn(
        "q-btn h-12 w-full rounded-[14px] text-[15px] md:h-10 md:w-auto md:rounded-[10px] md:text-sm",
        primary ? "q-btn-primary" : "q-btn-secondary",
      )}
    >
      {saving ? <LoaderCircle className="animate-spin" aria-hidden /> : <Check aria-hidden />}
      {saving ? "Enregistrement…" : label}
    </button>
  )
}

/** Ligne d'état en tête de carte (« Contexte vérifié — enregistré le 5 oct. 2026 »). */
export function StatusLine({ tone, children }: { tone: "ok" | "info"; children: React.ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm font-medium",
        tone === "ok"
          ? "border-[var(--q-ok-line)] bg-[var(--q-ok-bg)] text-[var(--q-ok)]"
          : "border-[var(--q-info-line)] bg-[var(--q-info-bg)] text-[var(--q-accent-ink)] dark:text-[var(--q-ink)]",
      )}
    >
      {tone === "ok" ? <Check className="size-4 shrink-0" strokeWidth={2.25} aria-hidden /> : <Info className="size-4 shrink-0" aria-hidden />}
      <span>{children}</span>
    </div>
  )
}
