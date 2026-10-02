'use client'

import Link from "next/link"
import { toast } from "sonner"
import { FileX2 } from "lucide-react"
import { EmptyState } from "@/components/app/kit"
import { QuoteDetailView, type QuoteDetailData } from "@/components/quotes/QuoteDetailView"
import { DEMO_COMPANY, DEMO_TODAY, demoInvoice, demoQuote } from "@/lib/demo/data"

/** La démo n'enregistre rien : chaque action invite à créer un compte. */
const ctaToast = (what: string) => toast(`Créez un compte pour ${what}`, {
  action: { label: "S'inscrire", onClick: () => { window.location.href = "/signup" } },
})

/** Démo : même fiche que /quotes/[id], alimentée par les données fictives communes. */
export default function DemoQuoteDetailPage({ params }: { params: { id: string } }) {
  const q = demoQuote(params.id)

  if (!q) return (
    <div className="q-card">
      <EmptyState
        icon={<FileX2 className="size-6" strokeWidth={1.75} aria-hidden />}
        title="Devis introuvable"
        text="Ce devis n'existe pas dans la démo."
        action={<Link href="/demo/quotes" className="q-btn q-btn-secondary">Retour aux devis</Link>}
      />
    </div>
  )

  const invoice = q.converted_invoice_number ? demoInvoice(q.converted_invoice_number) : undefined
  const data: QuoteDetailData = {
    id: q.id,
    quote_number: q.quote_number,
    status: q.status,
    issue_date: q.issue_date,
    valid_until: q.valid_until,
    subject: q.subject,
    lines: q.lines,
    subtotal_ht: q.subtotal_ht,
    total_vat: q.total_vat,
    total_ttc: q.total_ttc,
    notes: q.notes ?? null,
    client: { ...q.client, href: `/demo/clients/${q.client.id}` },
    converted: !!q.converted_invoice_number,
    converted_invoice: q.converted_invoice_number
      ? { number: q.converted_invoice_number, status: invoice?.status ?? null, href: `/demo/invoices/${q.converted_invoice_number.toLowerCase()}` }
      : null,
  }

  return (
    <QuoteDetailView
      quote={data}
      company={DEMO_COMPANY}
      today={DEMO_TODAY}
      demo
      links={{ list: "/demo/quotes", newQuote: "/demo/quotes/new", companySettings: "/demo/settings/company" }}
      actions={{
        onDownloadPdf: () => ctaToast("télécharger vos devis en PDF"),
        onPrint: () => window.print(),
        onDuplicate: () => ctaToast("dupliquer vos devis"),
        onEdit: () => ctaToast("modifier vos devis"),
        onDelete: () => ctaToast("gérer vos devis"),
        onSend: async () => { ctaToast("envoyer vos devis par email"); return false },
        onSetStatus: async () => { ctaToast("suivre l'accord de vos clients"); return false },
        onConvert: () => ctaToast("convertir vos devis en factures"),
      }}
    />
  )
}
