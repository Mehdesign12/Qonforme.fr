import { NextRequest, NextResponse } from "next/server"
import { createClient, createAdminClient, createClientWithToken } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"

// Helper : résout l'utilisateur ET le client DB adapté.
// - Cookie (navigateur) : createClient() cookie-based → RLS via session cookie ✅
// - Bearer token (API externe) : admin.auth.getUser(token) pour valider le JWT
//   + createClientWithToken pour les requêtes DB avec le bon contexte RLS ✅
//   (le global.headers.Authorization est utilisé par PostgREST, pas par auth.getUser())
async function resolveAuth(request: NextRequest): Promise<{
  user: { id: string } | null
  supabase: SupabaseClient
}> {
  const authHeader = request.headers.get("Authorization")
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7)
    const admin = createAdminClient()
    const { data: { user } } = await admin.auth.getUser(token)
    // Pour les requêtes DB, createClientWithToken passe le JWT à PostgREST (RLS ok)
    return { user, supabase: createClientWithToken(token) }
  }
  // Cookie-based : chemin standard (navigateur après signInWithPassword)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { user, supabase }
}

// GET /api/company — récupère les infos de l'entreprise de l'utilisateur connecté
export async function GET(request: NextRequest) {
  const { user, supabase } = await resolveAuth(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ company: data ?? null })
}

// POST /api/company — création (onboarding)
export async function POST(request: NextRequest) {
  const { user, supabase } = await resolveAuth(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = await request.json()

  const { data, error } = await supabase.from("companies").upsert({
    user_id: user.id,
    name: body.name,
    siren: body.siren,
    address: body.address,
    zip_code: body.zip_code,
    city: body.city,
    country: "FR",
    vat_number: body.vat_number || null,
    iban: body.iban || null,
    invoice_prefix: body.invoice_prefix || "F",
    invoice_sequence: 1,
  }, { onConflict: "user_id" }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ company: data }, { status: 201 })
}

// PATCH /api/company — mise à jour des infos entreprise
export async function PATCH(request: NextRequest) {
  const { user, supabase } = await resolveAuth(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = await request.json()

  const { data, error } = await supabase
    .from("companies")
    .update({
      name: body.name,
      siren: body.siren,
      siret: body.siret || null,
      vat_number: body.vat_number || null,
      address: body.address,
      zip_code: body.zip_code,
      city: body.city,
      country: body.country || "FR",
      iban: body.iban || null,
      logo_url: body.logo_url ?? undefined,
      invoice_prefix: body.invoice_prefix || "F",
      payment_terms: body.payment_terms || null,
      legal_notice: body.legal_notice || null,
      accent_color: body.accent_color || "#2563EB",
      email: body.email || null,
    })
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ company: data })
}
