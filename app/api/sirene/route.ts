import { NextRequest, NextResponse } from "next/server"
import { searchBySiren } from "@/lib/utils/sirene"

export async function GET(request: NextRequest) {
  const siren = request.nextUrl.searchParams.get("siren")

  if (!siren || !/^\d{9}$/.test(siren)) {
    return NextResponse.json({ error: "SIREN invalide" }, { status: 400 })
  }

  const result = await searchBySiren(siren)
  if (!result) {
    return NextResponse.json({ error: "Entreprise non trouvée" }, { status: 404 })
  }

  return NextResponse.json(result)
}
