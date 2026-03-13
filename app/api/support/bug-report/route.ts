import { NextRequest, NextResponse } from "next/server"
import { sendEmail } from "@/lib/email/resend"
import { createAdminClient } from "@/lib/supabase/server"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/support/bug-report
 *
 * Reçoit un rapport de bug depuis le modal sidebar et envoie un email
 * à l'équipe Qonforme via Resend.
 *
 * Body : { title: string, description: string, page?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const title       = (body?.title ?? "").trim()
    const description = (body?.description ?? "").trim()
    const page        = (body?.page ?? "").trim()

    if (!title || !description) {
      return NextResponse.json(
        { error: "Les champs titre et description sont obligatoires." },
        { status: 400 }
      )
    }

    const to      = process.env.RESEND_FROM_EMAIL ?? "contact@qonforme.fr"
    const date    = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
    const pageInfo = page || "Non précisée"

    const html = `
<div style="font-family:sans-serif;max-width:600px;color:#0f172a">
  <h2 style="color:#1e3a5f;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin-bottom:20px">
    🐛 Rapport de bug — Qonforme
  </h2>
  <p style="margin:0 0 8px"><strong>Titre :</strong> ${escapeHtml(title)}</p>
  <p style="margin:0 0 4px"><strong>Description :</strong></p>
  <p style="background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:6px;white-space:pre-wrap;margin:0 0 16px">${escapeHtml(description)}</p>
  <p style="margin:0 0 24px"><strong>Page concernée :</strong> ${escapeHtml(pageInfo)}</p>
  <p style="color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;padding-top:12px;margin:0">
    Envoyé le ${date} depuis l'application Qonforme
  </p>
</div>
`

    // ── Récupérer l'utilisateur connecté (optionnel) ─────────────────────
    let userId: string | null = null
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id ?? null
    } catch { /* non bloquant */ }

    // ── Persister en base pour l'espace admin ─────────────────────────────
    const admin = createAdminClient()
    await admin.from('support_messages').insert({
      type:        'bug_report',
      title,
      description,
      page:        page || null,
      status:      'new',
      user_id:     userId,
    })

    // ── Envoyer l'email de notification ───────────────────────────────────
    await sendEmail({
      to,
      subject: "Rapport d'un bug sur le site",
      html,
      fromName: "Qonforme",
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("bug-report route error:", err)
    return NextResponse.json(
      { error: "Impossible d'envoyer le rapport. Veuillez réessayer." },
      { status: 500 }
    )
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
