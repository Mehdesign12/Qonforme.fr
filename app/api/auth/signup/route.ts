import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

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
      // Compte déjà existant
      if (
        error.message.includes("already registered") ||
        error.message.includes("already exists") ||
        error.message.includes("duplicate")
      ) {
        return NextResponse.json(
          { error: "already_exists" },
          { status: 409 }
        )
      }
      console.error("[signup] admin.createUser error:", error.message)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, userId: data.user?.id })
  } catch (err) {
    console.error("[signup] unexpected error:", err)
    return NextResponse.json(
      { error: "Erreur inattendue. Réessayez." },
      { status: 500 }
    )
  }
}
