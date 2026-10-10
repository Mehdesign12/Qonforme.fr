import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { hasSignatureAccess } from "@/lib/signature/access"
import { DEPOSIT_PERCENT_CHOICES, EXPIRY_REMINDER_DAY_CHOICES } from "@/lib/signature/rules"
import { SETTINGS_BASE_COLUMNS, SETTINGS_EXTRA_COLUMNS, settingsFromRow } from "@/lib/signature/settings"
import { DEFAULT_SIGNATURE_SETTINGS, type SignatureSettings } from "@/lib/signature/types"

/**
 * Réglages de la signature en ligne (Paramètres › Modèles de documents).
 * GET : { available, extras, access, settings } — available=false tant que la
 * migration 20261003_document_signatures.sql n'est pas appliquée (la section
 * se masque) ; extras=false tant que 20261010_signature_withdrawal_deposit_reminder.sql
 * ne l'est pas (relance avant expiration et acompte masqués).
 * PUT : enregistre les réglages (politique RLS : l'utilisateur ne touche que sa ligne).
 */
export const dynamic = "force-dynamic"

type Supabase = Awaited<ReturnType<typeof createClient>>

async function readSettings(supabase: Supabase, userId: string) {
  const full = await supabase
    .from("signature_settings")
    .select(`${SETTINGS_BASE_COLUMNS},${SETTINGS_EXTRA_COLUMNS}`)
    .eq("user_id", userId)
    .maybeSingle()
  if (!full.error) return { available: true, extras: true, data: full.data, error: null }
  if (!isMissingSchemaError(full.error)) return { available: true, extras: true, data: null, error: full.error }
  const base = await supabase.from("signature_settings").select(SETTINGS_BASE_COLUMNS).eq("user_id", userId).maybeSingle()
  if (base.error) return { available: !isMissingSchemaError(base.error), extras: false, data: null, error: isMissingSchemaError(base.error) ? null : base.error }
  return { available: true, extras: false, data: base.data, error: null }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const read = await readSettings(supabase, user.id)
  if (read.error) return NextResponse.json({ error: "Réglages indisponibles pour le moment." }, { status: 503 })
  if (!read.available) return NextResponse.json({ available: false, extras: false, access: false, settings: DEFAULT_SIGNATURE_SETTINGS })
  const access = (await hasSignatureAccess(supabase, user.id)) === true
  return NextResponse.json({ available: true, extras: read.extras, access, settings: settingsFromRow(read.data) })
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
  const reminderDays = Number(body.expiry_reminder_days ?? DEFAULT_SIGNATURE_SETTINGS.expiry_reminder_days)
  if (!(EXPIRY_REMINDER_DAY_CHOICES as readonly number[]).includes(reminderDays)) {
    return NextResponse.json({ error: "Choisissez quand part la relance.", field: "expiry_reminder_days" }, { status: 400 })
  }
  const deposit = Number(body.deposit_percent ?? 0)
  if (!(DEPOSIT_PERCENT_CHOICES as readonly number[]).includes(deposit)) {
    return NextResponse.json({ error: "Choisissez un acompte de la liste.", field: "deposit_percent" }, { status: 400 })
  }

  const settings: SignatureSettings = {
    enabled: body.enabled !== false,
    code_mode,
    code_threshold_ttc: Math.round(threshold * 100) / 100,
    link_validity_days: days,
    expiry_reminder_enabled: body.expiry_reminder_enabled !== false,
    expiry_reminder_days: reminderDays,
    deposit_percent: deposit,
  }
  const { enabled, code_threshold_ttc, link_validity_days, expiry_reminder_enabled, expiry_reminder_days, deposit_percent } = settings
  const base = { user_id: user.id, enabled, code_mode, code_threshold_ttc, link_validity_days }

  let { error } = await supabase
    .from("signature_settings")
    .upsert({ ...base, expiry_reminder_enabled, expiry_reminder_days, deposit_percent }, { onConflict: "user_id" })
  let extras = true
  if (error && isMissingSchemaError(error)) {
    // Migration 20261010 absente : seuls les réglages d'origine sont enregistrés
    extras = false
    ;({ error } = await supabase.from("signature_settings").upsert(base, { onConflict: "user_id" }))
  }
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: "La signature en ligne n'est pas encore activée." }, { status: 503 })
    return NextResponse.json({ error: "Réglages non enregistrés. Réessayez dans un instant." }, { status: 500 })
  }
  return NextResponse.json({
    extras,
    settings: extras ? settings : { ...settings, expiry_reminder_enabled: false, deposit_percent: 0 },
  })
}
