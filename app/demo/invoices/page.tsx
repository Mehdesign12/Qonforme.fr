'use client'

export const dynamic = "force-dynamic"

import { toast } from "sonner"
import { Download } from "lucide-react"
import { InvoiceList } from "@/components/invoices/InvoiceList"
import type { InvoiceListItem } from "@/components/invoices/invoice-view"
import { DEMO_CREDIT_NOTES, DEMO_INVOICES, DEMO_TODAY } from "@/lib/demo/data"

/** Miroir de /invoices : même liste, alimentée par les données de démo. */
const ITEMS: InvoiceListItem[] = DEMO_INVOICES.map((inv) => ({
  id: inv.id,
  invoice_number: inv.invoice_number,
  status: inv.status,
  is_archived: false,
  issue_date: inv.issue_date,
  due_date: inv.due_date,
  total_ttc: inv.total_ttc,
  client_name: inv.client.name,
  subject: inv.subject,
}))

const signupToast = (what: string) =>
  toast(`Créez un compte pour ${what}`, {
    action: { label: "S'inscrire", onClick: () => { window.location.href = "/signup" } },
  })

export default function DemoInvoicesPage() {
  return (
    <InvoiceList
      invoices={ITEMS}
      archived={[]}
      today={DEMO_TODAY}
      hrefFor={(id) => `/demo/invoices/${id}`}
      newHref="/demo/invoices/new"
      quoteNewHref="/demo/quotes/new"
      creditNotesHref="/demo/credit-notes"
      creditNotesCount={DEMO_CREDIT_NOTES.length}
      bulk={{
        downloadPdfs: async () => { signupToast("télécharger vos factures en PDF") },
        setArchived: async () => { signupToast("archiver vos factures"); return false },
      }}
      extraActions={
        <button type="button" className="q-btn q-btn-secondary" onClick={() => signupToast("exporter vos écritures comptables")}>
          <Download aria-hidden />
          Export comptable
        </button>
      }
    />
  )
}
