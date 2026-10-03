/**
 * Facturation d'un devis accepté, formule Artisan : acompte, situation de
 * travaux, facture de solde.
 *
 * GET  : état de facturation du devis (acomptes, situations, avancement par
 *        ligne, ce qui reste possible) ; `available: false` tant que la
 *        migration 20261003_artisan_chantiers.sql n'est pas appliquée.
 * POST : `{ preview: true, ... }` calcule sans rien écrire (ouvert à tous :
 *        voir ce que donnerait la facture) ; sinon crée le brouillon, ce qui
 *        demande la formule Artisan (402 ARTISAN_REQUIRED). Le calcul est
 *        refait ici sur le devis et les factures relus en base : rien de ce
 *        que calcule le navigateur n'est écrit tel quel.
 *
 * Le brouillon naît sans numéro ; il le reçoit à l'émission, dans la série
 * continue des factures (lib/utils/document-numbering.ts).
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireArtisanAccess, hasArtisanAccess } from "@/lib/artisan/access"
import { buildArtisanInvoice, parseCreateRequest } from "@/lib/artisan/build"
import { freeDepositsOfClient, insertArtisanDraft, loadQuoteBilling } from "@/lib/artisan/server"
import { todayInParis } from "@/lib/utils/paris-date"

export const dynamic = "force-dynamic"

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  const { id } = await params

  try {
    const billing = await loadQuoteBilling(supabase, user.id, id)
    if (!billing) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 })
    if ("unavailable" in billing) return NextResponse.json({ available: false })
    const [artisan, freeDeposits] = await Promise.all([
      hasArtisanAccess(supabase, user.id),
      freeDepositsOfClient(supabase, user.id, billing.quote.client_id),
    ])
    return NextResponse.json({ available: true, artisan, billing, freeDeposits })
  } catch (err) {
    console.error("[artisan/billing] lecture:", err)
    return NextResponse.json({ error: "Impossible de lire la facturation de ce devis." }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  const { id } = await params

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const req = parseCreateRequest(body)
  if ("error" in req) return NextResponse.json({ error: req.error }, { status: 400 })
  const preview = body.preview === true

  if (!preview) {
    const blocked = await requireArtisanAccess(supabase, user.id)
    if (blocked) return blocked
  }

  try {
    const billing = await loadQuoteBilling(supabase, user.id, id)
    if (!billing) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 })
    if ("unavailable" in billing) {
      return NextResponse.json({ error: "La facturation par acomptes et situations n'est pas encore activée." }, { status: 503 })
    }
    const today = todayInParis()
    const built = buildArtisanInvoice(billing, req, today)
    if ("error" in built) return NextResponse.json({ error: built.error }, { status: built.status })
    if (preview) return NextResponse.json({ preview: built })

    const { data: company } = await supabase.from("companies").select("invoice_prefix").eq("user_id", user.id).maybeSingle()
    const { data: invoice, error } = await insertArtisanDraft(
      supabase,
      user.id,
      { client_id: billing.quote.client_id, quote_id: billing.quote.id, chantier_id: billing.quote.chantier_id ?? null },
      built,
      today,
      (company as { invoice_prefix?: string | null } | null)?.invoice_prefix,
    )
    if (error?.code === "23505") {
      // Index unique : un autre brouillon vient d'être créé pour ce devis
      return NextResponse.json({ error: "Un brouillon est déjà en cours pour ce devis : envoyez-le ou supprimez-le d'abord." }, { status: 409 })
    }
    if (error || !invoice) {
      console.error("[artisan/billing] création:", error?.message)
      return NextResponse.json({ error: "Le brouillon n'a pas pu être créé. Réessayez." }, { status: 500 })
    }
    return NextResponse.json({ invoice }, { status: 201 })
  } catch (err) {
    console.error("[artisan/billing] erreur:", err)
    return NextResponse.json({ error: "Le brouillon n'a pas pu être créé. Réessayez." }, { status: 500 })
  }
}
