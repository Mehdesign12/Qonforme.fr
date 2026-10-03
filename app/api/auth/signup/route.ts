import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import { buildWelcomeEmail } from "@/lib/email/templates/welcome"
import { claimSequenceStep, enrollInOnboarding } from "@/lib/onboarding/store"
import { listUnsubscribeHeaders, unsubscribePageUrl } from "@/lib/onboarding/unsubscribe"

/**
 * POST /api/auth/signup
 *
 * Crée un compte utilisateur côté serveur via le client admin Supabase.
 * - email_confirm: true → bypass de la confirmation email (pas d'envoi SMTP)
 *   Évite le 500 de auth/v1/signup causé par les rate limits ou la
 *   misconfiguration SMTP du projet Supabase.
 * - Retourne { success: true } — le client signe ensuite avec signInWithPassword.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, first_name, last_name } = body

    // Validation minimale côté serveur
    if (!email || !password || !first_name || !last_name) {
      return NextResponse.json(
        { error: "Tous les champs sont requis." },
        { status: 400 }
      )
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Le mot de passe doit faire au moins 8 caractères." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    const { data, error } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      user_metadata: {
        first_name: first_name.trim(),
        last_name:  last_name.trim(),
      },
      email_confirm: true, // bypass confirmation email → pas de SMTP → pas de 500
    })

    if (error) {
      // Log complet pour diagnostic (visible dans Vercel Functions logs)
      console.error("[signup] admin.createUser error:", {
        message: error.message,
        status:  error.status,
        code:    (error as { code?: string }).code,
      })

      // Compte déjà existant
      if (
        error.message.includes("already registered") ||
        error.message.includes("already exists") ||
        error.message.includes("duplicate") ||
        error.message.includes("User already registered")
      ) {
        return NextResponse.json({ error: "already_exists" }, { status: 409 })
      }

      // Erreur DB trigger → guide vers la migration SQL à appliquer
      if (error.message.includes("Database error")) {
        console.error(
          "[signup] ACTION REQUISE : appliquer la migration " +
          "supabase/migrations/20260314_fix_auth_user_trigger.sql " +
          "dans le SQL Editor du dashboard Supabase."
        )
        return NextResponse.json(
          { error: "Erreur de configuration base de données. Contactez le support." },
          { status: 500 }
        )
      }

      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Séquence de démarrage : seul un compte créé ici y entre (jamais les comptes
    // existants). Sans la migration 20261003_onboarding_emails.sql : false, et
    // l'email de bienvenue part comme avant, sans lien de désinscription.
    const userId = data.user?.id
    const enrolled = userId ? await enrollInOnboarding(admin, userId) : false
    const to = email.trim().toLowerCase()

    // Email de bienvenue — fire & forget (ne bloque pas la réponse)
    const { subject, html } = buildWelcomeEmail({
      firstName: first_name.trim(),
      unsubscribeUrl: enrolled && userId ? unsubscribePageUrl(userId) : null,
    })
    sendEmail({
      to,
      subject,
      html,
      fromName: "Qonforme",
      headers: (enrolled && userId && listUnsubscribeHeaders(userId)) || undefined,
    })
      .then(async () => {
        // Bienvenue au journal : compte pour l'écart minimal avec l'email suivant
        if (enrolled && userId) await claimSequenceStep(admin, { user_id: userId, step: "welcome", sent_to: to })
      })
      .catch((err) => console.error("[signup] welcome email error:", err))

    return NextResponse.json({ success: true, userId: data.user?.id })
  } catch (err) {
    console.error("[signup] unexpected error:", err)
    return NextResponse.json(
      { error: "Erreur inattendue. Réessayez." },
      { status: 500 }
    )
  }
}
