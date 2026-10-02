"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { Check, Copy, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Contrôles interactifs des outils (Fondations › Contrôles et Champs) :
 * contrôle segmenté, choix en cartes, champ de montant, interrupteur,
 * boutons Copier et Réinitialiser. Jetons --q-* uniquement.
 */

/* ─────────────────────────────────────────────────────────
   Contrôle segmenté (.q-seg, aria-pressed)
───────────────────────────────────────────────────────── */
export function Seg<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className,
}: {
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
  /** Nom accessible du groupe. */
  label: string
  size?: "sm" | "md"
  className?: string
}) {
  return (
    <div role="group" aria-label={label} className={cn("q-seg", size === "md" && "[&>button]:h-9 [&>button]:px-4 [&>button]:text-[14px]", className)}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   Choix en cartes (radio) : taux de TVA, activité, délai…
───────────────────────────────────────────────────────── */
export function ChoiceGroup<T extends string | number>({
  options,
  value,
  onChange,
  label,
  columns = 1,
  dot = true,
  className,
}: {
  options: { value: T; label: ReactNode; desc?: ReactNode; lead?: ReactNode }[]
  value: T
  onChange: (v: T) => void
  label: string
  columns?: 1 | 2
  /** Pastille radio à gauche. */
  dot?: boolean
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2", className)}>
      {options.map((o) => {
        const on = value === o.value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex min-h-[52px] w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-[border-color,background-color,box-shadow] duration-150",
              "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)]",
              on ? "border-q-accent bg-q-wash shadow-[0_0_0_1px_var(--q-accent)]" : "border-q-line bg-q-surface hover:border-q-field hover:bg-q-hover",
            )}
          >
            {o.lead}
            {dot && !o.lead && (
              <span aria-hidden className={cn("grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2", on ? "border-q-accent bg-q-accent" : "border-q-field bg-q-surface")}>
                {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
            )}
            <span className="min-w-0">
              <span className={cn("block text-[14px] font-semibold leading-[1.35]", on ? "text-q-accent-ink dark:text-q-ink" : "text-q-ink")}>{o.label}</span>
              {o.desc && <span className="mt-0.5 block text-[12px] leading-[1.4] text-q-text-4">{o.desc}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   Champ de montant : 48 px, chiffres tabulaires, unité à droite.
   16 px sur mobile (règle iOS), 20 px dès 768 px.
───────────────────────────────────────────────────────── */
export function AmountInput({
  id,
  value,
  onChange,
  placeholder,
  suffix = "€",
  autoFocus,
  inputMode = "decimal",
  mono,
  onKeyDown,
  ariaDescribedBy,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  suffix?: string
  autoFocus?: boolean
  inputMode?: "decimal" | "numeric"
  /** Références (SIREN) : DM Mono. */
  mono?: boolean
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  ariaDescribedBy?: string
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-describedby={ariaDescribedBy}
        className={cn(
          "q-input !h-12 font-semibold tabular-nums md:!text-[20px]",
          mono && "font-mono tracking-[0.04em]",
          suffix && "pr-16",
        )}
      />
      {suffix && (
        <span aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[15px] font-medium text-q-text-4">
          {suffix}
        </span>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   Interrupteur avec libellé (Fondations › Contrôles)
───────────────────────────────────────────────────────── */
export function SwitchRow({
  checked,
  onChange,
  label,
  desc,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
  desc?: ReactNode
  /** Contenu révélé sous le libellé quand l'option est active. */
  children?: ReactNode
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-q-line bg-q-surface px-4 py-3.5">
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-[14px] font-semibold text-q-ink">
          {label}
        </label>
        {desc && <p className="mt-0.5 text-[13px] text-q-text-4">{desc}</p>}
        {checked && children && <div className="mt-3">{children}</div>}
      </div>
      <button id={id} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="q-switch mt-0.5 shrink-0" />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   Copier (état « Copié » 2 s) et Réinitialiser
───────────────────────────────────────────────────────── */
export function CopyButton({
  text,
  label = "Copier le résultat",
  size = "sm",
  iconOnly,
  className,
}: {
  text: string
  label?: string
  size?: "sm" | "md"
  iconOnly?: boolean
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const onClick = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      className={cn("q-btn q-btn-ghost", size === "sm" && "q-btn-sm", iconOnly && "q-btn-icon", className)}
    >
      {copied ? <Check className="text-q-ok" aria-hidden /> : <Copy aria-hidden />}
      {!iconOnly && <span aria-live="polite">{copied ? "Copié" : label}</span>}
      {iconOnly && copied && <span className="sr-only" aria-live="polite">Copié</span>}
    </button>
  )
}

export function ResetButton({ onClick, label = "Réinitialiser", className }: { onClick: () => void; label?: string; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("q-btn q-btn-ghost q-btn-sm", className)}>
      <RotateCcw aria-hidden />
      {label}
    </button>
  )
}
