"use client"

/**
 * Fenêtre d'un changement de statut qui demande une précision : refus (motif
 * obligatoire, tableau des motifs de la DGFiP), litige, approbation partielle,
 * demande de justificatifs. Les règles font foi côté serveur
 * (validateStatusChange) ; elles sont reprises ici pour guider la saisie.
 */
import { useEffect, useId, useState } from "react"
import { Info, X } from "lucide-react"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { REASONS, STATUS_DEFS, validateStatusChange, type ReceivedStatus } from "@/lib/reception/lifecycle"

export type DialogStatus = Extract<ReceivedStatus, "refused" | "disputed" | "partially_approved" | "suspended">

const COPY: Record<DialogStatus, { title: string; confirm: string; reasonLabel?: string; textLabel: string; textHint: string; danger?: boolean }> = {
  refused: {
    title: "Refuser la facture",
    confirm: "Refuser la facture",
    reasonLabel: "Motif du refus",
    textLabel: "Précision (facultative)",
    textHint: "Le fournisseur devra émettre un avoir, puis une nouvelle facture s’il y a lieu.",
    danger: true,
  },
  disputed: {
    title: "Mettre en litige",
    confirm: "Mettre en litige",
    reasonLabel: "Motif du litige",
    textLabel: "Ce qui ne va pas",
    textHint: "Par exemple : « 2 jours de location au lieu de 3 ».",
  },
  partially_approved: {
    title: "Approuver en partie",
    confirm: "Approuver en partie",
    textLabel: "Ce que vous acceptez",
    textHint: "Par exemple : « lignes 1 et 2, soit 525 € HT ; transport contesté ».",
  },
  suspended: {
    title: "Demander des justificatifs",
    confirm: "Suspendre la facture",
    textLabel: "Pièces attendues",
    textHint: "Par exemple : « bon de livraison signé ». La facture reste suspendue jusqu’à leur réception.",
  },
}

export function StatusDialog({
  status,
  invoiceLabel,
  loading,
  onConfirm,
  onClose,
}: {
  /** null : fenêtre fermée. */
  status: DialogStatus | null
  invoiceLabel: string
  loading?: boolean
  onConfirm: (reasonCode: string | null, reason: string | null) => void
  onClose: () => void
}) {
  const [reasonCode, setReasonCode] = useState("")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const ids = useId()

  useEffect(() => {
    if (status) { setReasonCode(""); setReason(""); setError(null) }
  }, [status])

  const copy = status ? COPY[status] : null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!status) return
    const code = copy?.reasonLabel ? reasonCode || null : null
    const invalid = validateStatusChange(status, code, reason)
    if (invalid) { setError(invalid); return }
    onConfirm(code, reason.trim() || null)
  }

  return (
    <Dialog open={!!status} onOpenChange={(o) => { if (!o && !loading) onClose() }}>
      {/* Bouton de fermeture natif : celui de DialogContent passe une ref à Button, qui ne la transmet pas (avertissement React) */}
      <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-[500px]">
        {!loading && (
          <DialogClose className="q-btn q-btn-ghost q-btn-icon absolute right-2 top-2" aria-label="Fermer">
            <X aria-hidden />
          </DialogClose>
        )}
        {status && copy && (
          <form onSubmit={submit} noValidate>
            <div className="flex flex-col gap-1 px-[22px] pr-14 pt-5">
              <DialogTitle className="q-display text-[22px] leading-tight text-[var(--q-ink)]">{copy.title}</DialogTitle>
              <DialogDescription className="text-sm text-[var(--q-text-4)]">
                {invoiceLabel} · statut « {STATUS_DEFS[status].label} » ({STATUS_DEFS[status].code})
              </DialogDescription>
            </div>

            <div className="flex flex-col gap-4 px-[22px] pb-5 pt-[18px]">
              {copy.reasonLabel && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${ids}-reason`} className="q-label">
                    {copy.reasonLabel}{status === "refused" && <span className="text-[var(--q-danger)]"> *</span>}
                  </label>
                  <select
                    id={`${ids}-reason`}
                    className="q-input"
                    value={reasonCode}
                    onChange={(e) => { setReasonCode(e.target.value); setError(null) }}
                  >
                    <option value="">{status === "refused" ? "Choisissez un motif" : "Aucun motif précis"}</option>
                    {REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${ids}-text`} className="q-label">{copy.textLabel}</label>
                <textarea
                  id={`${ids}-text`}
                  className="q-input"
                  rows={3}
                  maxLength={1000}
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); setError(null) }}
                />
                <p className="q-field-hint leading-relaxed">{copy.textHint}</p>
              </div>

              {error && <p className="q-field-error" role="alert">{error}</p>}

              <div className="q-banner text-[13px] leading-normal">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p>
                  Ce statut est enregistré dans Qonforme. Qonforme n&apos;est pas encore raccordé à une plateforme
                  agréée : prévenez vous-même votre fournisseur.
                </p>
              </div>
            </div>

            <div
              className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-[22px] py-4"
              style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))" }}
            >
              <button type="button" className="q-btn q-btn-secondary" onClick={onClose} disabled={loading}>Annuler</button>
              <button type="submit" className={copy.danger ? "q-btn q-btn-danger" : "q-btn q-btn-primary"} disabled={loading} aria-busy={loading || undefined}>
                {loading ? "Enregistrement…" : copy.confirm}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
