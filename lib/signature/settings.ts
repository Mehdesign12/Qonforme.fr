/**
 * Réglages de la signature en ligne : colonnes et lecture d'une ligne de
 * `signature_settings`. Module léger (sans PDF ni réseau), partagé par la
 * route des réglages, le serveur de la signature et le cron.
 */
import { DEFAULT_SIGNATURE_SETTINGS, type SignatureSettings } from "@/lib/signature/types"

export const SETTINGS_BASE_COLUMNS = "enabled,code_mode,code_threshold_ttc,link_validity_days"
/** Colonnes de 20261010_signature_withdrawal_deposit_reminder.sql. */
export const SETTINGS_EXTRA_COLUMNS = "expiry_reminder_enabled,expiry_reminder_days,deposit_percent"

/** Ligne de `signature_settings` → réglages complets (valeurs par défaut pour ce qui manque). */
export function settingsFromRow(data: Record<string, unknown> | null | undefined): SignatureSettings {
  if (!data) return DEFAULT_SIGNATURE_SETTINGS
  const d = DEFAULT_SIGNATURE_SETTINGS
  const reminderDays = Math.round(Number(data.expiry_reminder_days))
  const deposit = Number(data.deposit_percent)
  return {
    enabled: data.enabled !== false,
    code_mode: data.code_mode === "always" || data.code_mode === "never" ? data.code_mode : "threshold",
    code_threshold_ttc: Number(data.code_threshold_ttc ?? d.code_threshold_ttc),
    link_validity_days: Number(data.link_validity_days ?? d.link_validity_days),
    expiry_reminder_enabled: data.expiry_reminder_enabled === undefined ? d.expiry_reminder_enabled : data.expiry_reminder_enabled !== false,
    expiry_reminder_days: reminderDays >= 1 && reminderDays <= 30 ? reminderDays : d.expiry_reminder_days,
    deposit_percent: deposit >= 0 && deposit <= 100 ? deposit : d.deposit_percent,
  }
}
