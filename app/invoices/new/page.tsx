import type { Metadata } from "next"
import NewInvoiceForm from "@/components/invoices/NewInvoiceForm"

export const metadata: Metadata = { title: "Nouvelle facture" }

export default function NewInvoicePage() {
  return (
    <div className="max-w-4xl animate-fade-in">
      <NewInvoiceForm />
    </div>
  )
}
