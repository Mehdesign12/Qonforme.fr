import type { Metadata } from "next"
import { ReceivedInvoiceDetail } from "@/components/reception/ReceivedInvoiceDetail"

export const metadata: Metadata = { title: "Facture reçue" }
export const dynamic = "force-dynamic"

interface Props {
  params: Promise<{ id: string }>
}

export default async function ReceivedInvoicePage({ params }: Props) {
  const { id } = await params
  return <ReceivedInvoiceDetail invoiceId={id} />
}
