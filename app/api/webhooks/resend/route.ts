/**
 * POST /api/webhooks/resend
 *
 * Événements Resend (remis, rejeté, signalé comme indésirable) pour le journal
 * des emails des comptes (lib/email/journal.ts). Signature Svix vérifiée sur le
 * corps brut avec RESEND_WEBHOOK_SECRET (« whsec_… », Resend › Webhooks) ;
 * requêtes de plus de 5 minutes refusées. Sans secret : 503 (Resend réessaie),
 * rien n'est lu.
 *
 * À créer chez Resend : adresse https://qonforme.fr/api/webhooks/resend (sans
 * www), événements email.delivered, email.bounced, email.complained.
 */
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { applyResendEvent, type ResendEvent } from "@/lib/email/journal"
import { verifySvixSignature } from "@/lib/email/svix"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: "Webhook non configuré" }, { status: 503 })

  const body = await request.text()
  const ok = verifySvixSignature({
    secret,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    body,
  })
  if (!ok) return NextResponse.json({ error: "Signature invalide" }, { status: 401 })

  let event: ResendEvent
  try {
    event = JSON.parse(body) as ResendEvent
  } catch {
    return NextResponse.json({ error: "Corps illisible" }, { status: 400 })
  }
  if (!event || typeof event.type !== "string") return NextResponse.json({ error: "Événement illisible" }, { status: 400 })

  const applied = await applyResendEvent(createAdminClient(), event)
  return applied ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Réessayez" }, { status: 503 })
}
