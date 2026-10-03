import type { Metadata } from "next"
import { PublicSignView } from "@/components/signature/PublicSignView"
import { demoPublicView } from "@/lib/demo/signature"
import { emptyPublicView } from "@/lib/signature/view"

/**
 * Démo de la page du client (/signer/demo/<numéro>) : même composant que la
 * vraie page, documents fictifs de lib/demo/data.ts, rien n'est enregistré.
 * Exemples : d-2026-035 (particulier), d-2026-034 (professionnel, code),
 * bc-2026-005 (bon de commande), d-2026-033 (signé), d-2026-032 (refusé),
 * expire, remplace, desactive, introuvable ; « ?sur-place=1 » pour la
 * signature sur l'appareil de l'artisan.
 */
export const metadata: Metadata = {
  title: "Signature en ligne — Démo",
  description: "La page sur laquelle votre client lit et signe votre devis : démonstration avec des données fictives.",
  robots: { index: false, follow: false },
}

export default function DemoSignerPage({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string | string[] | undefined> }) {
  const data = demoPublicView(params.id, searchParams["sur-place"] === "1") ?? { ...emptyPublicView(params.id), demo: true }
  return <PublicSignView data={data} />
}
