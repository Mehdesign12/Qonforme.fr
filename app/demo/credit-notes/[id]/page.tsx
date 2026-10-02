"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { EmptyState } from "@/components/app/kit"
import { CreditNoteDetailView } from "@/components/credit-notes/CreditNoteDetailView"
import { DEMO_CREDIT_COMPANY, demoCreditNoteDetail } from "@/components/credit-notes/demo"

/** La démo n'enregistre rien : les actions invitent à créer un compte. */
const ctaToast = (what: string) => toast(`Créez un compte pour ${what}`, {
  action: { label: "S'inscrire", onClick: () => { window.location.href = "/signup" } },
})

/** Démo : même fiche que /credit-notes/[id], alimentée par les données fictives communes. */
export default function DemoCreditNoteDetailPage() {
  const params = useParams<{ id: string }>()
  const note = demoCreditNoteDetail(params.id)

  if (!note) return (
    <div className="q-card">
      <EmptyState
        title="Avoir introuvable"
        text="Cet avoir n'existe pas dans la démo."
        action={<Link href="/demo/credit-notes" className="q-btn q-btn-secondary">Retour aux avoirs</Link>}
      />
    </div>
  )

  return (
    <CreditNoteDetailView
      note={note}
      company={DEMO_CREDIT_COMPANY}
      listHref="/demo/credit-notes"
      companySettingsHref="/demo/settings/company"
      actions={{
        onDownloadPdf: () => ctaToast("télécharger vos avoirs en PDF"),
        onSend: async () => { ctaToast("envoyer vos avoirs par email"); return false },
        busy: { pdf: false, send: false },
      }}
    />
  )
}
