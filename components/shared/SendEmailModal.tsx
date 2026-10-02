'use client'

import { useState } from "react"
import { AlertCircle, Info, Mail, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"

interface SendEmailModalProps {
  /** URL de la route API POST /send */
  apiUrl:       string
  /** Numéro du document (facture, devis, avoir) */
  docNumber:    string
  /** Type de document */
  docType:      "facture" | "devis" | "avoir"
  /** Email du client (affiché dans la modale) */
  clientEmail:  string | null | undefined
  /** Nom du client */
  clientName:   string
  /**
   * @deprecated Accent unique du kit (bleu Qonforme) : la couleur n'est plus
   * personnalisable ici. Conservé pour ne pas casser les appels existants.
   */
  accentColor?: string
  /** Callback après envoi réussi (pour mettre à jour le statut localement) */
  onSent?:      () => void
  /** Désactiver si non applicable (pas d'email client, etc.) */
  disabled?:    boolean
}

/**
 * Bouton « Envoyer par email » et sa fenêtre de confirmation (kit : voile
 * sombre, fenêtre rayon 20, titre Bricolage, pied grisé).
 */
export default function SendEmailModal({
  apiUrl, docNumber, docType, clientEmail, clientName, onSent, disabled,
}: SendEmailModalProps) {
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)

  const docLabel = docType === "facture" ? "la facture" : docType === "devis" ? "le devis" : "l'avoir"

  const handleSend = async () => {
    if (!clientEmail) return
    setLoading(true)
    try {
      const res = await fetch(apiUrl, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Erreur inconnue")
      toast.success(`${docType === "facture" ? "Facture" : docType === "devis" ? "Devis" : "Avoir"} envoyé à ${clientEmail}`)
      setOpen(false)
      onSent?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Bouton déclencheur */}
      <Button
        size="sm"
        disabled={disabled || !clientEmail}
        title={!clientEmail ? "Le client n'a pas d'adresse email" : `Envoyer ${docLabel} par email`}
        onClick={() => setOpen(true)}
      >
        <Mail />
        Envoyer par email
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o && !loading) setOpen(false) }}>
        <DialogContent showCloseButton={!loading} className="gap-0 overflow-hidden p-0 sm:max-w-[500px]">
          {/* En-tête */}
          <div className="flex flex-col gap-1 px-[22px] pr-14 pt-5">
            <DialogTitle className="q-display text-[22px] leading-tight text-[var(--q-ink)]">
              Envoyer {docLabel}
            </DialogTitle>
            <DialogDescription className="text-sm text-[var(--q-text-4)]">
              <span className="font-mono">{docNumber}</span> · {clientName}
            </DialogDescription>
          </div>

          {/* Corps */}
          <div className="flex flex-col gap-3.5 px-[22px] pb-5 pt-[18px]">
            {clientEmail ? (
              <div className="q-inset px-4 py-3.5 text-sm">
                <span className="mb-1 block text-xs text-[var(--q-text-4)]">Destinataire</span>
                <span className="block font-medium text-[var(--q-ink)]">{clientName}</span>
                <span className="block text-[13px] text-[var(--q-text-3)]">{clientEmail}</span>
              </div>
            ) : (
              <div className="q-banner q-banner-warn text-[13px] leading-normal">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p>Aucune adresse email associée à ce client. Ajoutez-en une dans la fiche client.</p>
              </div>
            )}

            {clientEmail && (
              <div className="q-banner text-[13px] leading-normal">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p>
                  Le PDF est joint automatiquement à l&apos;email et une copie vous est adressée.
                  {docType !== "avoir" && <> Le statut du document passera à <strong>Envoyé</strong>.</>}
                </p>
              </div>
            )}
          </div>

          {/* Pied */}
          <div
            className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-[22px] py-4"
            style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))" }}
          >
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Annuler
            </Button>
            <Button disabled={loading || !clientEmail} onClick={handleSend}>
              <Send />
              {loading ? "Envoi en cours…" : "Envoyer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
