import { createAdminClient, createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { safeNextPath } from "@/lib/stripe/access"
import { isFreshOAuthSignup, oauthSignupMetadata } from "@/lib/auth/oauth"
import { sendEmail } from "@/lib/email/resend"
import { buildWelcomeEmail } from "@/lib/email/templates/welcome"
import { claimSequenceStep, enrollInOnboarding } from "@/lib/onboarding/store"
import { listUnsubscribeHeaders, unsubscribePageUrl } from "@/lib/onboarding/unsubscribe"

export async function GET(request: NextRequest) {
  const supabase   = await createClient()
  const requestUrl = new URL(request.url)
  const origin     = requestUrl.origin

  const code = requestUrl.searchParams.get("code")
  const token = requestUrl.searchParams.get("token")
  const type  = requestUrl.searchParams.get("type")  // "recovery" | "signup" | etc.

  // ── Cas 1 : PKCE flow (OAuth, Magic Link, etc.) ─────────────────────────
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error || !data?.user) {
      console.error("[auth/callback] échange du code en échec :", error?.message)
      return NextResponse.redirect(`${origin}/login?error=oauth`)
    }
    const next = safeNextPath(requestUrl.searchParams.get("next"))
    const fresh = await onGoogleSignup(data.user, requestUrl.searchParams.get("ab"))
    if (next) return NextResponse.redirect(`${origin}${next}`)
    return NextResponse.redirect(`${origin}${fresh ? "/dashboard?bienvenue=1" : "/dashboard"}`)
  }

  // Google a renvoyé un refus (fenêtre fermée, accès refusé) : retour à la connexion
  if (requestUrl.searchParams.get("error")) {
    return NextResponse.redirect(`${origin}/login?error=oauth`)
  }

  // ── Cas 2 : Token flow (reset password via hashed_token) ─────────────────
  // Notre API /api/auth/reset-password envoie un lien pointant ici avec
  // ?token=xxx&type=recovery — on vérifie le OTP côté serveur pour établir
  // la session via cookie, puis on redirige vers /reset-password.
  if (token && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: "recovery",
    })
    if (error) {
      console.error("verifyOtp recovery error:", error.message)
      return NextResponse.redirect(`${origin}/reset-password?error=invalid`)
    }
    // Session établie — redirection vers le formulaire (sans token dans l'URL)
    return NextResponse.redirect(`${origin}/reset-password`)
  }

  // ── Redirection post-auth normale ────────────────────────────────────────
  // Toujours le tableau de bord : un compte sans entreprise y trouve la fenêtre
  // « Bienvenue » (components/onboarding/InscriptionDialog.tsx), un comptable
  // invité est renvoyé vers son espace par app/dashboard/page.tsx.
  return NextResponse.redirect(`${origin}/dashboard`)
}

/**
 * Premier passage d'un compte Google : il reçoit les métadonnées d'une
 * inscription en deux champs (la fenêtre « Bienvenue » s'ouvre), entre dans la
 * séquence de démarrage et reçoit l'email de bienvenue, comme à l'inscription
 * par email. Ne lève jamais : une panne ici ne doit pas empêcher la connexion.
 * Renvoie vrai pour un compte qui vient d'être créé.
 */
async function onGoogleSignup(
  user: { id: string; email?: string | null; created_at?: string; app_metadata?: Record<string, unknown> | null; user_metadata?: Record<string, unknown> | null },
  variant: string | null,
): Promise<boolean> {
  if (!isFreshOAuthSignup(user)) return false
  try {
    const admin = createAdminClient()
    const meta = oauthSignupMetadata(user, variant)
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...(user.user_metadata ?? {}), ...meta },
    })
    if (error) console.error("[auth/callback] métadonnées du compte Google :", error.message)

    const to = user.email
    if (!to) return true
    const enrolled = await enrollInOnboarding(admin, user.id)
    const { subject, html } = buildWelcomeEmail({
      firstName: typeof meta.first_name === "string" ? meta.first_name : null,
      unsubscribeUrl: enrolled ? unsubscribePageUrl(user.id) : null,
    })
    await sendEmail({
      to,
      subject,
      html,
      fromName: "Qonforme",
      headers: (enrolled && listUnsubscribeHeaders(user.id)) || undefined,
    })
      .then(async () => {
        if (enrolled) await claimSequenceStep(admin, { user_id: user.id, step: "welcome", sent_to: to })
      })
      .catch((err) => console.error("[auth/callback] email de bienvenue :", err))
  } catch (err) {
    console.error("[auth/callback] inscription Google :", err)
  }
  return true
}
