/**
 * Réglages des relances automatiques, par compte (table `reminder_settings`,
 * migration 20261003_invoice_number_at_issue_and_reminders.sql).
 *
 * Module pur : types, valeurs proposées, valeurs par défaut, lecture d'une
 * ligne et validation d'une saisie. Utilisable côté serveur, navigateur (page
 * Paramètres › Relances, démo) et tests.
 *
 * Les valeurs par défaut reproduisent le comportement d'avant les réglages :
 * relances des factures 30 et 45 jours après l'échéance, pas de rappel avant
 * l'échéance, pas de relance des devis (un email ne part jamais vers les
 * clients d'un artisan sans qu'il l'ait choisi).
 */

/** Rappel avant l'échéance : jours avant la date d'échéance. */
export const BEFORE_DUE_CHOICES = [1, 3, 5, 7] as const
/** Relances après l'échéance : jours après la date d'échéance. */
export const AFTER_DUE_CHOICES = [7, 15, 30, 45] as const
/** Relance d'un devis envoyé sans réponse : jours après l'envoi. */
export const QUOTE_FOLLOWUP_DAY_CHOICES = [3, 5, 7, 10, 15] as const
/** Nombre de relances d'un même devis. */
export const QUOTE_FOLLOWUP_MAX_CHOICES = [1, 2] as const

export interface ReminderSettings {
  /** Relances des factures impayées actives. */
  invoiceRemindersEnabled: boolean
  /** Rappel N jours avant l'échéance, ou null (pas de rappel). */
  beforeDueDays: number | null
  /** Relances N jours après l'échéance, triées. */
  afterDueDays: number[]
  /** Relance des devis envoyés restés sans réponse. */
  quoteFollowupEnabled: boolean
  /** Délai depuis l'envoi du devis (et entre deux relances d'un même devis). */
  quoteFollowupDays: number
  /** Nombre de relances d'un même devis (1 par défaut). */
  quoteFollowupMax: number
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  invoiceRemindersEnabled: true,
  beforeDueDays: null,
  afterDueDays: [30, 45],
  quoteFollowupEnabled: false,
  quoteFollowupDays: 7,
  quoteFollowupMax: 1,
}

/** Ligne de la table `reminder_settings`. */
export interface ReminderSettingsRow {
  invoice_reminders_enabled?: boolean | null
  before_due_days?: number | null
  after_due_days?: number[] | null
  quote_followup_enabled?: boolean | null
  quote_followup_days?: number | null
  quote_followup_max?: number | null
}

const oneOf = <T extends number>(choices: readonly T[], value: unknown): value is T =>
  typeof value === "number" && (choices as readonly number[]).includes(value)

const sortedDays = (values: number[]) => Array.from(new Set(values)).sort((a, b) => a - b)

/** Réglages d'une ligne (absente : valeurs par défaut). Toute valeur hors liste est ignorée. */
export function settingsFromRow(row: ReminderSettingsRow | null | undefined): ReminderSettings {
  if (!row) return { ...DEFAULT_REMINDER_SETTINGS, afterDueDays: [...DEFAULT_REMINDER_SETTINGS.afterDueDays] }
  const d = DEFAULT_REMINDER_SETTINGS
  return {
    invoiceRemindersEnabled: typeof row.invoice_reminders_enabled === "boolean" ? row.invoice_reminders_enabled : d.invoiceRemindersEnabled,
    beforeDueDays: oneOf(BEFORE_DUE_CHOICES, row.before_due_days) ? row.before_due_days : null,
    afterDueDays: Array.isArray(row.after_due_days)
      ? sortedDays(row.after_due_days.filter((n) => oneOf(AFTER_DUE_CHOICES, n)))
      : [...d.afterDueDays],
    quoteFollowupEnabled: typeof row.quote_followup_enabled === "boolean" ? row.quote_followup_enabled : d.quoteFollowupEnabled,
    quoteFollowupDays: oneOf(QUOTE_FOLLOWUP_DAY_CHOICES, row.quote_followup_days) ? row.quote_followup_days : d.quoteFollowupDays,
    quoteFollowupMax: oneOf(QUOTE_FOLLOWUP_MAX_CHOICES, row.quote_followup_max) ? row.quote_followup_max : d.quoteFollowupMax,
  }
}

/** Réglages → colonnes de la table. */
export function settingsToRow(s: ReminderSettings): Required<ReminderSettingsRow> {
  return {
    invoice_reminders_enabled: s.invoiceRemindersEnabled,
    before_due_days: s.beforeDueDays,
    after_due_days: sortedDays(s.afterDueDays),
    quote_followup_enabled: s.quoteFollowupEnabled,
    quote_followup_days: s.quoteFollowupDays,
    quote_followup_max: s.quoteFollowupMax,
  }
}

/**
 * Valide une saisie (corps de PUT /api/reminder-settings). Refuse toute valeur
 * hors des listes proposées plutôt que de la corriger en silence.
 */
export function parseReminderSettingsInput(body: unknown): { settings: ReminderSettings } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Réglages illisibles." }
  const b = body as Record<string, unknown>

  if (typeof b.invoiceRemindersEnabled !== "boolean") return { error: "Activation des relances de factures manquante." }
  if (b.beforeDueDays !== null && !oneOf(BEFORE_DUE_CHOICES, b.beforeDueDays)) {
    return { error: "Rappel avant échéance : choisissez 1, 3, 5 ou 7 jours." }
  }
  if (!Array.isArray(b.afterDueDays) || !b.afterDueDays.every((n) => oneOf(AFTER_DUE_CHOICES, n))) {
    return { error: "Relances après échéance : choisissez parmi 7, 15, 30 et 45 jours." }
  }
  if (typeof b.quoteFollowupEnabled !== "boolean") return { error: "Activation des relances de devis manquante." }
  if (!oneOf(QUOTE_FOLLOWUP_DAY_CHOICES, b.quoteFollowupDays)) {
    return { error: "Relance des devis : choisissez 3, 5, 7, 10 ou 15 jours." }
  }
  if (!oneOf(QUOTE_FOLLOWUP_MAX_CHOICES, b.quoteFollowupMax)) {
    return { error: "Relance des devis : une ou deux fois." }
  }

  return {
    settings: {
      invoiceRemindersEnabled: b.invoiceRemindersEnabled,
      beforeDueDays: b.beforeDueDays as number | null,
      afterDueDays: sortedDays(b.afterDueDays as number[]),
      quoteFollowupEnabled: b.quoteFollowupEnabled,
      quoteFollowupDays: b.quoteFollowupDays as number,
      quoteFollowupMax: b.quoteFollowupMax as number,
    },
  }
}

/** « 30 et 45 jours après l'échéance », pour les textes d'aide. */
export function describeInvoiceSchedule(s: ReminderSettings): string | null {
  if (!s.invoiceRemindersEnabled) return null
  const parts: string[] = []
  if (s.beforeDueDays) parts.push(`${s.beforeDueDays} jour${s.beforeDueDays > 1 ? "s" : ""} avant l'échéance`)
  if (s.afterDueDays.length) {
    const days = s.afterDueDays.map(String)
    const list = days.length > 1 ? `${days.slice(0, -1).join(", ")} et ${days[days.length - 1]}` : days[0]
    parts.push(`${list} jours après l'échéance`)
  }
  return parts.length ? parts.join(", puis ") : null
}
