'use client'

import Link from "next/link"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { FileText } from "lucide-react"
import { EmptyState } from "@/components/app/kit"
import { InvoiceDetailView } from "@/components/invoices/InvoiceDetailView"
import type { CompanyView, InvoiceView } from "@/components/invoices/invoice-view"
import { DEMO_COMPANY, DEMO_TODAY, demoInvoice } from "@/lib/demo/data"

/** Miroir de /invoices/[id] : même fiche, données de démo, rien n'est enregistré ni envoyé. */
const COMPANY: CompanyView = {
  name: DEMO_COMPANY.name,
  address: DEMO_COMPANY.address,
  zip_code: DEMO_COMPANY.zip_code,
  city: DEMO_COMPANY.city,
  siren: DEMO_COMPANY.siren,
  vat_number: DEMO_COMPANY.vat_number,
  iban: DEMO_COMPANY.iban,
}

const signupToast = (what: string) =>
  toast(`Créez un compte pour ${what}`, {
    action: { label: "S'inscrire", onClick: () => { window.location.href = "/signup" } },
  })

export default function DemoInvoiceDetailPage() {
  const params = useParams()
  const data = demoInvoice(String(params.id ?? ""))

  if (!data) {
    return (
      <section className="q-card">
        <EmptyState
          icon={<FileText className="size-5" aria-hidden />}
          title="Facture introuvable"
          text="Cette facture n'existe pas dans la démo."
          action={<Link href="/demo/invoices" className="q-btn q-btn-secondary">Retour aux factures</Link>}
        />
      </section>
    )
  }

  const invoice: InvoiceView = {
    id: data.id,
    invoice_number: data.invoice_number,
    status: data.status,
    is_archived: false,
    issue_date: data.issue_date,
    due_date: data.due_date,
    created_at: data.issue_date,
    sent_at: data.sent_at ?? null,
    paid_at: data.paid_at ?? null,
    subject: data.subject,
    lines: data.lines,
    subtotal_ht: data.subtotal_ht,
    total_vat: data.total_vat,
    total_ttc: data.total_ttc,
    notes: data.notes ?? `Paiement à ${DEMO_COMPANY.payment_terms} par virement.`,
    client: {
      id: data.client.id,
      name: data.client.name,
      email: data.client.email,
      address: data.client.address,
      zip_code: data.client.zip_code,
      city: data.client.city,
      siren: data.client.siren ?? null,
    },
  }

  return (
    <InvoiceDetailView
      invoice={invoice}
      company={COMPANY}
      today={DEMO_TODAY}
      backHref="/demo/invoices"
      clientHref={`/demo/clients/${data.client.id}`}
      quote={data.quote_number ? { number: data.quote_number, href: `/demo/quotes/${data.quote_number.toLowerCase()}` } : null}
      creditNotesHref="/demo/credit-notes"
      settingsCompanyHref="/demo/settings"
      handlers={{
        downloadPdf: () => signupToast("télécharger vos factures en PDF"),
        downloadFacturX: () => signupToast("télécharger le XML Factur-X"),
        print: () => window.print(),
        onEdit: () => signupToast("modifier vos brouillons"),
        deleteDraft: () => signupToast("gérer vos brouillons"),
        toggleArchive: () => signupToast("archiver vos factures"),
        openCredit: () => signupToast("créer des avoirs"),
        remind: () => signupToast("relancer vos clients"),
        openSend: () => signupToast("envoyer vos factures par email"),
        changeStatus: () => signupToast("suivre vos paiements"),
      }}
    />
  )
}
