"use client"

/**
 * Rattacher un document existant à un chantier : devis, factures, avoirs et
 * bons de commande sans chantier, ceux du client du chantier en tête. Seul le
 * lien change : le contenu d'un document émis ne bouge pas.
 */
import { useMemo, useState } from "react"
import { Link2, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { SearchField } from "@/components/app/kit"
import { mediumDate, normalize } from "@/components/invoices/invoice-view"
import { invoiceNumberLabel } from "@/lib/utils/document-numbering"
import { money } from "./ui"

export interface AttachCandidateView {
  type: "quote" | "invoice" | "credit_note" | "purchase_order"
  id: string
  number: string | null
  issue_date: string | null
  total_ttc: number
  client_name: string | null
}

const TYPE_LABELS: Record<AttachCandidateView["type"], string> = {
  quote: "Devis", invoice: "Facture", credit_note: "Avoir", purchase_order: "Bon de commande",
}

export function AttachDocumentDialog({
  open, onOpenChange, candidates, loading, busyId, onAttach,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidates: AttachCandidateView[]
  loading?: boolean
  busyId?: string | null
  onAttach: (c: AttachCandidateView) => void
}) {
  const [query, setQuery] = useState("")
  const list = useMemo(() => {
    const q = normalize(query.trim())
    return q ? candidates.filter((c) => normalize([c.number, c.client_name, TYPE_LABELS[c.type]].filter(Boolean).join(" ")).includes(q)) : candidates
  }, [candidates, query])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-[560px]">
        <div className="flex flex-col gap-1 px-[22px] pr-14 pt-5">
          <DialogTitle className="q-display text-[22px] leading-tight text-[var(--q-ink)]">Rattacher un document</DialogTitle>
          <DialogDescription className="text-sm text-[var(--q-text-4)]">
            Un devis rattaché entraîne ses acomptes, situations et solde. Le contenu des documents ne change pas.
          </DialogDescription>
        </div>
        <div className="flex flex-col gap-3 px-[22px] pb-5 pt-4">
          <SearchField value={query} onChange={setQuery} placeholder="Numéro, client…" />
          {loading ? (
            <div className="grid place-items-center py-8"><Loader2 className="size-6 animate-spin text-[var(--q-accent)]" aria-label="Chargement" /></div>
          ) : list.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--q-text-4)]">Aucun document à rattacher.</p>
          ) : (
            <ul className="q-inset flex flex-col divide-y divide-[var(--q-line-soft)] p-0">
              {list.map((c) => (
                <li key={`${c.type}-${c.id}`} className="flex items-center gap-3 px-3 py-2">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm text-[var(--q-ink)]">
                      {TYPE_LABELS[c.type]} <span className="font-mono">{c.type === "invoice" ? invoiceNumberLabel(c.number) : c.number ?? "—"}</span>
                    </span>
                    <span className="truncate text-xs text-[var(--q-text-4)]">{[c.client_name, c.issue_date ? mediumDate(c.issue_date) : null].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums">{money(c.type === "credit_note" ? -c.total_ttc : c.total_ttc)}</span>
                  <button type="button" className="q-btn q-btn-secondary q-btn-sm shrink-0" disabled={busyId === c.id} onClick={() => onAttach(c)}>
                    {busyId === c.id ? <Loader2 className="animate-spin" aria-hidden /> : <Link2 aria-hidden />}
                    Rattacher
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
