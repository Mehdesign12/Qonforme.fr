/**
 * Rappels par email du planning, lancés toutes les 15 minutes
 * (app/api/cron/planning, et le cron du démarrage des comptes) :
 *
 * 1. Rendez-vous : un email à l'artisan quand l'heure choisie (1 h avant, la
 *    veille) est passée et que le rendez-vous n'a pas encore eu lieu.
 * 2. Tâches : un seul email par compte, avec toutes les tâches dont l'heure de
 *    rappel est passée et qui ne sont pas cochées.
 *
 * Jamais deux fois le même email : le rappel est réservé en base
 * (`reminder_sent_at`, écriture conditionnelle) AVANT l'envoi ; si l'email
 * échoue, la réservation est libérée et le rappel repart au passage suivant.
 * Un rappel resté en attente plus de 24 h (cron arrêté) n'est pas envoyé : il
 * serait périmé, il est seulement marqué comme traité.
 *
 * Migrations absentes (20261021_planning_appointments.sql, 20261021_work_notes.sql) :
 * la partie concernée est ignorée, sans erreur.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/email/resend"
import { buildAppointmentReminderEmail, buildTasksReminderEmail } from "@/lib/email/templates/planning-reminder"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { appUrl } from "@/lib/signature/server"
import {
  APPOINTMENT_KIND_LABELS, dayLabel, parisParts, timeLabel, type AppointmentKind,
} from "@/lib/planning/appointments"
import { daysBetween } from "@/lib/utils/paris-date"

export type Summary = { sent: number; skipped: number; errors: string[] }
const summary = (): Summary => ({ sent: 0, skipped: 0, errors: [] })
const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))

const BATCH = 300
/** Au-delà, un rappel est périmé. */
export const STALE_HOURS = 24

export interface PlanningRemindersResult {
  appointments: Summary & { available: boolean }
  tasks: Summary & { available: boolean }
}

/** Le rappel d'un rendez-vous est-il dû ? Heure d'envoi passée, rendez-vous pas encore commencé. */
export function appointmentReminderDue(startsAt: string, reminderMinutes: number, now: Date): boolean {
  const start = new Date(startsAt).getTime()
  return start > now.getTime() && start - reminderMinutes * 60_000 <= now.getTime()
}

/** « dans 1 h », « demain », « aujourd'hui » : selon l'écart réel au rendez-vous. */
export function inLabel(startsAt: string, now: Date): string {
  const minutes = Math.round((new Date(startsAt).getTime() - now.getTime()) / 60_000)
  if (minutes <= 90) return minutes <= 5 ? "maintenant" : `dans ${minutes < 60 ? `${minutes} min` : "1 h"}`
  const days = daysBetween(parisParts(now.toISOString()).date, parisParts(startsAt).date)
  if (days === 0) return `dans ${Math.round(minutes / 60)} h`
  return days === 1 ? "demain" : `le ${dayLabel(parisParts(startsAt).date).toLowerCase()}`
}

type Join = { name?: string | null } | { name?: string | null }[] | null
const clientName = (j: Join) => (Array.isArray(j) ? j[0]?.name : j?.name) ?? null

async function accountEmail(admin: SupabaseClient, cache: Map<string, string | null>, userId: string): Promise<string | null> {
  if (cache.has(userId)) return cache.get(userId) ?? null
  let email: string | null = null
  try {
    const { data } = await admin.auth.admin.getUserById(userId)
    email = data.user?.email ?? null
  } catch { /* compte illisible : rien ne part, on réessaiera */ }
  cache.set(userId, email)
  return email
}

