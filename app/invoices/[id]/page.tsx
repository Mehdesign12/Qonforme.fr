import type { Metadata } from "next"
import { InvoiceDetail } from "@/components/invoices/InvoiceDetail"

export const metadata: Metadata = { title: "Facture" }
export const dynamic = "force-dynamic"

interface Props {
  params: Promise<{ id: string }>
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params
  return <InvoiceDetail invoiceId={id} />
}
