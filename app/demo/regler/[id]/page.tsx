import type { Metadata } from "next"
import { PaymentPage } from "@/components/payment-link/PaymentPage"
import { DEMO_TODAY } from "@/lib/demo/data"
import { demoPaymentPage } from "@/lib/demo/payment-link"

/**
 * Démo de la page de règlement : la même page que celle que reçoit le client
 * (/regler/[jeton]), données fictives, rien n'est envoyé. Hors de la coque de
 * l'application (voir DemoFrame, app/demo/layout.tsx), comme la vraie.
 */

export const metadata: Metadata = {
  title: "Page de règlement — Démo Qonforme",
  robots: { index: false, follow: false },
}

interface Props { params: Promise<{ id: string }> }

export default async function DemoPaymentLinkPage({ params }: Props) {
  const { id } = await params
  const data = demoPaymentPage(id)
  return (
    <PaymentPage
      data={data}
      mode="demo"
      pdfHref={"invoice" in data ? "#" : null}
      declareUrl={null}
      today={DEMO_TODAY}
      backHref={data.state === "not_found" || data.state === "disabled" ? "/demo/invoices" : `/demo/invoices/${id}`}
    />
  )
}
