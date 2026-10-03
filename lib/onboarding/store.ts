/**
 * Accès en base du démarrage d'un compte : séquence d'emails, préférences,
 * rappel « plus tard » et devis d'essai (migration 20261003_onboarding_emails.sql).
 *
 * Chaque push part en production avant que la migration ne soit appliquée : une
 * table absente (isMissingSchemaError) se signale par `available: false` (ou
 * `unavailable`), et l'appelant n'envoie rien de nouveau. Une autre erreur
 * (réseau, délai) n'est jamais lue comme « pas de données » : l'appelant
 * s'abstient et réessaiera (règle « distinguer erreur réseau et pas de
 * données » de CLAUDE.md).
 *
 * Écritures avec le client admin (service_role) : les politiques RLS ne
 * laissent au compte connecté que la lecture de ses propres lignes.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import type { PendingReminder, ReminderTarget, SequenceStep } from "@/lib/onboarding/types"
import { isReminderTarget } from "@/lib/onboarding/types"
import { TRIAL_QUOTE_DAILY_LIMIT } from "@/lib/onboarding/trial-quote"

export { TRIAL_QUOTE_DAILY_LIMIT }

type DbError = { message: string; code?: string }

const UNIQUE_VIOLATION = "23505"

/** Vrai si les tables du démarrage existent (migration appliquée). */
export async function onboardingAvailable(db: SupabaseClient): Promise<{ available: boolean; error: DbError | null }> {
  const { error } = await db.from("onboarding_reminders").select("id").limit(1)
  if (!error) return { available: true, error: null }
  return isMissingSchemaError(error) ? { available: false, error: null } : { available: true, error }
}

/**
 * Inscrit un compte qui vient d'être créé dans la séquence. Seul appel qui crée
 * une ligne : les comptes existants n'y entrent jamais. Ne lève jamais.
 */
export async function enrollInOnboarding(admin: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { error } = await admin
      .from("onboarding_journeys")
      .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true })
    if (error) {
      if (!isMissingSchemaError(error)) console.error("[onboarding] inscription dans la séquence en échec :", error.message)
      return false
    }
    return true
  } catch (err) {
    console.error("[onboarding] inscription dans la séquence en échec :", err)
    return false
  }
}

/**
 * Réserve une étape avant l'envoi. `taken` : déjà envoyée (ou en cours d'envoi
 * par une autre exécution du cron).
 */
export async function claimSequenceStep(
  admin: SupabaseClient,
  row: { user_id: string; step: SequenceStep; sent_to: string | null },
): Promise<{ id: string } | { taken: true } | { error: DbError }> {
  const { data, error } = await admin.from("onboarding_emails").insert(row).select("id").single()
  if (!error && data) return { id: (data as { id: string }).id }
  if (error?.code === UNIQUE_VIOLATION) return { taken: true }
  return { error: error ?? { message: "Réservation impossible" } }
}

/** Libère une étape dont l'email n'est pas parti (elle repartira au prochain passage). */
export async function releaseSequenceStep(admin: SupabaseClient, id: string): Promise<void> {
  const { error } = await admin.from("onboarding_emails").delete().eq("id", id)
  if (error) console.error("[onboarding] étape non libérée", id, error.message)
}

/* ------------------------------------------------------------------ */
/* Préférences                                                         */
/* ------------------------------------------------------------------ */

/** Le compte reçoit-il les conseils de démarrage ? (pas de ligne = oui) */
export async function loadOnboardingEmailsEnabled(
  db: SupabaseClient,
  userId: string,
): Promise<{ available: boolean; enabled: boolean; error: DbError | null }> {
  const { data, error } = await db.from("email_preferences").select("onboarding_emails").eq("user_id", userId).maybeSingle()
  if (error) {
    const missing = isMissingSchemaError(error)
    return { available: !missing, enabled: true, error: missing ? null : error }
  }
  return { available: true, enabled: (data as { onboarding_emails?: boolean } | null)?.onboarding_emails !== false, error: null }
}

export async function saveOnboardingEmailsEnabled(
  admin: SupabaseClient,
  userId: string,
  enabled: boolean,
): Promise<{ available: boolean; error: DbError | null }> {
  const now = new Date().toISOString()
  const { error } = await admin.from("email_preferences").upsert(
    { user_id: userId, onboarding_emails: enabled, unsubscribed_at: enabled ? null : now, updated_at: now },
    { onConflict: "user_id" },
  )
  if (error) return { available: !isMissingSchemaError(error), error }
  return { available: true, error: null }
}

