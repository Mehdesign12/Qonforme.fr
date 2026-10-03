/**
 * GET /api/cron/onboarding
 *
 * Démarrage des comptes neufs (DECISIONS-STRATEGIQUES.md § 8 et § 10) :
 *   1. rappels « Je le ferai plus tard » arrivés à leur heure ;
 *   2. séquence d'emails déclenchés par les actions (lib/onboarding/sequence.ts).
 *
 * Même infrastructure que /api/cron/send-reminders : appelée par cron-job.org
 * (ou tout autre planificateur externe) avec l'en-tête
 * « Authorization: Bearer {CRON_SECRET} ». À programmer TOUTES LES 15 MINUTES
 * (les rappels tombent à 19 h, 7 h 30 ou 9 h) : un rappel part au plus
 * 15 minutes après l'heure choisie. La séquence ne part que du lundi au samedi,
 * de 9 h à 19 h, heure de Paris.
 *
 * Sans la migration 20261003_onboarding_emails.sql : la route répond
 * `inactive` et n'envoie rien.
 *
 * Jamais deux fois le même email :
 * - un rappel est réservé (pending → sending, écriture conditionnelle) avant
 *   l'envoi ; en cas d'échec il repasse en attente ; une réservation restée en
 *   « sending » n'est jamais renvoyée ;
 * - une étape de la séquence est inscrite au journal (contrainte d'unicité)
 *   avant l'envoi, et retirée si l'email échoue.
 * Jamais à tous les comptes existants : seuls ceux inscrits à la création du
 * compte (table onboarding_journeys, après la migration) sont lus, et seulement
 * pendant les 30 jours qui suivent.
 */
import { NextRequest, NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import { buildLaterReminderEmail, buildSequenceEmail, type SequenceEmailStep } from "@/lib/email/templates/onboarding"
import { REMINDER_STALE_HOURS } from "@/lib/onboarding/reminder"
import { frenchDay } from "@/lib/onboarding/paris-time"
import { isSequenceSendingTime, planSequenceEmail, SEQUENCE_WINDOW_DAYS } from "@/lib/onboarding/sequence"
import { claimSequenceStep, onboardingAvailable, releaseSequenceStep } from "@/lib/onboarding/store"
import { loadAccountStates } from "@/lib/onboarding/facts"
import { listUnsubscribeHeaders, unsubscribePageUrl } from "@/lib/onboarding/unsubscribe"
import { isReminderTarget } from "@/lib/onboarding/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

type Summary = { sent: number; skipped: number; errors: string[] }
const summary = (): Summary => ({ sent: 0, skipped: 0, errors: [] })
const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))

const LONG_DATE = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" })

type Account = { email: string; firstName: string }

/**
 * Adresse et prénom du compte (Supabase Auth). `gone` : compte supprimé ou sans
 * adresse ; `error` : lecture en échec (on réessaiera au prochain passage).
 */
async function accountOf(admin: SupabaseClient, userId: string): Promise<{ account: Account } | { gone: true } | { error: string }> {
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId)
    if (error) return (error as { status?: number }).status === 404 || /not found/i.test(error.message) ? { gone: true } : { error: error.message }
    if (!data?.user?.email) return { gone: true }
    const meta = (data.user.user_metadata ?? {}) as { first_name?: unknown }
    return { account: { email: data.user.email, firstName: typeof meta.first_name === "string" ? meta.first_name : "" } }
  } catch (err) {
    return { error: errorText(err) }
  }
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("[cron/onboarding] CRON_SECRET non défini")
    return NextResponse.json({ error: "Configuration manquante" }, { status: 500 })
  }
  if (request.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const startedAt = Date.now()
  const admin = createAdminClient()
  const now = new Date()

  const probe = await onboardingAvailable(admin)
  if (probe.error) {
    console.error("[cron/onboarding] tables illisibles :", probe.error.message)
    return NextResponse.json({ error: "Tables du démarrage illisibles" }, { status: 500 })
  }
  if (!probe.available) return NextResponse.json({ ok: true, mode: "inactive" })

  const reminders = await sendDueReminders(admin, now)
  const sequence = isSequenceSendingTime(now) ? await sendSequence(admin, now) : { ...summary(), outsideHours: true }

  const results = { reminders, sequence }
  const hasErrors = reminders.errors.length > 0 || sequence.errors.length > 0
  // Toutes les 15 minutes : on ne journalise que les passages qui ont fait quelque chose
  if (hasErrors || reminders.sent > 0 || sequence.sent > 0) {
    await admin.from("cron_logs").insert({
      job_name: "onboarding",
      status: hasErrors ? "error" : "ok",
      results,
      duration_ms: Date.now() - startedAt,
    })
  }
  return NextResponse.json({ ok: true, results })
}

/* ------------------------------------------------------------------ */
/* Rappels « plus tard »                                               */
/* ------------------------------------------------------------------ */

