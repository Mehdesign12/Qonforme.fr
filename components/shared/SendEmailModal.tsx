'use client'

import { useState } from "react"
import { Mail, Loader2, X, Send, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  /** Couleur accent */
  accentColor?: string
  /** Callback après envoi réussi (pour mettre à jour le statut localement) */
  onSent?:      () => void
  /** Désactiver si non applicable (pas d'email client, etc.) */
  disabled?:    boolean
}

export default function SendEmailModal({
  apiUrl, docNumber, docType, clientEmail, clientName,
  accentColor = "#2563EB", onSent, disabled,
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
        variant="default"
        size="sm"
        className="gap-1.5"
        disabled={disabled || !clientEmail}
        title={!clientEmail ? "Le client n'a pas d'adresse email" : `Envoyer ${docLabel} par email`}
        onClick={() => setOpen(true)}
        style={{ backgroundColor: accentColor, borderColor: accentColor }}
      >
        <Mail className="w-4 h-4" />
        Envoyer par email
      </Button>

      {/* Modale */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 md:backdrop-blur-sm"
            onClick={() => !loading && setOpen(false)}
          />

          {/* Carte modale */}
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentColor}15` }}>
                  <Mail className="w-4 h-4" style={{ color: accentColor }} />
                </div>
                <h2 className="text-base font-semibold text-slate-900">
                  Envoyer {docLabel}
                </h2>
              </div>
              <button
                onClick={() => !loading && setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corps */}
            <div className="px-6 py-5 space-y-4">

              {/* Récapitulatif document */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ backgroundColor: `${accentColor}15` }}>
                  <Send className="w-4 h-4" style={{ color: accentColor }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{docNumber}</p>
                  <p className="text-xs text-slate-500 capitalize">{docType}</p>
                </div>
              </div>

              {/* Destinataire */}
              {clientEmail ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Destinataire</p>
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-200">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{clientName}</p>
                      <p className="text-xs text-slate-500">{clientEmail}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-700">
                    Aucune adresse email associée à ce client. Ajoutez-en une dans la fiche client.
                  </p>
                </div>
              )}

              {/* Info envoi */}
              {clientEmail && (
                <div className="text-xs text-slate-500 leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <p>Le PDF sera joint automatiquement à l&apos;email.</p>
                  <p className="mt-1">Une copie sera envoyée à votre adresse email.</p>
                  <p className="mt-1">Le statut du document passera à <strong>Envoyé</strong>.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50"
              style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Annuler
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={loading || !clientEmail}
                onClick={handleSend}
                style={{ backgroundColor: accentColor, borderColor: accentColor }}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Envoi en cours…</>
                ) : (
                  <><Send className="w-4 h-4" /> Envoyer</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
