/**
 * Accès en base des relances : réglages (`reminder_settings`) et journal des
 * envois (`document_reminders`).
 *
 * Chaque push part en production avant que la migration
 * 20261003_invoice_number_at_issue_and_reminders.sql ne soit appliquée : une
 * table absente (isMissingSchemaError) se signale par `available: false`, et
 * l'appelant garde alors le comportement d'avant (J+30 et J+45, colonnes
 * reminder_1_sent_at / reminder_2_sent_at de la facture).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import {
  settingsFromRow, settingsToRow, type ReminderSettings, type ReminderSettingsRow,
} from "@/lib/reminders/settings"
import type { ReminderLogEntry } from "@/lib/reminders/schedule"

type DbError = { message: string; code?: string }

/** Code Postgres d'une violation d'unicité : l'étape est déjà réservée. */
const UNIQUE_VIOLATION = "23505"

export const SETTINGS_COLUMNS =
  "user_id, invoice_reminders_enabled, before_due_days, after_due_days, quote_followup_enabled, quote_followup_days, quote_followup_max"

/** Réglages d'un compte ; `available: false` tant que la table n'existe pas. */
export async function loadReminderSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ settings: ReminderSettings; available: boolean; error: DbError | null }> {
  const { data, error } = await supabase
    .from("reminder_settings")
    .select(SETTINGS_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle()
  if (error) {
    return { settings: settingsFromRow(null), available: !isMissingSchemaError(error), error: isMissingSchemaError(error) ? null : error }
  }
  return { settings: settingsFromRow(data as ReminderSettingsRow | null), available: true, error: null }
}

/** Enregistre les réglages d'un compte (insertion ou mise à jour). */
export async function saveReminderSettings(
  supabase: SupabaseClient,
  userId: string,
  settings: ReminderSettings,
): Promise<{ settings: ReminderSettings | null; available: boolean; error: DbError | null }> {
  const { data, error } = await supabase
    .from("reminder_settings")
    .upsert({ user_id: userId, ...settingsToRow(settings), updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select(SETTINGS_COLUMNS)
    .single()
  if (error) return { settings: null, available: !isMissingSchemaError(error), error }
  return { settings: settingsFromRow(data as ReminderSettingsRow), available: true, error: null }
}

/** Journal d'un ou plusieurs documents, groupé par document. */
export async function loadReminderLog(
  supabase: SupabaseClient,
  documentType: "invoice" | "quote",
  documentIds: string[],
): Promise<{ log: Map<string, ReminderLogEntry[]>; available: boolean; error: DbError | null }> {
  const log = new Map<string, ReminderLogEntry[]>()
  for (let i = 0; i < documentIds.length; i += 150) {
    const chunk = documentIds.slice(i, i + 150)
    const { data, error } = await supabase
      .from("document_reminders")
      .select("document_id, stage, origin, sent_at")
      .eq("document_type", documentType)
      .in("document_id", chunk)
      .order("sent_at", { ascending: true })
    if (error) return { log, available: !isMissingSchemaError(error), error: isMissingSchemaError(error) ? null : error }
    for (const row of (data ?? []) as (ReminderLogEntry & { document_id: string })[]) {
      const list = log.get(row.document_id) ?? []
      list.push({ stage: row.stage, origin: row.origin, sent_at: row.sent_at })
      log.set(row.document_id, list)
    }
  }
  return { log, available: true, error: null }
}

/** Vrai si le journal des relances existe (migration appliquée). */
export async function reminderLogAvailable(supabase: SupabaseClient): Promise<{ available: boolean; error: DbError | null }> {
  const { error } = await supabase.from("document_reminders").select("id").limit(1)
  if (!error) return { available: true, error: null }
  return isMissingSchemaError(error) ? { available: false, error: null } : { available: true, error }
}

/**
 * Réserve une étape automatique avant l'envoi de l'email. `taken` : l'étape est
 * déjà au journal (envoyée, ou en cours d'envoi par une autre exécution).
 */
export async function claimReminderStage(
  admin: SupabaseClient,
  row: { user_id: string; document_type: "invoice" | "quote"; document_id: string; stage: string; sent_to: string },
): Promise<{ id: string } | { taken: true } | { error: DbError }> {
  const { data, error } = await admin
    .from("document_reminders")
    .insert({ ...row, origin: "auto" })
    .select("id")
    .single()
  if (!error && data) return { id: (data as { id: string }).id }
  if (error?.code === UNIQUE_VIOLATION) return { taken: true }
  return { error: error ?? { message: "Réservation impossible" } }
}

/** Libère une étape réservée dont l'email n'est pas parti (elle repartira au prochain passage). */
export async function releaseReminderStage(admin: SupabaseClient, id: string): Promise<void> {
  const { error } = await admin.from("document_reminders").delete().eq("id", id)
  if (error) console.error("[reminders] étape non libérée", id, error.message)
}

/** Journalise une relance envoyée à la main (bouton « Relancer »). */
export async function recordManualReminder(
  supabase: SupabaseClient,
  row: { user_id: string; document_type: "invoice" | "quote"; document_id: string; sent_to: string },
): Promise<DbError | null> {
  const { error } = await supabase
    .from("document_reminders")
    .insert({ ...row, stage: "manual", origin: "manual" })
  return error ?? null
}
