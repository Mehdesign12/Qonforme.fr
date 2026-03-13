import { NextRequest, NextResponse } from "next/server"
import { sendEmail } from "@/lib/email/resend"
import { createAdminClient } from "@/lib/supabase/server"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/support/contact
 *
 * Reçoit un message de contact depuis le modal sidebar et envoie un email
 * à l'équipe Qonforme via Resend. Le Reply-To est l'email de l'utilisateur
 * pour permettre une réponse directe.
 *
 * Body : { name: string, email: string, message: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body    = await request.json()
    const name    = (body?.name ?? "").trim()
    const email   = (body?.email ?? "").trim().toLowerCase()
    const message = (body?.message ?? "").trim()

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Tous les champs sont obligatoires." },
        { status: 400 }
      )
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Adresse email invalide." },
        { status: 400 }
      )
    }

    const to   = process.env.RESEND_FROM_EMAIL ?? "contact@qonforme.fr"
    const date = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })

    const html = `
<div style="font-family:sans-serif;max-width:600px;color:#0f172a">
  <h2 style="color:#1e3a5f;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin-bottom:20px">
    ✉️ Message de contact — Qonforme
  </h2>
  <p style="margin:0 0 8px"><strong>Nom :</strong> ${escapeHtml(name)}</p>
  <p style="margin:0 0 16px"><strong>Email :</strong> <a href="mailto:${escapeHtml(email)}" style="color:#2563eb">${escapeHtml(email)}</a></p>
  <p style="margin:0 0 4px"><strong>Message :</strong></p>
  <p style="background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:6px;white-space:pre-wrap;margin:0 0 24px">${escapeHtml(message)}</p>
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
      type:    'contact',
      name,
      email,
      message,
      status:  'new',
      user_id: userId,
    })

    // ── Envoyer l'email de notification ───────────────────────────────────
    await sendEmail({
      to,
      subject: "Nouveau message de contact — Qonforme",
      html,
      fromName: "Qonforme",
      replyTo: email,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("contact route error:", err)
    return NextResponse.json(
      { error: "Impossible d'envoyer le message. Veuillez réessayer." },
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
