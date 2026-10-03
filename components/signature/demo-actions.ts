"use client"

/**
 * Actions du panneau « Signature en ligne » dans la démo : rien n'est envoyé ;
 * le lien mène à la démo de la page du client (/signer/demo/<numéro>).
 */
import { toast } from "sonner"
import type { SignaturePanelActions } from "@/components/signature/SignaturePanel"
import { demoPublicHref } from "@/lib/demo/signature"

const ctaToast = (what: string) => toast(`Créez un compte pour ${what}`, {
  action: { label: "S'inscrire", onClick: () => { window.location.href = "/signup" } },
})

export function demoSignatureActions(number: string): SignaturePanelActions {
  const href = demoPublicHref(number)
  const absolute = () => (typeof window === "undefined" ? href : `${window.location.origin}${href}`)
  return {
    link: async () => absolute(),
    send: async () => { ctaToast("envoyer vos documents pour signature"); return false },
    renew: async () => { ctaToast("gérer vos liens de signature"); return null },
    disable: async () => { ctaToast("gérer vos liens de signature"); return false },
    downloadSigned: () => ctaToast("télécharger vos documents signés"),
    upgrade: () => ctaToast("signer vos devis en ligne"),
    onSite: () => { window.location.href = `${href}?sur-place=1` },
  }
}
