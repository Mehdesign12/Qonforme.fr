/**
 * GET /api/cron/planning
 *
 * Rappels par email du planning (rendez-vous qui approchent, tâches dont le
 * rappel est demandé : lib/planning/reminders.ts). Même infrastructure que les
 * autres tâches planifiées : cron-job.org avec l'en-tête
 * « Authorization: Bearer {CRON_SECRET} », TOUTES LES 15 MINUTES (un rappel part
 * au plus 15 minutes après l'heure choisie).
 *
 * Le cron du démarrage des comptes (/api/cron/onboarding, déjà toutes les 15
 * minutes) lance aussi ces rappels : une seule des deux tâches suffit, et les
 * deux ensemble n'envoient jamais un rappel en double (réservation en base).
 */
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { runPlanningReminders } from "@/lib/planning/reminders"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("[cron/planning] CRON_SECRET non défini")
    return NextResponse.json({ error: "Configuration manquante" }, { status: 500 })
  }
  if (request.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const startedAt = Date.now()
  const admin = createAdminClient()
  const results = await runPlanningReminders(admin)
  const hasErrors = results.appointments.errors.length > 0 || results.tasks.errors.length > 0
  // Toutes les 15 minutes : on ne journalise que les passages qui ont fait quelque chose
  if (hasErrors || results.appointments.sent > 0 || results.tasks.sent > 0) {
    await admin.from("cron_logs").insert({
      job_name: "planning",
      status: hasErrors ? "error" : "ok",
      results,
      duration_ms: Date.now() - startedAt,
    })
  }
  return NextResponse.json({ ok: true, results })
}
