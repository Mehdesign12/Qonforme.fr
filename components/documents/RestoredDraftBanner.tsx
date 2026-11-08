/**
 * Bandeau « saisie reprise » au-dessus de l'éditeur, quand une copie locale d'un
 * document en cours a été reprise (useDocumentAutosave).
 */
import { History } from "lucide-react"
import type { DocKind } from "./model"
import { parisTime } from "./useDocumentAutosave"

const WHAT: Record<DocKind, string> = {
  quote: "le devis",
  invoice: "la facture",
  purchase_order: "le bon de commande",
}

function dayLabel(ms: number): string {
  const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })
  const today = fmt(new Date())
  const yesterday = fmt(new Date(Date.now() - 86_400_000))
  const day = fmt(new Date(ms))
  if (day === today) return "aujourd'hui"
  if (day === yesterday) return "hier"
  return `le ${new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" })}`
}

export function RestoredDraftBanner({ kind, savedAt, onDiscard }: { kind: DocKind; savedAt: number; onDiscard: () => void }) {
  return (
    <div className="q-banner items-center" role="status">
      <span className="grid size-9 shrink-0 place-items-center text-[var(--q-accent-strong)] q-glyph">
        <History className="size-[18px]" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-[var(--q-ink)]">Vous reprenez {WHAT[kind]} commencé{kind === "invoice" ? "e" : ""} {dayLabel(savedAt)} à {parisTime(savedAt)}</span>
        <span className="block text-[13px] text-[var(--q-text-3)]">Votre saisie était gardée sur cet appareil.</span>
      </span>
      <button type="button" onClick={onDiscard} className="q-btn q-btn-ghost q-btn-sm shrink-0">
        Effacer et recommencer
      </button>
    </div>
  )
}
