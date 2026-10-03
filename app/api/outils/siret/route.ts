import { NextRequest, NextResponse } from "next/server"
import { lookupSiren, lookupSiret } from "@/lib/utils/sirene"
import { isValidSiren } from "@/lib/utils/invoice"

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

  if (cleaned.length !== 9 && cleaned.length !== 14) {
    return NextResponse.json(
      { error: "Le numéro doit contenir 9 chiffres (SIREN) ou 14 chiffres (SIRET)." },
      { status: 400 }
    )
  }
  if (!isValidSiren(cleaned.slice(0, 9))) {
    return NextResponse.json(
      { error: "Ce numéro n'existe pas : sa clé de contrôle ne correspond pas." },
      { status: 400 }
    )
  }

  const outcome = cleaned.length === 14 ? await lookupSiret(cleaned) : await lookupSiren(cleaned)
  if (outcome.status === "unavailable") {
    return NextResponse.json(
      { error: "Le répertoire Sirene ne répond pas pour le moment. Réessayez dans un instant." },
      { status: 503 }
    )
  }
  if (outcome.status === "notfound") {
    return NextResponse.json(
      { error: "Aucune entreprise trouvée pour ce numéro." },
      { status: 404 }
    )
  }
  const result = outcome.result

  // Compute VAT number (FR + key + SIREN)
  const siren = result.siren
  const vatKey = (12 + 3 * (parseInt(siren) % 97)) % 97
  const vatNumber = `FR${vatKey.toString().padStart(2, "0")}${siren}`

  return NextResponse.json({
    ...result,
    vat_number: vatNumber,
  })
}
