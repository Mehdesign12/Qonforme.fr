import { NextRequest, NextResponse } from "next/server"
import { lookupSiren } from "@/lib/utils/sirene"
import { isValidSiren } from "@/lib/utils/invoice"

export async function GET(request: NextRequest) {
  const siren = request.nextUrl.searchParams.get("siren")

  if (!siren || !isValidSiren(siren)) {
    return NextResponse.json({ error: "SIREN invalide" }, { status: 400 })
  }

  const outcome = await lookupSiren(siren)
  if (outcome.status === "unavailable") {
    return NextResponse.json({ error: "Le répertoire Sirene ne répond pas. Réessayez dans un instant." }, { status: 503 })
  }
  if (outcome.status === "notfound") {
    return NextResponse.json({ error: "Entreprise non trouvée" }, { status: 404 })
  }

  return NextResponse.json(outcome.result)
}
