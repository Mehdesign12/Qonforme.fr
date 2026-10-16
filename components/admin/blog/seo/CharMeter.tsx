/**
 * Compteur de caractères des champs du panneau Référencement (titre Google,
 * description, adresse, chapeau) : « 52 / 60 » en couleur et barre de 3 px
 * avec la zone conseillée en fond.
 *
 * - vert : dans la zone conseillée ;
 * - ambre : trop court, ou au-delà de la zone sans dépasser le maximum ;
 * - rouge : au-delà du maximum (Google coupe) ;
 * - gris : champ vide.
 * Le texte lu par les lecteurs d'écran (« 52 caractères, 45 à 60
 * conseillés ») porte `id` : le champ le relie par aria-describedby. Aucune
 * annonce à chaque frappe.
 *
 * Sans hook : rendu serveur et client.
 */
import { cn } from "@/lib/utils"

export type CharTone = "ok" | "warn" | "danger" | "neutral"

export function charTone(length: number, idealMin: number, idealMax: number, max: number): CharTone {
  if (length === 0) return "neutral"
  if (length > max) return "danger"
  if (length >= idealMin && length <= idealMax) return "ok"
  return "warn"
}

const TEXT: Record<CharTone, string> = {
  ok: "text-[var(--q-ok)]",
  warn: "text-[var(--q-warn)]",
  danger: "text-[var(--q-danger)]",
  neutral: "text-[var(--q-text-4)]",
}

const FILL: Record<CharTone, string> = {
  ok: "bg-[var(--q-ok)]",
  warn: "bg-[var(--q-warn)]",
  danger: "bg-[var(--q-danger)]",
  neutral: "bg-[var(--q-field)]",
}

const nf = (n: number) => n.toLocaleString("fr-FR")

export function CharMeter({
  length,
  idealMin,
  idealMax,
  max,
  id,
  className,
}: {
  length: number
  idealMin: number
  idealMax: number
  /** Au-delà, Google coupe (ou la proposition est refusée). */
  max: number
  /** Texte d'accessibilité (aria-describedby du champ). */
  id?: string
  className?: string
}) {
  const tone = charTone(length, idealMin, idealMax, max)
  // Échelle : un peu au-delà du maximum, pour voir le dépassement
  const scale = Math.max(max * 1.12, length, 1)
  const pct = (n: number) => `${Math.min(100, (n / scale) * 100)}%`
  const spoken =
    length === 0
      ? `Vide : ${nf(idealMin)} à ${nf(idealMax)} caractères conseillés.`
      : `${nf(length)} caractère${length > 1 ? "s" : ""}, ${nf(idealMin)} à ${nf(idealMax)} conseillés${length > max ? `, ${nf(max)} au plus : trop long` : ""}.`

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="relative h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--q-line-soft)]" aria-hidden>
        {/* Zone conseillée */}
        <span className="absolute inset-y-0 bg-[var(--q-ok-line)] opacity-70" style={{ left: pct(idealMin), width: `calc(${pct(idealMax)} - ${pct(idealMin)})` }} />
        {/* Remplissage */}
        <span
          className={cn("absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-150 motion-reduce:transition-none", FILL[tone])}
          style={{ width: pct(length) }}
        />
        {/* Maximum */}
        <span className="absolute inset-y-0 w-px bg-[var(--q-danger-line)]" style={{ left: pct(max) }} />
      </span>
      <span className={cn("q-num shrink-0 text-[12px] font-semibold tabular-nums", TEXT[tone])} aria-hidden>
        {nf(length)}
        <span className="font-normal text-[var(--q-text-4)]"> / {nf(idealMax)}</span>
      </span>
      {id ? (
        <span id={id} className="sr-only">
          {spoken}
        </span>
      ) : (
        <span className="sr-only">{spoken}</span>
      )}
    </div>
  )
}