async function sendDueReminders(admin: SupabaseClient, now: Date): Promise<Summary> {
  const res = summary()
  const { data, error } = await admin
    .from("onboarding_reminders")
    .select("id,user_id,target,remind_at,created_at")
    .eq("status", "pending")
    .lte("remind_at", now.toISOString())
    .order("remind_at", { ascending: true })
    .limit(100)
  if (error) {
    res.errors.push(`Lecture des rappels : ${error.message}`)
    return res
  }

  for (const row of (data ?? []) as { id: string; user_id: string; target: string; remind_at: string; created_at: string }[]) {
    // Cron arrêté longtemps : un rappel périmé n'est plus envoyé
    if (now.getTime() - new Date(row.remind_at).getTime() > REMINDER_STALE_HOURS * 3_600_000) {
      await admin.from("onboarding_reminders").update({ status: "expired" }).eq("id", row.id).eq("status", "pending")
      res.skipped++
      continue
    }

    // Réservation : une seule exécution passe pending → sending
    const { data: claimed, error: claimError } = await admin
      .from("onboarding_reminders")
      .update({ status: "sending" })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
    if (claimError) { res.errors.push(`${row.id}: ${claimError.message}`); continue }
    if (!claimed || claimed.length === 0) { res.skipped++; continue }

    try {
      const found = await accountOf(admin, row.user_id)
      if ("error" in found) throw new Error(`Compte illisible : ${found.error}`)
      if ("gone" in found || !isReminderTarget(row.target)) {
        await admin.from("onboarding_reminders").update({ status: "expired" }).eq("id", row.id)
        res.skipped++
        continue
      }
      const account = found.account
      const { subject, html } = buildLaterReminderEmail({
        firstName: account.firstName,
        target: row.target,
        requestedOn: frenchDay(new Date(row.created_at)),
      })
      await sendEmail({ to: account.email, subject, html, fromName: "Qonforme" })
      await admin.from("onboarding_reminders").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", row.id)
      res.sent++
    } catch (err) {
      // Pas parti : il repart au prochain passage
      await admin.from("onboarding_reminders").update({ status: "pending" }).eq("id", row.id).eq("status", "sending")
      res.errors.push(`${row.id}: ${errorText(err)}`)
    }
  }
  return res
}

/* ------------------------------------------------------------------ */
/* Séquence                                                            */
/* ------------------------------------------------------------------ */

async function sendSequence(admin: SupabaseClient, now: Date): Promise<Summary> {
  const res = summary()
  const since = new Date(now.getTime() - (SEQUENCE_WINDOW_DAYS + 1) * 86_400_000).toISOString()

  const journeys: { user_id: string; enrolled_at: string }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("onboarding_journeys")
      .select("user_id,enrolled_at")
      .gte("enrolled_at", since)
      .order("enrolled_at", { ascending: true })
      .range(from, from + 999)
    if (error) {
      res.errors.push(`Lecture des comptes : ${error.message}`)
      return res
    }
    journeys.push(...((data ?? []) as typeof journeys))
    if (!data || data.length < 1000) break
  }

  for (let i = 0; i < journeys.length; i += 150) {
    const batch = journeys.slice(i, i + 150)
    const { states, error } = await loadAccountStates(admin, batch.map((j) => j.user_id))
    if (error) {
      // Faits incertains : aucun email pour ce lot à ce passage
      res.errors.push(`Lecture des faits : ${error.message}`)
      res.skipped += batch.length
      continue
    }

    for (const journey of batch) {
      const state = states.get(journey.user_id)
      if (!state) continue
      const step = planSequenceEmail({ now, enrolledAt: journey.enrolled_at, ...state })
      if (!step || step === "welcome") continue

      // Pas de lien de désinscription (secret absent) : pas d'email (art. L34-5 du CPCE)
      const unsubscribeUrl = unsubscribePageUrl(journey.user_id)
      const headers = listUnsubscribeHeaders(journey.user_id)
      if (!unsubscribeUrl || !headers) { res.errors.push("Secret de désinscription absent"); return res }

      const found = await accountOf(admin, journey.user_id)
      if (!("account" in found)) { res.skipped++; continue }
      const account = found.account

      const claim = await claimSequenceStep(admin, { user_id: journey.user_id, step, sent_to: account.email })
      if ("taken" in claim) { res.skipped++; continue }
      if ("error" in claim) { res.errors.push(`${journey.user_id}/${step}: ${claim.error.message}`); continue }

      try {
        const { subject, html } = buildSequenceEmail(step as SequenceEmailStep, {
          firstName: account.firstName,
          unsubscribeUrl,
          signupDate: LONG_DATE.format(new Date(journey.enrolled_at)),
          hasDraftInvoice: state.facts.draftInvoices > 0,
        })
        await sendEmail({ to: account.email, subject, html, fromName: "Qonforme", headers })
        res.sent++
      } catch (err) {
        await releaseSequenceStep(admin, claim.id)
        res.errors.push(`${journey.user_id}/${step}: ${errorText(err)}`)
      }
    }
  }
  return res
}
