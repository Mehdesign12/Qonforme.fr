import { NextRequest } from "next/server"
import { repondrePdf } from "@/lib/outils/route-document"

/**
 * Générateur gratuit de facture en PDF (sans Factur-X, sans archivage).
 * POST /api/outils/facture — validation, calcul et mise en page dans lib/outils.
 */
export async function POST(request: NextRequest) {
  return repondrePdf(request, "facture")
}
