import { NextRequest, NextResponse } from "next/server"
import { searchBySiren, searchBySiret } from "@/lib/utils/sirene"

/**
 * Public SIRET/SIREN lookup for the free tool.
 * Rate-limited by Vercel edge (no auth required).
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""

  // Remove spaces (users often type "123 456 789")
  const cleaned = q.replace(/\s/g, "")

  if (!/^\d{9,14}$/.test(cleaned)) {
    return NextResponse.json(
      { error: "Veuillez saisir un numéro SIREN (9 chiffres) ou SIRET (14 chiffres)." },
      { status: 400 }
    )
  }

  let result
  if (cleaned.length === 14) {
    result = await searchBySiret(cleaned)
  } else if (cleaned.length === 9) {
    result = await searchBySiren(cleaned)
  } else {
    return NextResponse.json(
      { error: "Le numéro doit contenir 9 chiffres (SIREN) ou 14 chiffres (SIRET)." },
      { status: 400 }
    )
  }

  if (!result) {
    return NextResponse.json(
      { error: "Aucune entreprise trouvée pour ce numéro." },
      { status: 404 }
    )
  }

  // Compute VAT number (FR + key + SIREN)
  const siren = result.siren
  const vatKey = (12 + 3 * (parseInt(siren) % 97)) % 97
  const vatNumber = `FR${vatKey.toString().padStart(2, "0")}${siren}`

  return NextResponse.json({
    ...result,
    vat_number: vatNumber,
  })
}
