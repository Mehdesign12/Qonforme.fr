import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cleanSireneQuery, searchCompanies } from "@/lib/utils/sirene"
import { isValidSiren } from "@/lib/utils/invoice"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

const QUERY_MIN = 2
const QUERY_MAX = 80

const UNAVAILABLE =
  "Le répertoire Sirene ne répond pas. Réessayez dans un instant ou saisissez votre entreprise à la main."

/**
 * GET /api/sirene/search?q= — entreprises du répertoire Sirene pour la fenêtre
 * d'inscription (étape « Entreprise »). Compte connecté requis : le middleware
 * laisse passer /api/*, la route répond elle-même 401 en JSON.
 *
 * Chiffres seuls (espaces ignorés) : 9 → SIREN, 14 → SIRET ; sinon recherche
 * par nom (6 résultats au plus). 200 `{ results }` (liste vide si rien), 503 si
 * le répertoire est injoignable : jamais une panne présentée comme un introuvable.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401, headers: NO_STORE })
  }

  const q = cleanSireneQuery(request.nextUrl.searchParams.get("q") ?? "")
  if (q.length < QUERY_MIN) {
    return NextResponse.json({ error: "Saisissez au moins 2 caractères." }, { status: 400, headers: NO_STORE })
  }
  if (q.length > QUERY_MAX) {
    return NextResponse.json({ error: "Saisissez 80 caractères au plus." }, { status: 400, headers: NO_STORE })
  }

  // Un numéro complet dont la clé de contrôle est fausse : faute de frappe
  const digits = q.replace(/\s/g, "")
  if (/^\d+$/.test(digits) && !isValidSiren(digits.slice(0, 9))) {
    if (digits.length === 9) {
      return NextResponse.json(
        { error: "Ce numéro ne correspond à aucun SIREN : vérifiez les 9 chiffres." },
        { status: 400, headers: NO_STORE },
      )
    }
    if (digits.length === 14) {
      return NextResponse.json(
        { error: "Ce numéro ne correspond à aucun SIRET : vérifiez les 14 chiffres." },
        { status: 400, headers: NO_STORE },
      )
    }
  }

  const outcome = await searchCompanies(q)
  if (outcome.status === "unavailable") {
    return NextResponse.json({ error: UNAVAILABLE }, { status: 503, headers: NO_STORE })
  }
  return NextResponse.json({ results: outcome.results }, { headers: NO_STORE })
}
