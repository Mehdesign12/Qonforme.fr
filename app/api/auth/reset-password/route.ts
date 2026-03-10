import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import { buildResetPasswordEmail } from "@/lib/email/templates/reset-password"

/**
 * POST /api/auth/reset-password
 *
 * Génère un token de réinitialisation via l'API Admin Supabase,
 * construit notre propre URL de reset (via /api/auth/callback),
 * et envoie un email brandé Qonforme via Resend.
 *
 * Flow :
 *   1. generateLink() → récupère le hashed_token (sans envoyer d'email Supabase)
 *   2. On construit l'URL : /api/auth/callback?token=xxx&type=recovery
 *   3. L'utilisateur clique → /api/auth/callback vérifie le token côté serveur
 *      via verifyOtp() → session établie → redirect vers /reset-password
 *   4. /reset-password affiche le formulaire, la session est déjà active
 *
 * Body : { email: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body  = await request.json()
    const email = (body?.email ?? "").trim().toLowerCase()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://qonforme.fr"

    // ── Générer le token via Admin Supabase ──────────────────────────────
    // generateLink() NE déclenche PAS l'email Supabase natif.
    // On récupère le hashed_token pour construire notre propre lien.
    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${appUrl}/reset-password`,
      },
    })

    if (error) {
      // Utilisateur inexistant ou autre erreur — réponse identique pour
      // éviter l'énumération d'emails
      console.error("generateLink error:", error.message)
      return NextResponse.json({ success: true })
    }

    const hashedToken = data.properties?.hashed_token
    if (!hashedToken) {
      console.error("generateLink: hashed_token manquant", data)
      return NextResponse.json({ success: true })
    }

    // ── Construire notre propre URL de reset ─────────────────────────────
    // Pointe vers notre callback qui gère verifyOtp() côté serveur,
    // établit la session via cookie, et redirige vers /reset-password.
    const resetUrl = `${appUrl}/api/auth/callback?token=${hashedToken}&type=recovery`

    // ── Envoyer l'email brandé via Resend ────────────────────────────────
    const { subject, html } = buildResetPasswordEmail({ resetUrl })

    await sendEmail({
      to: email,
      subject,
      html,
      fromName: "Qonforme",
    })

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error("reset-password API error:", err)
    return NextResponse.json({ success: true })
  }
}