/* ------------------------------------------------------------------ */
/* Rappel « plus tard »                                                */
/* ------------------------------------------------------------------ */

export async function loadPendingReminder(
  db: SupabaseClient,
  userId: string,
): Promise<{ available: boolean; reminder: PendingReminder | null; error: DbError | null }> {
  const { data, error } = await db
    .from("onboarding_reminders")
    .select("target, remind_at")
    .eq("user_id", userId)
    .eq("status", "pending")
    .maybeSingle()
  if (error) {
    const missing = isMissingSchemaError(error)
    return { available: !missing, reminder: null, error: missing ? null : error }
  }
  const row = data as { target: string; remind_at: string } | null
  return {
    available: true,
    reminder: row && isReminderTarget(row.target) ? { target: row.target, remindAt: new Date(row.remind_at).toISOString() } : null,
    error: null,
  }
}

/** Annule le rappel en attente du compte (sans effet s'il n'y en a pas). */
export async function cancelPendingReminder(admin: SupabaseClient, userId: string): Promise<{ available: boolean; error: DbError | null }> {
  const { error } = await admin
    .from("onboarding_reminders")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "pending")
  if (error) return { available: !isMissingSchemaError(error), error }
  return { available: true, error: null }
}

/** Programme le rappel du compte : remplace celui qui attendait (un seul à la fois). */
export async function scheduleReminder(
  admin: SupabaseClient,
  userId: string,
  target: ReminderTarget,
  at: Date,
): Promise<{ available: boolean; reminder: PendingReminder | null; error: DbError | null }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const cancelled = await cancelPendingReminder(admin, userId)
    if (cancelled.error) return { available: cancelled.available, reminder: null, error: cancelled.error }
    const { error } = await admin
      .from("onboarding_reminders")
      .insert({ user_id: userId, target, remind_at: at.toISOString(), status: "pending" })
    if (!error) return { available: true, reminder: { target, remindAt: at.toISOString() }, error: null }
    // Une autre demande a inséré entre-temps (index « un seul en attente ») : on recommence
    if (error.code !== UNIQUE_VIOLATION) return { available: !isMissingSchemaError(error), reminder: null, error }
  }
  return { available: true, reminder: null, error: { message: "Rappel non enregistré, réessayez." } }
}

/* ------------------------------------------------------------------ */
/* Devis d'essai                                                       */
/* ------------------------------------------------------------------ */

/**
 * Réserve un envoi de devis d'essai : la ligne est insérée d'abord, puis on
 * compte les envois des dernières 24 heures. Au-delà de la limite, la ligne est
 * retirée et l'envoi refusé ; deux demandes simultanées ne passent donc jamais
 * la limite à elles deux.
 */
export async function claimTrialQuoteSend(
  admin: SupabaseClient,
  userId: string,
  sentTo: string,
  now: Date = new Date(),
): Promise<{ id: string; remaining: number } | { limited: true } | { unavailable: true } | { error: DbError }> {
  const { data, error } = await admin
    .from("trial_quote_sends")
    .insert({ user_id: userId, sent_to: sentTo, sent_at: now.toISOString() })
    .select("id")
    .single()
  if (error || !data) {
    if (error && isMissingSchemaError(error)) return { unavailable: true }
    return { error: error ?? { message: "Réservation impossible" } }
  }
  const id = (data as { id: string }).id

  const since = new Date(now.getTime() - 24 * 3_600_000).toISOString()
  const { count, error: countError } = await admin
    .from("trial_quote_sends")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("sent_at", since)
  if (countError || count === null) {
    await releaseTrialQuoteSend(admin, id)
    return { error: countError ?? { message: "Comptage impossible" } }
  }
  if (count > TRIAL_QUOTE_DAILY_LIMIT) {
    await releaseTrialQuoteSend(admin, id)
    return { limited: true }
  }
  return { id, remaining: TRIAL_QUOTE_DAILY_LIMIT - count }
}

/** Retire un envoi réservé dont l'email n'est pas parti. */
export async function releaseTrialQuoteSend(admin: SupabaseClient, id: string): Promise<void> {
  const { error } = await admin.from("trial_quote_sends").delete().eq("id", id)
  if (error) console.error("[onboarding] envoi de devis d'essai non libéré", id, error.message)
}
