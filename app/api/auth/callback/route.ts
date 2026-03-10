import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const supabase   = await createClient()
  const requestUrl = new URL(request.url)
  const origin     = requestUrl.origin

  const code = requestUrl.searchParams.get("code")
  const token = requestUrl.searchParams.get("token")
  const type  = requestUrl.searchParams.get("type")  // "recovery" | "signup" | etc.

  // ── Cas 1 : PKCE flow (OAuth, Magic Link, etc.) ─────────────────────────
  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
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
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("user_id", user.id)
      .single()

    if (!company) {
      return NextResponse.redirect(`${origin}/signup/company`)
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
