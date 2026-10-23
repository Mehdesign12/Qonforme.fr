"use client"

/**
 * Difficulté d'un mot-clé (DataForSEO, 0 à 100) : libellé et pastille colorée,
 * partagés par le sélecteur de mot-clé, sa mesure et la Proposition IA.
 */
import { cn } from "@/lib/utils"

const nf = (n: number) => Math.round(n).toLocaleString("fr-FR")

export type DifficultyTone = "ok" | "warn" | "danger"

/** Difficulté DataForSEO (0 à 100) : Facile sous 30, Moyenne sous 60, sinon Difficile. */
export function difficultyOf(value: number | null): { label: string; tone: DifficultyTone } | null {
  if (value === null || !Number.isFinite(value)) return null
  if (value < 30) return { label: "Facile", tone: "ok" }
  if (value < 60) return { label: "Moyenne", tone: "warn" }
  return { label: "Difficile", tone: "danger" }
}

const MINI_PILL: Record<DifficultyTone, string> = {
  ok: "bg-[var(--q-ok-bg)] text-[var(--q-ok)]",
  warn: "bg-[var(--q-warn-bg)] text-[var(--q-warn)]",
  danger: "bg-[var(--q-danger-bg)] text-[var(--q-danger)]",
}

export function DifficultyPill({ value, className }: { value: number | null; className?: string }) {
  const d = difficultyOf(value)
  if (!d) return null
  return (
    <span className={cn("inline-flex h-[18px] items-center rounded-full px-1.5 text-[11px] font-semibold leading-none", MINI_PILL[d.tone], className)} title={`Difficulté ${nf(value ?? 0)} sur 100`}>
      {d.label}
    </span>
  )
}
