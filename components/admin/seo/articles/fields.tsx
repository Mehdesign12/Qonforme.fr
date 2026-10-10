"use client"

/**
 * Champs partagés des fenêtres Articles : menu déroulant au style du kit,
 * jour et heure de Paris avec les créneaux libres du rythme, choix du mode de
 * publication en vraies cartes radio. Champs à 16 px sur téléphone.
 */
import { Children, cloneElement, isValidElement } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { PUBLISH_MODE_LABELS, type PublishMode } from "@/lib/seo/types"
import type { Slot } from "@/lib/seo/articles/schedule"
import { shortDay, weekdayDay } from "@/lib/seo/articles/schedule"

export function Field({ label, htmlFor, hint, error, children, className }: { label: React.ReactNode; htmlFor?: string; hint?: React.ReactNode; error?: string | null; children: React.ReactNode; className?: string }) {
  const messageId = htmlFor && (error || hint) ? `${htmlFor}-${error ? "erreur" : "aide"}` : undefined
  // Aide et erreur reliées au champ (aria-describedby), champ en erreur signalé (aria-invalid)
  const only = Children.count(children) === 1 ? Children.only(children) : null
  const linked =
    only && isValidElement<Record<string, unknown>>(only) && only.type !== "div" && htmlFor
      ? cloneElement(only, {
          ...(messageId ? { "aria-describedby": messageId } : {}),
          ...(error ? { "aria-invalid": true } : {}),
        })
      : children
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="q-label">
          {label}
        </label>
      ) : (
        <span className="q-label">{label}</span>
      )}
      {linked}
      {error ? (
        <span id={messageId} role="alert" className="q-field-error">
          {error}
        </span>
      ) : hint ? (
        <span id={messageId} className="q-field-hint">
          {hint}
        </span>
      ) : null}
    </div>
  )
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={cn("q-input appearance-none pr-9", className)}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--q-text-4)]" aria-hidden />
    </div>
  )
}

/** « Lun. 13 oct. à 08:00 ». */
export function slotLabel(slot: Pick<Slot, "day" | "time">): string {
  return `${weekdayDay(slot.day)} à ${slot.time}`
}

export function dayTimeLabel(day: string, time: string): string {
  return `${shortDay(day)} à ${time}`
}

/** Jour et heure de Paris, avec les prochains créneaux libres du rythme en raccourcis. */
export function ScheduleFields({
  idPrefix,
  day,
  time,
  onChange,
  slots,
  error,
}: {
  idPrefix: string
  day: string
  time: string
  onChange: (next: { day: string; time: string }) => void
  slots: Slot[]
  error?: string | null
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Jour" htmlFor={`${idPrefix}-day`}>
          <input id={`${idPrefix}-day`} type="date" className="q-input" value={day} onChange={(e) => onChange({ day: e.target.value, time })} required />
        </Field>
        <Field label="Heure (Paris)" htmlFor={`${idPrefix}-time`}>
          <input id={`${idPrefix}-time`} type="time" step={900} className="q-input" value={time} onChange={(e) => onChange({ day, time: e.target.value })} required />
        </Field>
      </div>
      {slots.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="q-field-hint">Créneaux libres du rythme :</span>
          <div role="group" aria-label="Créneaux libres" className="flex flex-wrap gap-2">
            {slots.map((s) => {
              const active = s.day === day && s.time === time
              return (
                <button
                  key={s.at}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ day: s.day, time: s.time })}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full border px-3 text-[13px] font-semibold md:min-h-8",
                    active ? "border-[var(--q-accent)] bg-[var(--q-wash)] text-[var(--q-accent-strong)]" : "border-[var(--q-line)] bg-[var(--q-surface)] text-[var(--q-text-2)]",
                  )}
                >
                  {slotLabel(s)}
                </button>
              )
            })}
          </div>
        </div>
      )}
      {error && (
        <span role="alert" className="q-field-error">
          {error}
        </span>
      )}
    </div>
  )
}

export interface RadioOption<T extends string> {
  value: T
  label: string
  hint?: string
  badge?: string
}

/** Choix exclusifs en cartes radio (vrais <input type="radio">). */
export function RadioCards<T extends string>({
  name,
  legend,
  legendHidden,
  value,
  options,
  onChange,
  columns,
  describedBy,
}: {
  name: string
  legend: string
  legendHidden?: boolean
  value: T
  options: RadioOption<T>[]
  onChange: (value: T) => void
  /** Cartes côte à côte sur ordinateur. */
  columns?: boolean
  describedBy?: string
}) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className={legendHidden ? "sr-only" : "q-label pb-2"}>{legend}</legend>
      <div className={cn("grid gap-2", columns && "md:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] md:gap-3")}>
        {options.map((o) => {
          const id = `${name}-${o.value}`
          const checked = o.value === value
          return (
            <label
              key={o.value}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-xl border px-3.5 py-2.5",
                columns && "md:p-4",
                checked ? "border-[var(--q-accent)] bg-[var(--q-wash)]" : "border-[var(--q-field)] bg-[var(--q-surface)]",
              )}
            >
              <span className="flex items-center gap-2.5">
                <input
                  type="radio"
                  id={id}
                  name={name}
                  value={o.value}
                  checked={checked}
                  onChange={() => onChange(o.value)}
                  aria-describedby={describedBy}
                  className="size-[18px] shrink-0 accent-[var(--q-accent)]"
                />
                <span className="text-sm font-semibold text-[var(--q-ink)]">{o.label}</span>
                {o.badge && <span className="q-tag ml-auto">{o.badge}</span>}
              </span>
              {o.hint && <span className="pl-7 text-[13px] text-[var(--q-text-3)]">{o.hint}</span>}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/**
 * Description des modes, la même partout (fenêtres des sujets, fiche d'un sujet,
 * Préférences) : le mode « directement » ne laisse jamais croire que rien ne
 * retient l'article.
 */
export const PUBLISH_MODE_HINTS: Record<PublishMode, string> = {
  draft: "L'article arrive en brouillon ; vous le relisez, puis vous le publiez.",
  after_check: "L'article est publié seulement si le contrôle ne signale rien du tout ; au moindre signalement, il reste en brouillon.",
  direct:
    "L'article est publié dès qu'il est prêt, sauf valeur périmée, affirmation interdite ou concurrent nommé, que le contrôle retient toujours ; un simple signalement (comme « PDP ») ne le bloque pas.",
}

/** Les trois modes de publication des sujets (libellés de lib/seo/types.ts). */
export const PUBLISH_MODE_OPTIONS: RadioOption<PublishMode>[] = (["draft", "after_check", "direct"] as PublishMode[]).map((value) => ({
  value,
  label: PUBLISH_MODE_LABELS[value].label,
  hint: PUBLISH_MODE_HINTS[value],
}))
