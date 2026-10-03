/**
 * Conseils de démarrage dans Paramètres › Relances.
 *
 *   GET → { available, enabled, reminder }
 *   PUT { enabled } → { enabled }
 *
 * Ne concerne que la séquence de démarrage : l'envoi des documents, les copies,
 * les relances de factures et les emails de sécurité ne sont pas réglés ici.
 * `available: false` tant que la migration 20261003_onboarding_emails.sql n'est
 * pas appliquée (la carte des paramètres reste alors masquée).
 */
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { loadOnboardingEmailsEnabled, loadPendingReminder, saveOnboardingEmailsEnabled } from "@/lib/onboarding/store"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const [prefs, reminder] = await Promise.all([
    loadOnboardingEmailsEnabled(supabase, user.id),
    loadPendingReminder(supabase, user.id),
  ])
  if (!prefs.available || !reminder.available) return NextResponse.json({ available: false })
  if (prefs.error || reminder.error) return NextResponse.json({ error: "Lecture impossible. Réessayez." }, { status: 503 })
  return NextResponse.json({ available: true, enabled: prefs.enabled, reminder: reminder.reminder })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { enabled?: unknown } | null
  if (typeof body?.enabled !== "boolean") return NextResponse.json({ error: "Valeur attendue : enabled" }, { status: 400 })

  const res = await saveOnboardingEmailsEnabled(createAdminClient(), user.id, body.enabled)
  if (!res.available) return NextResponse.json({ error: "Réglage pas encore disponible." }, { status: 503 })
  if (res.error) return NextResponse.json({ error: "Enregistrement impossible. Réessayez." }, { status: 503 })
  return NextResponse.json({ enabled: body.enabled })
}
