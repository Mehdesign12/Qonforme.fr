import { NextResponse } from "next/server"
import { recordPaymentLinkView } from "@/lib/payment-link/server"

/**
 * POST /api/regler/[token]/view — la page de règlement compte son ouverture
 * (suivi d'ouverture de la facture, montré à l'artisan sur la fiche facture).
 * Appelée par le navigateur qui affiche la page, pas par les robots qui
 * vérifient les liens des emails. Répond toujours 204 : rien n'est révélé
 * sur le jeton, et le suivi ne bloque jamais la page.
 */
export const dynamic = "force-dynamic"

interface Params { params: Promise<{ token: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { token } = await params
  await recordPaymentLinkView(token)
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } })
}
