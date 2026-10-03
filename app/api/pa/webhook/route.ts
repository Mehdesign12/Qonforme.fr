/**
 * POST /api/pa/webhook — appels de la plateforme agréée (facture reçue, statut).
 *
 * INACTIVE tant qu'aucune plateforme n'est raccordée : l'adaptateur « none »
 * répond 404 à tout appel, sans rien lire ni écrire. Une fois le partenaire
 * branché (lib/pa/types.ts), la signature est vérifiée par l'adaptateur avant
 * tout traitement ; un appel non signé reçoit 401.
 */
import { NextResponse } from "next/server"
import { getPlatformAdapter } from "@/lib/pa"
import { createAdminClient } from "@/lib/supabase/server"
import { applyPlatformStatus, ingestInboundInvoice } from "@/lib/reception/ingest"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/** Corps maximal accepté (fichier encodé + enveloppe). */
const MAX_BODY = 8 * 1024 * 1024

export async function POST(request: Request) {
  const adapter = getPlatformAdapter()
  if (!adapter.connected) return new NextResponse(null, { status: 404 })

  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY) return new NextResponse(null, { status: 413 })
  const rawBody = await request.text()
  if (rawBody.length > MAX_BODY) return new NextResponse(null, { status: 413 })

  const event = await adapter.verifyWebhook({ headers: request.headers, rawBody }).catch(() => null)
  if (!event) return new NextResponse(null, { status: 401 })

  const admin = createAdminClient()
  if (event.type === "invoice.received") {
    const res = await ingestInboundInvoice(admin, event.invoice)
    if (!res.ok) console.error("[pa] réception:", res.reason, res.message ?? "")
    // Panne passagère : 503 pour que la plateforme rejoue l'appel. Facture illisible ou
    // destinataire inconnu : 200, la rejouer n'y changerait rien (la plateforme la garde).
    const retry = !res.ok && (res.reason === "unavailable" || res.reason === "error")
    return NextResponse.json({ ok: res.ok }, { status: retry ? 503 : 200 })
  }
  const res = await applyPlatformStatus(admin, event)
  return NextResponse.json({ ok: res.ok })
}
