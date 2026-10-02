'use client'

/**
 * Bouton « Relancer » de la carte « À faire » : même appel que la fiche facture
 * (POST /api/invoices/[id]/remind). Sans formule, la route répond 402 et la
 * fenêtre du mur de paiement s'ouvre ; les autres refus (client sans email,
 * relances déjà envoyées, statut) s'affichent tels quels.
 * En démo : rien n'est envoyé, invitation à créer un compte.
 */
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { PaywallDialog, isSubscriptionRequired } from "@/components/billing/PaywallDialog"

export function RemindButton({
  invoiceId,
  invoiceNumber,
  clientName,
  demo,
}: {
  invoiceId: string
  invoiceNumber: string
  clientName: string
  demo?: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [paywall, setPaywall] = useState(false)

  const remind = async () => {
    if (demo) {
      toast("Créez un compte pour relancer vos clients", {
        action: { label: "S'inscrire", onClick: () => router.push("/signup") },
      })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/remind`, { method: "POST" })
      const json = await res.json().catch(() => null)
      if (isSubscriptionRequired(res.status, json)) { setPaywall(true); return }
      if (!res.ok) { toast.error(json?.error ?? "La relance n'a pas pu être envoyée"); return }
      toast.success(`Relance ${json.reminderNumber} envoyée à ${json.sentTo}`)
      router.refresh()
    } catch {
      toast.error("Erreur réseau, réessayez")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={remind}
        disabled={loading}
        aria-label={`Relancer ${clientName} pour la facture ${invoiceNumber}`}
        className="q-btn q-btn-secondary !h-8 shrink-0 !gap-1.5 !rounded-lg !px-2.5 !text-[13px]"
      >
        {loading && <Loader2 className="animate-spin" aria-hidden />}
        {loading ? "Envoi…" : "Relancer"}
      </button>
      {!demo && (
        <PaywallDialog
          open={paywall}
          onOpenChange={setPaywall}
          invoiceId={invoiceId}
          invoiceNumber={invoiceNumber}
          reason="remind"
        />
      )}
    </>
  )
}
