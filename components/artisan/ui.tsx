/**
 * Petites briques communes aux écrans de la formule Artisan (chantiers,
 * facturation d'un devis), réels et démo.
 */
import { HardHat } from "lucide-react"
import { cn } from "@/lib/utils"
import { StatusPill, type Tone } from "@/components/app/kit"
import type { ChantierStatus } from "@/lib/artisan/chantier"
import { CHANTIER_STATUS_LABELS } from "@/lib/artisan/chantier"

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 })

/** « 1 234,56 € » à partir d'euros. */
export function money(n: number): string {
  return eur.format(Math.round((Number(n) || 0) * 100) / 100)
}

/** « 1 234,56 € » à partir de centimes. */
export function moneyCents(c: number): string {
  return money(Math.round(c) / 100)
}

/** Étiquette « Artisan » : fonction de la formule Artisan. */
export function ArtisanTag({ className }: { className?: string }) {
  return (
    <span className={cn("q-tag gap-1", className)}>
      <HardHat className="size-3" aria-hidden />
      Artisan
    </span>
  )
}

const CHANTIER_TONES: Record<ChantierStatus, Tone> = {
  preparation: "neutral",
  in_progress: "info",
  received: "ok",
  closed: "neutral",
}

export function ChantierStatusPill({ status, className }: { status: ChantierStatus; className?: string }) {
  return <StatusPill tone={CHANTIER_TONES[status]} className={className}>{CHANTIER_STATUS_LABELS[status]}</StatusPill>
}

/** Pastille de nature d'une facture (« Acompte », « Situation n° 2 », « Solde »). */
export function KindPill({ label, className }: { label: string | null | undefined; className?: string }) {
  if (!label) return null
  return <span className={cn("q-tag", className)}>{label}</span>
}

/** Barre de progression avec libellé accessible. */
export function Progress({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className="q-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)}>
      <span style={{ width: `${v}%` }} />
    </div>
  )
}
