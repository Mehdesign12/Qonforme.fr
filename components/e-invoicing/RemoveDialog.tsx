"use client"

/** Confirmation avant de retirer (ou d'annuler) le raccordement à la plateforme. */
import { X } from "lucide-react"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { SUPERPDP_LABEL } from "@/lib/pa/superpdp/config"

export function RemoveDialog({ open, loading, onClose, onConfirm }: { open: boolean; loading: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !loading) onClose() }}>
      <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-[460px]">
        {!loading && (
          <DialogClose className="q-btn q-btn-ghost q-btn-icon absolute right-2 top-2" aria-label="Fermer">
            <X aria-hidden />
          </DialogClose>
        )}
        <div className="flex flex-col gap-3 px-[22px] pb-5 pr-14 pt-5">
          <DialogTitle className="q-display text-[22px] leading-tight text-[var(--q-ink)]">Retirer le raccordement ?</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-[var(--q-text-3)]">
            Qonforme ne relèvera plus vos factures sur {SUPERPDP_LABEL} et l&apos;autorisation donnée est révoquée. Vos
            factures déjà reçues restent dans Qonforme. Votre adresse reste inscrite chez {SUPERPDP_LABEL} : si vous
            changez de plateforme, désignez la nouvelle auprès d&apos;elle.
          </DialogDescription>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--q-line-soft)] px-[22px] py-4">
          <button type="button" className="q-btn q-btn-ghost" onClick={onClose} disabled={loading}>Garder le raccordement</button>
          <button type="button" className="q-btn q-btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? "Retrait…" : "Retirer"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
