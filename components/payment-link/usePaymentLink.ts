"use client"

/**
 * Fiche facture réelle : état du lien de paiement (GET) et actions (POST)
 * sur /api/invoices/[id]/payment-link. Tant que la migration n'est pas
 * appliquée, l'état reste « indisponible » et la fiche garde son affichage
 * d'avant (IBAN seul).
 */
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import type { PaymentLinkState } from "@/lib/payment-link/types"

type Action = "create" | "disable" | "enable" | "dismiss_declaration"

/**
 * `status` : statut de la facture une fois chargée. Rien n'est demandé avant ;
 * l'état est relu à chaque changement de statut (envoi, paiement).
 */
export function usePaymentLink(invoiceId: string, status: string | undefined) {
  const [state, setState] = useState<PaymentLinkState | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!status) return
    const ctrl = new AbortController()
    fetch(`/api/invoices/${invoiceId}/payment-link`, { cache: "no-store", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: PaymentLinkState | null) => { if (json && !ctrl.signal.aborted) setState(json) })
      .catch(() => {})
    return () => ctrl.abort()
  }, [invoiceId, status])

  const act = useCallback(async (action: Action, extra?: Record<string, string>) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payment-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error ?? "Le lien de paiement n'a pas pu être mis à jour."); return false }
      setState(json as PaymentLinkState)
      return true
    } catch {
      toast.error("Erreur réseau")
      return false
    } finally {
      setBusy(false)
    }
  }, [invoiceId])

  return {
    state,
    busy,
    create: async () => { if (await act("create")) toast.success("Lien de paiement créé") },
    enable: async () => { if (await act("enable")) toast.success("Nouveau lien de paiement créé") },
    disable: async () => {
      if (!confirm("Désactiver le lien de paiement ? Votre client ne pourra plus ouvrir la page de règlement depuis l'email.")) return
      if (await act("disable")) toast.success("Lien de paiement désactivé")
    },
    dismiss: async (declarationId: string) => {
      if (!confirm("Vous n'avez pas reçu ce virement ? Le signalement sera retiré et votre client pourra en faire un nouveau.")) return
      if (await act("dismiss_declaration", { declarationId })) toast.success("Signalement retiré")
    },
  }
}
