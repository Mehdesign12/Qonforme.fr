/**
 * Rappel « Je le ferai plus tard » (DECISIONS-STRATEGIQUES.md § 8, choix 4).
 *
 *   GET    → { available, reminder }   rappel en attente du compte
 *   PUT    { slot, custom?, target }   programme (remplace celui qui attendait)
 *   DELETE                             annule
 *
 * Créneaux en heure de Paris (lib/onboarding/reminder.ts), recalculés ici à la
 * réception. Un seul rappel en attente par compte. Envoi par le cron
 * app/api/cron/onboarding. `available: false` (et 503 en écriture) tant que la
 * migration 20261003_onboarding_emails.sql n'est pas appliquée.
 */
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { resolveReminderAt } from "@/lib/onboarding/reminder"
import { cancelPendingReminder, loadPendingReminder, scheduleReminder } from "@/lib/onboarding/store"
import { isReminderSlotKey, isReminderTarget } from "@/lib/onboarding/types"

const UNAVAILABLE = { error: "Le rappel n'est pas encore disponible." }

async function currentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function GET() {
  const { supabase, user } = await currentUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  const res = await loadPendingReminder(supabase, user.id)
  if (res.error) return NextResponse.json({ error: "Lecture impossible. Réessayez." }, { status: 503 })
  return NextResponse.json({ available: res.available, reminder: res.reminder })
}

export async function PUT(request: NextRequest) {
  const { user } = await currentUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { slot?: unknown; custom?: unknown; target?: unknown } | null
  if (!body || !isReminderSlotKey(body.slot) || !isReminderTarget(body.target)) {
    return NextResponse.json({ error: "Choisissez un moment et une étape." }, { status: 400 })
  }

  const resolved = resolveReminderAt({ slot: body.slot, custom: body.custom }, new Date())
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: 422 })

  const res = await scheduleReminder(createAdminClient(), user.id, body.target, resolved.at)
  if (!res.available) return NextResponse.json(UNAVAILABLE, { status: 503 })
  if (res.error || !res.reminder) return NextResponse.json({ error: "Rappel non enregistré. Réessayez." }, { status: 503 })
  return NextResponse.json({ reminder: res.reminder })
}

export async function DELETE() {
  const { user } = await currentUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  const res = await cancelPendingReminder(createAdminClient(), user.id)
  if (!res.available) return NextResponse.json(UNAVAILABLE, { status: 503 })
  if (res.error) return NextResponse.json({ error: "Annulation impossible. Réessayez." }, { status: 503 })
  return NextResponse.json({ ok: true })
}
