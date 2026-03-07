import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const origin = requestUrl.origin

  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Vérifier si le profil entreprise est complet
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
