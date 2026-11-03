/**
 * Envoi d'une facture par la plateforme agréée (fiche de la facture, planche
 * D15) : tentative active, statuts reçus, tentatives précédentes. À l'ouverture,
 * les statuts de cette facture sont relus chez Super PDP (sans attendre la relève
 * des 15 minutes) ; une panne ou un verrou occupé rend ce qui est enregistré.
 */
import { NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { applyOutboundEvents, loadActiveOutbound, loadOutboundHistory } from "@/lib/pa/outbound"
import { obtainToken } from "@/lib/pa/deposit"
import { createSuperPdpApi } from "@/lib/pa/superpdp/api"
import { loadConnection } from "@/lib/pa/store"
import { notifyOutboundChanges } from "@/lib/pa/notify"
import { toPlatformInfo as view } from "@/lib/pa/outbound-view"

export const dynamic = "force-dynamic"

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  const { id } = await params
  // La facture doit être celle du compte (lecture sous RLS)
  const { data: invoice, error } = await supabase.from("invoices").select("id").eq("id", id).eq("user_id", user.id).maybeSingle()
  if (error) return NextResponse.json({ error: "Lecture impossible pour le moment." }, { status: 503 })
  if (!invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })

  const admin = createAdminClient()
  let active = await loadActiveOutbound(admin, user.id, "invoice", id)
  if (!active.ok) return NextResponse.json({ outbound: null, history: [] }, { headers: { "Cache-Control": "no-store" } })

  // Statuts frais pour une facture déposée qui n'a pas fini son parcours
  const row = active.row
  if (row && row.platform_invoice_id && row.phase === "sent") {
    const token = await obtainToken(admin, user.id, { tries: 1 })
    if (token.ok) {
      const events = await createSuperPdpApi(token.token).listInvoiceEvents(row.platform_invoice_id).catch(() => null)
      if (events?.length) {
        const applied = await applyOutboundEvents(admin, row.mode, events, user.id)
        // Un refus ou un rejet vu ici d'abord : l'alerte part aussi (la relève ne le reverra pas)
        if (applied?.changed.length) {
          const conn = await loadConnection(admin, user.id)
          if (conn.ok && conn.row) await notifyOutboundChanges(admin, conn.row, applied.changed)
        }
        active = await loadActiveOutbound(admin, user.id, "invoice", id)
      }
    }
  }
  const history = (await loadOutboundHistory(admin, user.id, "invoice", id)) ?? []
  return NextResponse.json(
    {
      outbound: active.ok && active.row ? view(active.row) : null,
      history: history.filter((h) => h.superseded_at).map(view),
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
