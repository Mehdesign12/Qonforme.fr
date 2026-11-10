/**
 * POST /api/admin/users/[id]/emails
 * { action: "preview" | "test" | "send", template, note?, freeSubject?, freeBody? }
 *
 * Email à la main au titulaire d'un compte (Admin › Utilisateurs › fiche) :
 * aperçu, essai à l'adresse de l'admin, ou envoi au compte (journalisé).
 * L'envoi est refusé si le compte s'est désinscrit ou a reçu un email il y a
 * moins de 20 heures.
 */
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { isManualTemplate } from "@/lib/email/templates/reprise"
import {
  buildManualEmail, loadAccountContext, manualSendBlocker, sendManualEmail, sendTestEmail, type ManualEmailInput,
} from "@/lib/admin/account-emails"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : null)

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Requête illisible" }, { status: 400 })
  }
  const action = body.action
  if (action !== "preview" && action !== "test" && action !== "send") return NextResponse.json({ error: "Action inconnue" }, { status: 400 })
  if (!isManualTemplate(body.template)) return NextResponse.json({ error: "Modèle inconnu" }, { status: 400 })
  const input: ManualEmailInput = {
    template: body.template,
    note: text(body.note, 1000),
    freeSubject: text(body.freeSubject, 150),
    freeBody: text(body.freeBody, 5000),
  }

  const admin = createAdminClient()
  const loaded = await loadAccountContext(admin, id)
  if ("missing" in loaded) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 })
  if ("error" in loaded) return NextResponse.json({ error: "Lecture du compte impossible, réessayez." }, { status: 503 })
  const ctx = loaded.ctx

  if (action === "preview") {
    const { subject, html } = buildManualEmail(ctx, input)
    return NextResponse.json({ subject, html, to: ctx.email, blocker: manualSendBlocker(ctx, input) })
  }

  if (action === "test") {
    if (input.template === "manual_free" && (!input.freeSubject?.trim() || !input.freeBody?.trim())) {
      return NextResponse.json({ error: "Écrivez un objet et un texte." }, { status: 400 })
    }
    const out = await sendTestEmail(ctx, input)
    return "error" in out ? NextResponse.json({ error: out.error }, { status: 502 }) : NextResponse.json({ ok: true, to: out.to })
  }

  const blocker = manualSendBlocker(ctx, input)
  if (blocker) return NextResponse.json({ error: blocker }, { status: 409 })
  const out = await sendManualEmail(admin, ctx, input, "admin")
  if ("error" in out) return NextResponse.json({ error: `L'email n'est pas parti : ${out.error}` }, { status: 502 })
  if ("taken" in out) return NextResponse.json({ error: "Déjà envoyé." }, { status: 409 })
  return NextResponse.json({ ok: true, to: ctx.email, journalId: out.journalId })
}
