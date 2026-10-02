import type { Metadata } from "next"
import NewInvoiceForm from "@/components/invoices/NewInvoiceForm"

export const metadata: Metadata = { title: "Nouvelle facture" }
export const dynamic = "force-dynamic"

export default function NewInvoicePage() {
  return <NewInvoiceForm />
}
