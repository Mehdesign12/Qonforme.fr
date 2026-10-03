import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { parseReminderSettingsInput } from "@/lib/reminders/settings"
import { loadReminderSettings, saveReminderSettings } from "@/lib/reminders/store"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

/**
 * GET /api/reminder-settings — réglages des relances du compte.
 * `available: false` tant que la migration 20261003 n'est pas appliquée : la
 * page Paramètres › Relances décrit alors le fonctionnement actuel (J+30, J+45)
 * sans proposer de réglage.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401, headers: NO_STORE })

  const { settings, available, error } = await loadReminderSettings(supabase, user.id)
  if (error) {
    console.error("[reminder-settings] lecture :", error.message)
    return NextResponse.json({ error: "Impossible de charger vos réglages de relance." }, { status: 500, headers: NO_STORE })
  }
  return NextResponse.json({ settings, available }, { headers: NO_STORE })
}

/** PUT /api/reminder-settings — enregistre les réglages (valeurs proposées uniquement). */
export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401, headers: NO_STORE })

  const body = await request.json().catch(() => null)
  const parsed = parseReminderSettingsInput(body)
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE })

  const saved = await saveReminderSettings(supabase, user.id, parsed.settings)
  if (!saved.available) {
    return NextResponse.json(
      { error: "Les réglages de relance ne sont pas encore disponibles. Réessayez un peu plus tard." },
      { status: 503, headers: NO_STORE },
    )
  }
  if (saved.error || !saved.settings) {
    console.error("[reminder-settings] enregistrement :", saved.error?.message)
    return NextResponse.json({ error: "L'enregistrement a échoué. Réessayez." }, { status: 500, headers: NO_STORE })
  }
  return NextResponse.json({ settings: saved.settings, available: true }, { headers: NO_STORE })
}
