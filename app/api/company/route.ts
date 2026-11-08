import { NextRequest, NextResponse } from "next/server"
import { createClient, createAdminClient, createClientWithToken } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { isAllowedLogoUrl } from "@/lib/utils/logo-url"
import { parseLegalProfile } from "@/lib/legal/profile"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { storedLogoUrl } from "@/lib/company/stored-logo"

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

  // owner : identifiant du compte, clé de la copie locale des documents en cours (lib/documents/local-draft.ts)
  return NextResponse.json({ company: data ?? null, owner: user.id })
}

// POST /api/company — création (onboarding)
export async function POST(request: NextRequest) {
  const { user, supabase } = await resolveAuth(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = await request.json()

  const row = {
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
    // Logo déjà envoyé avant l'entreprise (aucun blocage) : rattaché à sa création
    ...await storedLogoUrl(createAdminClient(), user.id).then((url) => (url ? { logo_url: url } : {})),
  }
  // Métier et régime de TVA choisis à l'inscription (lib/legal/profile.ts) ;
  // sans la colonne (migration pas encore appliquée), l'entreprise s'enregistre sans eux
  const legalProfile = parseLegalProfile(body.legal_profile)
  const upsert = (values: Record<string, unknown>) =>
    supabase.from("companies").upsert(values, { onConflict: "user_id" }).select().single()

  let { data, error } = await upsert(legalProfile ? { ...row, legal_profile: legalProfile } : row)
  if (error && legalProfile && isMissingSchemaError(error)) ({ data, error } = await upsert(row))

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ company: data }, { status: 201 })
}

// PATCH /api/company — mise à jour des infos entreprise
export async function PATCH(request: NextRequest) {
  const { user, supabase } = await resolveAuth(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
  }

  // logo_url est fetch()é côté serveur à chaque génération de PDF (lib/pdf/*) —
  // ne jamais accepter autre chose que le bucket Supabase Storage de ce projet
  // (sinon SSRF : un utilisateur pourrait faire pointer le serveur vers une
  // adresse interne de son choix).
  if (body.logo_url && !isAllowedLogoUrl(body.logo_url)) {
    return NextResponse.json({ error: "URL de logo invalide" }, { status: 400 })
  }

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
    .maybeSingle()

  if (error) {
    console.error("[PATCH /api/company]", error.message)
    return NextResponse.json({ error: "L'entreprise n'a pas pu être enregistrée. Réessayez." }, { status: 500 })
  }
  // Aucune entreprise pour ce compte : rien à mettre à jour (elle se crée par POST)
  if (!data) {
    return NextResponse.json(
      { error: "Aucune entreprise à mettre à jour : enregistrez d'abord votre entreprise.", code: "COMPANY_NOT_FOUND" },
      { status: 404 },
    )
  }
  return NextResponse.json({ company: data })
}
