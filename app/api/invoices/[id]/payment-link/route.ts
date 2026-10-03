import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { applyLinkAction, dismissDeclaration, paymentLinkState, type LinkAction } from "@/lib/payment-link/server"

interface Params { params: Promise<{ id: string }> }

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }
const ACTIONS: readonly string[] = ["create", "disable", "enable", "dismiss_declaration"]

/** Facture de l'utilisateur connecté (lecture sous RLS), ou réponse d'erreur. */
async function ownInvoice(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401, headers: NO_STORE }) }
  const { data: invoice } = await supabase
    .from("invoices").select("id, status").eq("id", id).eq("user_id", user.id).maybeSingle()
  if (!invoice) return { error: NextResponse.json({ error: "Facture introuvable" }, { status: 404, headers: NO_STORE }) }
  return { error: null, user, invoice }
}

// GET /api/invoices/[id]/payment-link — état du lien de paiement et dernier virement déclaré
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const own = await ownInvoice(id)
  if (own.error) return own.error
  try {
    const state = await paymentLinkState({ invoiceId: id, userId: own.user.id })
    return NextResponse.json(state, { headers: NO_STORE })
  } catch (err) {
    console.error("[payment-link] GET", err)
    return NextResponse.json({ error: "Impossible de charger le lien de paiement." }, { status: 500, headers: NO_STORE })
  }
}

// POST /api/invoices/[id]/payment-link — { action: "create" | "disable" | "enable" }
// ou { action: "dismiss_declaration", declarationId } (virement déclaré mais pas reçu).
// Ne change jamais le statut de la facture : « Marquer payée » reste le geste de l'artisan.
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const own = await ownInvoice(id)
  if (own.error) return own.error

  const body = await request.json().catch(() => null) as { action?: unknown; declarationId?: unknown } | null
  const action = typeof body?.action === "string" ? body.action : ""
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Action inconnue" }, { status: 400, headers: NO_STORE })
  }

  try {
    if (action === "dismiss_declaration") {
      const declarationId = typeof body?.declarationId === "string" ? body.declarationId : ""
      if (!/^[0-9a-f-]{36}$/i.test(declarationId)) {
        return NextResponse.json({ error: "Déclaration introuvable" }, { status: 400, headers: NO_STORE })
      }
      await dismissDeclaration({ invoiceId: id, userId: own.user.id, declarationId })
    } else {
      const message = await applyLinkAction({
        invoiceId: id, userId: own.user.id, status: own.invoice.status, action: action as LinkAction,
      })
      if (message) return NextResponse.json({ error: message }, { status: 409, headers: NO_STORE })
    }
    const state = await paymentLinkState({ invoiceId: id, userId: own.user.id })
    return NextResponse.json(state, { headers: NO_STORE })
  } catch (err) {
    console.error("[payment-link] POST", err)
    return NextResponse.json({ error: "Le lien de paiement n'a pas pu être mis à jour." }, { status: 500, headers: NO_STORE })
  }
}
