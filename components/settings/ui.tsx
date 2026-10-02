/**
 * Briques communes des pages Paramètres (planches « Paramètres — … ») :
 * carte de section, champ avec libellé et aide, grille de champs, bouton
 * « Enregistrer » d'en-tête et barre d'enregistrement mobile.
 *
 * Partagées par les pages réelles et leurs miroirs de démo. Couleurs par les
 * jetons --q-* uniquement (thème sombre compris).
 */
import { Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

/** Carte blanche d'une section : titre 16 px, description 13 px, contenu espacé de 14 px. */
export function SettingsCard({
  title,
  description,
  action,
  children,
  className,
  id,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children?: React.ReactNode
  className?: string
  id?: string
}) {
  const titleId = id ? `${id}-titre` : undefined
  return (
    <section id={id} aria-labelledby={titleId} className={cn("q-card flex min-w-0 flex-col gap-3.5 p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={titleId} className="q-h2">{title}</h2>
          {description && <p className="text-[13px] leading-relaxed text-[var(--q-text-4)]">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Grille de champs : autant de colonnes de 240 px minimum que la largeur le permet. */
export function FieldGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))]", className)}>
      {children}
    </div>
  )
}

/** Champ : libellé 13 px/600, contrôle, puis aide, validation ou erreur. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  ok,
  children,
  className,
}: {
  label: React.ReactNode
  htmlFor?: string
  hint?: React.ReactNode
  error?: React.ReactNode
  ok?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="q-label">{label}</label>
      {children}
      {error ? (
        <p className="q-field-error" role="alert">{error}</p>
      ) : ok ? (
        <p className="q-field-ok"><Check className="size-3.5" strokeWidth={2.5} aria-hidden />{ok}</p>
      ) : hint ? (
        <p className="q-field-hint leading-relaxed">{hint}</p>
      ) : null}
    </div>
  )
}

/** Ligne réglage + explication (séparée par un trait), avec un contrôle à droite. */
export function SettingRow({
  title,
  text,
  children,
}: {
  title: React.ReactNode
  text?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 border-t border-[var(--q-line-soft)] pt-3">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold text-[var(--q-ink)]">{title}</span>
        {text && <span className="text-[13px] leading-relaxed text-[var(--q-text-4)]">{text}</span>}
      </span>
      {children}
    </div>
  )
}

/** Mention « Modifications non enregistrées ». */
export function DirtyHint({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--q-warn)]", className)} role="status">
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      Modifications non enregistrées
    </span>
  )
}

/**
 * Bouton « Enregistrer » de l'en-tête de page. `form` relie le bouton au
 * formulaire de la page (il est rendu hors de la balise <form>).
 */
export function SaveButton({
  form,
  saving,
  disabled,
  onClick,
  className,
  size = "md",
}: {
  form?: string
  saving?: boolean
  disabled?: boolean
  onClick?: () => void
  className?: string
  size?: "md" | "lg"
}) {
  return (
    <button
      type={form ? "submit" : "button"}
      form={form}
      onClick={onClick}
      disabled={saving || disabled}
      className={cn("q-btn q-btn-primary", size === "lg" && "q-btn-lg", className)}
    >
      {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Check strokeWidth={2.5} aria-hidden />}
      {saving ? "Enregistrement…" : "Enregistrer"}
    </button>
  )
}

/**
 * Barre d'enregistrement mobile, collée au-dessus de la barre de navigation
 * du bas tant qu'il reste des modifications : le bouton d'en-tête est loin
 * après avoir parcouru un long formulaire. Fond opaque, sans backdrop-filter
 * (règle iOS de CLAUDE.md).
 */
export function MobileSaveBar({
  show,
  form,
  saving,
  onClick,
}: {
  show: boolean
  form?: string
  saving?: boolean
  onClick?: () => void
}) {
  if (!show) return null
  return (
    <>
      <div className="h-16 lg:hidden" aria-hidden />
      <div className="q-card fixed inset-x-3 bottom-[calc(96px+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 rounded-2xl p-2 pl-4 shadow-[var(--q-shadow-pop)] lg:hidden">
        <DirtyHint className="flex-1" />
        <SaveButton form={form} saving={saving} onClick={onClick} size="lg" />
      </div>
    </>
  )
}
