/**
 * Acompte libre (formule Artisan) : facture d'acompte sans devis enregistré,
 * pour une commande passée de vive voix ou sur un bon du client. Elle se
 * rattache ensuite au devis signé (POST /api/artisan/quotes/[id]/attach-deposit)
 * pour être reprise par le solde ou les situations.
 *
 * Le brouillon naît sans numéro (type Factur-X 386 à l'émission).
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireArtisanAccess } from "@/lib/artisan/access"
import { buildFreeDeposit, parseFreeDeposit } from "@/lib/artisan/build"
import { getChantier, insertArtisanDraft, ownsClient } from "@/lib/artisan/server"
import { todayInParis } from "@/lib/utils/paris-date"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const blocked = await requireArtisanAccess(supabase, user.id)
  if (blocked) return blocked

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const input = parseFreeDeposit(body)
  if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 })

  try {
    if (!(await ownsClient(supabase, user.id, input.client_id))) {
      return NextResponse.json({ error: "Client introuvable" }, { status: 404 })
    }
    let chantier: { id: string; name: string } | null = null
    if (input.chantier_id) {
      const ch = await getChantier(supabase, user.id, input.chantier_id)
      if (!ch) return NextResponse.json({ error: "Chantier introuvable" }, { status: 404 })
      if ("unavailable" in ch) return NextResponse.json({ error: "Les chantiers ne sont pas encore activés." }, { status: 503 })
      chantier = { id: ch.id, name: ch.name }
    }
    const today = todayInParis()
    const built = buildFreeDeposit(input, chantier, today)
    if ("error" in built) return NextResponse.json({ error: built.error }, { status: built.status })

    const { data: company } = await supabase.from("companies").select("invoice_prefix").eq("user_id", user.id).maybeSingle()
    const { data: invoice, error } = await insertArtisanDraft(
      supabase,
      user.id,
      { client_id: input.client_id, quote_id: null, chantier_id: chantier?.id ?? null },
      built,
      today,
      (company as { invoice_prefix?: string | null } | null)?.invoice_prefix,
    )
    if (error || !invoice) {
      if (isMissingSchemaError(error)) return NextResponse.json({ error: "Les factures d'acompte ne sont pas encore activées." }, { status: 503 })
      console.error("[artisan/deposits] création:", error?.message)
      return NextResponse.json({ error: "Le brouillon n'a pas pu être créé. Réessayez." }, { status: 500 })
    }
    return NextResponse.json({ invoice }, { status: 201 })
  } catch (err) {
    console.error("[artisan/deposits] erreur:", err)
    return NextResponse.json({ error: "Le brouillon n'a pas pu être créé. Réessayez." }, { status: 500 })
  }
}
