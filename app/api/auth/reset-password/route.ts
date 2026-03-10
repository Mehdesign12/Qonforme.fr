import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import { buildResetPasswordEmail } from "@/lib/email/templates/reset-password"

/**
 * POST /api/auth/reset-password
 *
 * Génère un lien de réinitialisation via l'API Admin Supabase
 * et envoie un email brandé Qonforme via Resend.
 *
 * Supabase n'est pas utilisé pour envoyer l'email — on le fait nous-mêmes
 * afin d'avoir un branding complet (logo, couleurs, texte personnalisé).
 *
 * Body : { email: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = (body?.email ?? "").trim().toLowerCase()

    // Validation de base
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://qonforme.fr"

    // ── Générer le lien via l'API Admin Supabase ─────────────────────────
    // generateLink() retourne un lien qui contient le token de reset.
    // On redirige ce lien vers notre page /reset-password pour le traitement.
    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${appUrl}/reset-password`,
      },
    })

    if (error) {
      // Si l'utilisateur n'existe pas, Supabase retourne une erreur.
      // On ne la remonte PAS au client pour éviter l'énumération d'emails.
      console.error("generateLink error:", error.message)
      // Réponse identique succès/échec côté client
      return NextResponse.json({ success: true })
    }

    const resetUrl = data.properties?.action_link
    if (!resetUrl) {
      console.error("generateLink: action_link manquant", data)
      return NextResponse.json({ success: true })
    }

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
    // Ne jamais exposer l'erreur interne — toujours retourner succès
    // pour éviter les attaques par timing / énumération d'emails
    return NextResponse.json({ success: true })
  }
}
