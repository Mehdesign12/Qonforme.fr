import { NextRequest } from "next/server"
import { repondrePdf } from "@/lib/outils/route-document"

/**
 * Générateur gratuit de devis en PDF.
 * POST /api/outils/devis — validation, calcul et mise en page dans lib/outils.
 */
export async function POST(request: NextRequest) {
  return repondrePdf(request, "devis")
}
