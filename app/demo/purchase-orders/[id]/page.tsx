'use client'

import Link from "next/link"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { EmptyState } from "@/components/app/kit"
import { PurchaseOrderDetailView } from "@/components/purchase-orders/PurchaseOrderDetailView"
import { DEMO_PO_COMPANY, demoPurchaseOrderDetail } from "@/components/purchase-orders/demo"
import { DEMO_TODAY } from "@/lib/demo/data"
import { SignaturePanel } from "@/components/signature/SignaturePanel"
import { demoSignatureActions } from "@/components/signature/demo-actions"
import { demoPublicHref, demoSignaturePanel } from "@/lib/demo/signature"

/** La démo n'enregistre rien : les actions invitent à créer un compte. */
const ctaToast = (what: string) => toast(`Créez un compte pour ${what}`, {
  action: { label: "S'inscrire", onClick: () => { window.location.href = "/signup" } },
})

/** Démo : même fiche que /purchase-orders/[id], alimentée par les données fictives communes. */
export default function DemoPurchaseOrderDetailPage() {
  const params = useParams<{ id: string }>()
  const po = demoPurchaseOrderDetail(params.id)

  if (!po) return (
    <div className="q-card">
      <EmptyState
        title="Bon de commande introuvable"
        text="Ce bon de commande n'existe pas dans la démo."
        action={<Link href="/demo/purchase-orders" className="q-btn q-btn-secondary">Retour aux bons de commande</Link>}
      />
    </div>
  )

  return (
    <PurchaseOrderDetailView
      po={po}
      company={DEMO_PO_COMPANY}
      today={DEMO_TODAY}
      listHref="/demo/purchase-orders"
      companySettingsHref="/demo/settings/company"
      signature={
        <SignaturePanel
          docType="purchase_order"
          docNumber={po.po_number}
          docStatus={po.status}
          totalTtc={po.total_ttc}
          today={DEMO_TODAY}
          clientName={po.client?.name ?? null}
          clientEmail={po.client?.email ?? null}
          clientHref={po.client?.href ?? null}
          data={demoSignaturePanel("purchase_order", po.id)}
          busy={null}
          settingsHref="/demo/settings/invoices"
          demo
          previewHref={demoPublicHref(po.po_number)}
          actions={demoSignatureActions(po.po_number)}
        />
      }
      actions={{
        onDownloadPdf: () => ctaToast("télécharger vos bons de commande en PDF"),
        onSend: async () => { ctaToast("envoyer vos bons de commande par email"); return false },
        onChangeStatus: async () => { ctaToast("suivre vos bons de commande"); return false },
        onDelete: async () => { ctaToast("gérer vos bons de commande"); return false },
        editHref: "/signup",
        busy: { pdf: false, send: false, status: false, delete: false },
      }}
    />
  )
}
