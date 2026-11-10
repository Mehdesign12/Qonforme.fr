/**
 * POST   /api/admin/affiliation/partners/[id]/stats-link  { send?: boolean }
 *        crée un nouveau lien privé de statistiques (l'ancien cesse de marcher) ;
 *        avec `send`, l'envoie aussi par email au contact du partenaire.
 *        Le jeton n'est rendu qu'ici, une fois : seul son hachage est gardé.
 * DELETE /api/admin/affiliation/partners/[id]/stats-link  révoque le lien.
 * Admin seulement.
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { createAdminClient } from "@/lib/supabase/server"
import { revokeStatsToken, rotateStatsToken, statsUrl } from "@/lib/affiliation/data"
import { rateText } from "@/lib/affiliation/model"
import { buildAffiliateStatsEmail } from "@/lib/email/templates/affiliate-stats"
import { sendEmail } from "@/lib/email/resend"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Partenaire invalide." }, { status: 400 })
  const body = (await request.json().catch(() => null)) as { send?: unknown } | null
  const db = createAdminClient()

  const { data: partner, error } = await db.from("affiliate_partners").select("id, name, contact_email, status, commission_rate, commission_months").eq("id", id).maybeSingle()
  if (error) return NextResponse.json({ error: "Lecture du partenaire impossible." }, { status: 500 })
  if (!partner) return NextResponse.json({ error: "Partenaire introuvable." }, { status: 404 })
  if (partner.status === "archived") return NextResponse.json({ error: "Ce partenaire est archivé." }, { status: 409 })
  if (body?.send === true && !partner.contact_email) return NextResponse.json({ error: "Ajoutez d'abord l'email du contact." }, { status: 400 })

  const token = await rotateStatsToken(db, id)
  if (!token.ok) return NextResponse.json({ error: token.message }, { status: token.kind === "unavailable" ? 503 : 500 })
  const url = statsUrl(token.data)

  let sent = false
  if (body?.send === true && partner.contact_email) {
    const { subject, html } = buildAffiliateStatsEmail({
      partnerName: partner.name as string,
      url,
      terms: rateText(Number(partner.commission_rate), Number(partner.commission_months)),
    })
    try {
      await sendEmail({ to: partner.contact_email as string, subject, html, fromName: "Qonforme" })
      sent = true
    } catch (err) {
      console.error("[affiliation] envoi du lien :", err)
      return NextResponse.json({ url, sent: false, error: "Le lien est créé, mais l'email n'est pas parti : copiez-le et envoyez-le vous-même." }, { status: 200 })
    }
  }
  return NextResponse.json({ url, sent })
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Partenaire invalide." }, { status: 400 })
  const res = await revokeStatsToken(createAdminClient(), id)
  if (!res.ok) return NextResponse.json({ error: res.message }, { status: res.kind === "unavailable" ? 503 : 500 })
  return NextResponse.json({ ok: true })
}