export async function runPlanningReminders(admin: SupabaseClient, now: Date = new Date()): Promise<PlanningRemindersResult> {
  const emails = new Map<string, string | null>()
  const nowIso = now.toISOString()
  const planningUrl = `${appUrl()}/planning`
  const appointments = { ...summary(), available: true }
  const tasks = { ...summary(), available: true }

  /* ── 1. Rendez-vous ── */
  const horizon = new Date(now.getTime() + (7 * 24 + 1) * 3_600_000).toISOString()
  const due = await admin
    .from("appointments")
    .select("id,user_id,kind,title,starts_at,address,reminder_minutes,client:clients(name)")
    .eq("status", "planned")
    .not("reminder_minutes", "is", null)
    .is("reminder_sent_at", null)
    .gt("starts_at", nowIso)
    .lte("starts_at", horizon)
    .order("starts_at", { ascending: true })
    .limit(BATCH)
  if (due.error) {
    if (isMissingSchemaError(due.error)) appointments.available = false
    else appointments.errors.push(`lecture : ${due.error.message}`)
  }
  for (const row of (due.data ?? []) as unknown as {
    id: string; user_id: string; kind: AppointmentKind; title: string; starts_at: string
    address: string | null; reminder_minutes: number; client: Join
  }[]) {
    try {
      if (!appointmentReminderDue(row.starts_at, row.reminder_minutes, now)) { appointments.skipped++; continue }
      const to = await accountEmail(admin, emails, row.user_id)
      if (!to) { appointments.skipped++; continue }

      const { data: claimed } = await admin.from("appointments")
        .update({ reminder_sent_at: nowIso })
        .eq("id", row.id).eq("status", "planned").is("reminder_sent_at", null)
        .select("id")
      if (!claimed || claimed.length === 0) { appointments.skipped++; continue }

      const start = parisParts(row.starts_at)
      const { subject, html } = buildAppointmentReminderEmail({
        title: row.title,
        kindLabel: APPOINTMENT_KIND_LABELS[row.kind] ?? "Rendez-vous",
        whenLabel: `${dayLabel(start.date).toLowerCase()} à ${timeLabel(start.time)}`,
        inLabel: inLabel(row.starts_at, now),
        clientName: clientName(row.client),
        address: row.address,
        mapsUrl: row.address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(row.address)}` : null,
        planningUrl,
      })
      try {
        await sendEmail({ to, subject, html, fromName: "Qonforme" })
      } catch (err) {
        await admin.from("appointments").update({ reminder_sent_at: null }).eq("id", row.id)
        appointments.errors.push(`${row.title}: ${errorText(err)}`)
        continue
      }
      appointments.sent++
    } catch (err) {
      appointments.errors.push(`${row.title}: ${errorText(err)}`)
    }
  }

  /* ── 2. Tâches ── */
  const open = await admin
    .from("work_notes")
    .select("id,user_id,body,due_at,remind_at,client:clients(name)")
    .eq("kind", "task")
    .is("done_at", null)
    .is("reminder_sent_at", null)
    .not("remind_at", "is", null)
    .lte("remind_at", nowIso)
    .order("remind_at", { ascending: true })
    .limit(BATCH)
  if (open.error) {
    if (isMissingSchemaError(open.error)) tasks.available = false
    else tasks.errors.push(`lecture : ${open.error.message}`)
  }
  type TaskRow = { id: string; user_id: string; body: string; due_at: string | null; remind_at: string; client: Join }
  const byUser = new Map<string, TaskRow[]>()
  for (const row of (open.data ?? []) as unknown as TaskRow[]) {
    if (now.getTime() - new Date(row.remind_at).getTime() > STALE_HOURS * 3_600_000) {
      await admin.from("work_notes").update({ reminder_sent_at: nowIso }).eq("id", row.id).is("reminder_sent_at", null)
      tasks.skipped++
      continue
    }
    byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row])
  }
  for (const [userId, rows] of Array.from(byUser.entries())) {
    try {
      const to = await accountEmail(admin, emails, userId)
      if (!to) { tasks.skipped += rows.length; continue }
      const ids = rows.map((r) => r.id)
      const { data: claimed } = await admin.from("work_notes")
        .update({ reminder_sent_at: nowIso })
        .in("id", ids).is("reminder_sent_at", null).is("done_at", null)
        .select("id")
      const won = new Set(((claimed ?? []) as { id: string }[]).map((c) => c.id))
      const mine = rows.filter((r) => won.has(r.id))
      tasks.skipped += rows.length - mine.length
      if (mine.length === 0) continue

      const { subject, html } = buildTasksReminderEmail({
        planningUrl,
        tasks: mine.map((r) => ({
          body: r.body,
          dueLabel: r.due_at ? dayLabel(parisParts(r.due_at).date).toLowerCase() : null,
          clientName: clientName(r.client),
        })),
      })
      try {
        await sendEmail({ to, subject, html, fromName: "Qonforme" })
      } catch (err) {
        await admin.from("work_notes").update({ reminder_sent_at: null }).in("id", mine.map((r) => r.id))
        tasks.errors.push(`${mine.length} tâche(s): ${errorText(err)}`)
        continue
      }
      tasks.sent += mine.length
    } catch (err) {
      tasks.errors.push(errorText(err))
    }
  }

  return { appointments, tasks }
}
