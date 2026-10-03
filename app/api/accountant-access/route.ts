/**
 * Paramètres › Accès comptable (artisan connecté).
 *
 * GET  : accès en cours, invitations en attente et journal des 12 derniers mois.
 *        `available: false` tant que la migration n'est pas appliquée.
 * POST : invite un comptable { email, label? } ; email d'invitation au nom de Qonforme.
 *
 * Tout est lu et écrit avec la clé service_role (lib/accountant/server.ts),
 * filtré sur le compte connecté.
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireIssuingAccess } from "@/lib/stripe/subscription"
import { ACCOUNTANT_ACCESS_REQUIRES_PLAN } from "@/lib/accountant/rules"
import { getOverview, inviteAccountant } from "@/lib/accountant/server"

export const dynamic = "force-dynamic"

const noStore = { "Cache-Control": "no-store" }

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    return NextResponse.json(await getOverview(user.id), { headers: noStore })
  } catch (err) {
    console.error("[accountant-access] GET", err)
    return NextResponse.json({ error: "Impossible de charger les accès. Réessayez." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    if (ACCOUNTANT_ACCESS_REQUIRES_PLAN) {
      const blocked = await requireIssuingAccess(supabase, user.id)
      if (blocked) return blocked
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Requête invalide." }, { status: 400 })

    const meta = user.user_metadata ?? {}
    const name = [meta.first_name, meta.last_name].filter((v) => typeof v === "string" && v.trim()).join(" ").trim()
    const result = await inviteAccountant({
      owner: { id: user.id, email: user.email ?? null, name: name || null },
      email: (body as Record<string, unknown>).email,
      label: (body as Record<string, unknown>).label,
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ access: result.access }, { status: 201, headers: noStore })
  } catch (err) {
    console.error("[accountant-access] POST", err)
    return NextResponse.json({ error: "L'invitation n'a pas pu être créée. Réessayez." }, { status: 500 })
  }
}
