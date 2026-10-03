import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { hasSignatureAccess } from "@/lib/signature/access"
import { DEFAULT_SIGNATURE_SETTINGS, type CodeMode, type SignatureSettings } from "@/lib/signature/types"

/**
 * Réglages de la signature en ligne (Paramètres › Modèles de documents).
 * GET : { available, access, settings } — available=false tant que la migration
 * 20261003_document_signatures.sql n'est pas appliquée (la section se masque).
 * PUT : enregistre les réglages (politique RLS : l'utilisateur ne touche que sa ligne).
 */
export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { data, error } = await supabase
    .from("signature_settings")
    .select("enabled,code_mode,code_threshold_ttc,link_validity_days")
    .eq("user_id", user.id)
    .maybeSingle()
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ available: false, access: false, settings: DEFAULT_SIGNATURE_SETTINGS })
    return NextResponse.json({ error: "Réglages indisponibles pour le moment." }, { status: 503 })
  }
  const access = (await hasSignatureAccess(supabase, user.id)) === true
  const settings: SignatureSettings = data
    ? { enabled: data.enabled !== false, code_mode: data.code_mode as CodeMode, code_threshold_ttc: Number(data.code_threshold_ttc), link_validity_days: Number(data.link_validity_days) }
    : DEFAULT_SIGNATURE_SETTINGS
  return NextResponse.json({ available: true, access, settings })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: "Requête invalide" }, { status: 400 }) }

  const code_mode = body.code_mode === "always" || body.code_mode === "never" ? body.code_mode : "threshold"
  const threshold = Number(body.code_threshold_ttc)
  const days = Math.round(Number(body.link_validity_days))
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 10_000_000) {
    return NextResponse.json({ error: "Indiquez un montant valide.", field: "code_threshold_ttc" }, { status: 400 })
  }
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    return NextResponse.json({ error: "Indiquez une durée entre 1 et 365 jours.", field: "link_validity_days" }, { status: 400 })
  }

  const settings: SignatureSettings = {
    enabled: body.enabled !== false,
    code_mode,
    code_threshold_ttc: Math.round(threshold * 100) / 100,
    link_validity_days: days,
  }
  const { error } = await supabase.from("signature_settings").upsert({ user_id: user.id, ...settings }, { onConflict: "user_id" })
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: "La signature en ligne n'est pas encore activée." }, { status: 503 })
    return NextResponse.json({ error: "Réglages non enregistrés. Réessayez dans un instant." }, { status: 500 })
  }
  return NextResponse.json({ settings })
}
