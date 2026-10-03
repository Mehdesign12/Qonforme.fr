import { cache } from "react"
import type { Metadata } from "next"
import { PaymentPage } from "@/components/payment-link/PaymentPage"
import { todayParis } from "@/components/search/model"
import { resolvePaymentToken } from "@/lib/payment-link/server"

/**
 * Page de règlement d'une facture, ouverte par le client de l'artisan depuis
 * l'email d'envoi (ou une relance). Publique, sans connexion : l'accès se fait
 * par le seul jeton (256 bits, stocké haché). Jamais indexée, jamais mise en
 * cache (ni par le service worker, ni par le navigateur : rendu dynamique),
 * pas d'adresse transmise en « Referer » aux sites tiers.
 */

export const dynamic = "force-dynamic"

interface Props { params: Promise<{ token: string }> }

// Une seule résolution par requête (métadonnées + page)
const resolve = cache(async (token: string) => resolvePaymentToken(token))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const { data } = await resolve(token)
  const title = "invoice" in data ? `Régler la facture ${data.invoice.number}` : "Règlement de facture"
  return {
    title,
    description: "Coordonnées de virement et référence de la facture.",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    referrer: "no-referrer",
    alternates: { canonical: null },
    openGraph: null,
  }
}

export default async function PaymentLinkPage({ params }: Props) {
  const { token } = await params
  const { data } = await resolve(token)
  const usable = data.state === "payable" || data.state === "paid" || data.state === "credited" || data.state === "closed"
  return (
    <PaymentPage
      data={data}
      mode="live"
      pdfHref={usable ? `/api/regler/${token}/pdf` : null}
      declareUrl={data.state === "payable" ? `/api/regler/${token}/declaration` : null}
      today={todayParis()}
    />
  )
}
