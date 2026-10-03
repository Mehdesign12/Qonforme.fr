'use client'

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { Inbox } from "lucide-react"
import { EmptyState } from "@/components/app/kit"
import { ReceivedInvoiceDetailView } from "@/components/reception/ReceivedInvoiceDetailView"
import { DEMO_TODAY } from "@/lib/demo/data"
import { demoReceived } from "@/lib/demo/reception"
import { STATUS_DEFS, canTransition, type ReceivedStatus } from "@/lib/reception/lifecycle"
import type { ReceivedDetail } from "@/lib/reception/view"

const signupToast = (what: string) =>
  toast(`Créez un compte pour ${what}`, {
    action: { label: "S'inscrire", onClick: () => { window.location.href = "/signup" } },
  })

/**
 * Miroir de /received-invoices/[id] : même fiche, données de démo. Les
 * décisions s'appliquent à cette page seulement (rien n'est enregistré).
 */
export default function DemoReceivedInvoicePage() {
  const params = useParams()
  const initial = demoReceived(String(params.id ?? ""))
  const [invoice, setInvoice] = useState<ReceivedDetail | undefined>(initial)

  if (!invoice) {
    return (
      <section className="q-card">
        <EmptyState
          icon={<Inbox className="size-5" aria-hidden />}
          title="Facture introuvable"
          text="Cette facture n'existe pas dans la démo."
          action={<Link href="/demo/received-invoices" className="q-btn q-btn-secondary">Retour aux factures reçues</Link>}
        />
      </section>
    )
  }

  const changeStatus = async (to: ReceivedStatus, reasonCode?: string | null, reason?: string | null) => {
    if (!canTransition(invoice.status, to)) return false
    const now = new Date().toISOString()
    const code = to === "suspended" ? reasonCode || "JUSTIF_ABS" : to === "refused" || to === "disputed" ? reasonCode ?? null : null
    setInvoice({
      ...invoice,
      status: to,
      status_reason_code: code,
      status_reason: reason ?? null,
      status_changed_at: now,
      events: [...invoice.events, {
        id: `demo-${invoice.events.length + 1}`, status: to, code: STATUS_DEFS[to].code, reason_code: code,
        reason: reason ?? null, actor: "user", transmitted_at: null, created_at: now,
      }],
    })
    toast.success(`Démo : statut « ${STATUS_DEFS[to].label} » appliqué sur cette page seulement`)
    return true
  }

  return (
    <ReceivedInvoiceDetailView
      invoice={invoice}
      today={DEMO_TODAY}
      backHref="/demo/received-invoices"
      pdfUrl={null}
      hrefFor={(id) => `/demo/received-invoices/${id}`}
      handlers={{
        changeStatus,
        download: () => signupToast("télécharger les fichiers de vos fournisseurs"),
        remove: invoice.status === "received" ? () => signupToast("gérer vos factures reçues") : undefined,
      }}
    />
  )
}
