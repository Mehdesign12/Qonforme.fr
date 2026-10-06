'use client'

import { useState } from "react"
import { ArrowRight, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

/* ─── Champs des pages d'accès (canevas « Connexion ») ─────────────────────
 * 48 px, rayon 12, 16 px partout : sous ce seuil, iOS Safari zoome la page au
 * focus d'un champ (règle de CLAUDE.md). Couleurs par les jetons --q-* de
 * .q-input, thème sombre compris.
 * ────────────────────────────────────────────────────────────────────────── */
export const AUTH_INPUT = "q-input !h-12 !rounded-xl !px-3.5 !text-base [-webkit-appearance:none]"

/** Libellé, champ, puis erreur ou aide (aide d'identifiant `${id}-hint`, à relier au champ par aria-describedby). */
export function Field({
  id, label, aside, error, hint, children,
}: {
  id: string
  label: React.ReactNode
  /** À droite du libellé : « Mot de passe oublié ? », « facultatif »… */
  aside?: React.ReactNode
  error?: string
  hint?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="q-label">{label}</label>
        {aside}
      </div>
      {children}
      {error
        ? <p id={`${id}-error`} className="q-field-error">{error}</p>
        : hint ? <div id={`${id}-hint`} className="q-field-hint">{hint}</div> : null}
    </div>
  )
}

/**
 * Champ mot de passe avec le bouton texte « Afficher » / « Masquer », atteignable
 * au clavier (Tab depuis le champ) : son libellé dit l'action qu'il fera.
 */
export function PasswordInput({
  id, value, onChange, error, disabled, autoComplete, autoFocus, placeholder, hint,
}: {
  id: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  error?: string
  disabled?: boolean
  autoComplete: "current-password" | "new-password"
  autoFocus?: boolean
  placeholder?: string
  /** Le `Field` parent affiche une aide (`hint`) : le champ la référence tant qu'aucune erreur ne la remplace. */
  hint?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        inputMode="text"
        className={cn(AUTH_INPUT, "!pr-[96px]")}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-controls={id}
        className="absolute right-1.5 top-1.5 h-9 rounded-lg bg-q-sunken px-3 text-[13px] font-semibold text-q-text-2 transition-colors hover:bg-q-hover hover:text-q-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-q-accent touch-manipulation"
      >
        {show ? "Masquer" : "Afficher"}
      </button>
    </div>
  )
}

/** Bouton principal en pilule, 52 px, pleine largeur. */
export function AuthSubmit({
  loading, children, loadingLabel, arrow = true, type = "submit", onClick, className,
}: {
  loading?: boolean
  children: React.ReactNode
  loadingLabel?: string
  arrow?: boolean
  type?: "submit" | "button"
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading}
      className={cn("lp-btn-p w-full touch-manipulation disabled:pointer-events-none disabled:opacity-60", className)}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {loading && loadingLabel ? loadingLabel : children}
      {!loading && arrow && <ArrowRight className="lp-btn-arrow h-[18px] w-[18px]" aria-hidden />}
    </button>
  )
}
