/**
 * Planning des relances (lib/reminders/schedule.ts), dates en heure de Paris
 * (lib/utils/paris-date.ts) et réglages (lib/reminders/settings.ts).
 *
 * La simulation rejoue le cron jour après jour avec un journal qui refuse une
 * étape déjà réservée (comme l'index unique de `document_reminders`) : chaque
 * relance part une fois, au bon jour, jamais deux fois.
 */
import { describe, expect, it } from "vitest"
import { addDays, daysBetween, parisDayOf, todayInParis } from "@/lib/utils/paris-date"
import {
  MIN_GAP_DAYS, planInvoiceReminder, planQuoteFollowup, type InvoiceForPlanning, type ReminderLogEntry,
} from "@/lib/reminders/schedule"
import {
  DEFAULT_REMINDER_SETTINGS, describeInvoiceSchedule, parseReminderSettingsInput, settingsFromRow, type ReminderSettings,
} from "@/lib/reminders/settings"

const settings = (patch: Partial<ReminderSettings> = {}): ReminderSettings => ({ ...DEFAULT_REMINDER_SETTINGS, ...patch })

/* ------------------------------------------------------------------ */
/* Heure de Paris                                                      */
/* ------------------------------------------------------------------ */

describe("todayInParis", () => {
  it("passe au lendemain à minuit à Paris, pas à minuit UTC (heure d'été)", () => {
    // 22 h 30 UTC le 30 septembre = 0 h 30 le 1er octobre à Paris (UTC+2)
    expect(todayInParis(new Date("2026-09-30T22:30:00Z"))).toBe("2026-10-01")
    expect(todayInParis(new Date("2026-09-30T21:59:00Z"))).toBe("2026-09-30")
  })
  it("en hiver, Paris est à UTC+1", () => {
    expect(todayInParis(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01")
    expect(todayInParis(new Date("2026-12-31T22:30:00Z"))).toBe("2026-12-31")
  })
  it("compte les jours sans dérive au changement d'heure", () => {
    expect(daysBetween("2026-10-20", "2026-10-30")).toBe(10) // passage à l'heure d'hiver le 25 octobre
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30")
    expect(parisDayOf("2026-09-30T22:30:00Z")).toBe("2026-10-01")
    expect(parisDayOf("2026-09-30")).toBe("2026-09-30")
  })
})

/* ------------------------------------------------------------------ */
/* Factures                                                            */
/* ------------------------------------------------------------------ */

const invoice = (patch: Partial<InvoiceForPlanning> = {}): InvoiceForPlanning => ({
  status: "sent", issue_date: "2026-09-01", due_date: "2026-10-01", sent_at: "2026-09-01T08:00:00Z", ...patch,
})

/** Rejoue le cron chaque jour de `from` à `to` ; renvoie les relances envoyées. */
function simulate(inv: InvoiceForPlanning, s: ReminderSettings, from: string, to: string, initialLog: ReminderLogEntry[] = []) {
  const log = [...initialLog]
  const sent: { day: string; stage: string; number: number }[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) {
    // Deux passages le même jour : le second ne doit rien envoyer
    for (let pass = 0; pass < 2; pass++) {
      const plan = planInvoiceReminder({ invoice: inv, settings: s, today: day, log })
      if (!plan) continue
      const taken = log.some((e) => e.origin !== "manual" && e.stage === plan.stage) // index unique du journal
      if (taken) continue
      log.push({ stage: plan.stage, origin: "auto", sent_at: `${day}T07:00:00Z` })
      sent.push({ day, stage: plan.stage, number: plan.reminderNumber })
    }
  }
  return sent
}

describe("planInvoiceReminder", () => {
  it("par défaut : J+30 puis J+45, comme avant les réglages", () => {
    const sent = simulate(invoice(), settings(), "2026-09-01", "2026-12-31")
    expect(sent).toEqual([
      { day: "2026-10-31", stage: "after_30", number: 1 },
      { day: "2026-11-15", stage: "after_45", number: 2 },
    ])
  })

  it("chaque étape réglée part une fois, au bon jour", () => {
    const sent = simulate(invoice(), settings({ beforeDueDays: 3, afterDueDays: [7, 15, 30, 45] }), "2026-09-01", "2026-12-31")
    expect(sent.map((s) => `${s.day} ${s.stage}`)).toEqual([
      "2026-09-28 before_3",
      "2026-10-08 after_7",
      "2026-10-16 after_15",
      "2026-10-31 after_30",
      "2026-11-15 after_45",
    ])
    expect(new Set(sent.map((s) => s.stage)).size).toBe(sent.length)
  })

  it("ne rattrape pas les étapes manquées : seule la plus avancée part", () => {
    // Cron arrêté jusqu'au 20 octobre (J+19) : J+7 et J+15 sont dépassées
    const plan = planInvoiceReminder({ invoice: invoice(), settings: settings({ afterDueDays: [7, 15, 30] }), today: "2026-10-20", log: [] })
    expect(plan).toMatchObject({ stage: "after_15", daysLate: 19, kind: "after_due", isLast: false })
    const sent = simulate(invoice(), settings({ afterDueDays: [7, 15, 30] }), "2026-10-20", "2026-11-30")
    expect(sent.map((s) => s.stage)).toEqual(["after_15", "after_30"])
  })

  it("le rappel avant échéance ne part plus une fois la facture échue", () => {
    const s = settings({ beforeDueDays: 3, afterDueDays: [30] })
    expect(planInvoiceReminder({ invoice: invoice(), settings: s, today: "2026-10-01", log: [] })?.stage).toBe("before_3")
    expect(planInvoiceReminder({ invoice: invoice(), settings: s, today: "2026-10-02", log: [] })).toBeNull()
  })

  it("pas de rappel avant échéance juste après l'envoi de la facture", () => {
    // Envoyée le 29 septembre, échéance le 1er octobre : le rappel J-3 (28 sept.) serait antérieur à l'envoi
    const inv = invoice({ issue_date: "2026-09-29", sent_at: "2026-09-29T10:00:00Z" })
    const sent = simulate(inv, settings({ beforeDueDays: 3, afterDueDays: [] }), "2026-09-29", "2026-10-15")
    expect(sent).toEqual([])
  })

  it("compte le retard sur l'échéance, que la facture soit marquée « En retard » ou non", () => {
    const s = settings({ afterDueDays: [7] })
    const asSent = planInvoiceReminder({ invoice: invoice(), settings: s, today: "2026-10-08", log: [] })
    const asOverdue = planInvoiceReminder({ invoice: invoice({ status: "overdue" }), settings: s, today: "2026-10-08", log: [] })
    expect(asSent).toMatchObject({ stage: "after_7", daysLate: 7 })
    expect(asOverdue).toEqual(asSent)
  })

  it("ne relance jamais un brouillon, une facture payée, créditée, annulée ou rejetée", () => {
    for (const status of ["draft", "paid", "credited", "cancelled", "rejected"]) {
      expect(planInvoiceReminder({ invoice: invoice({ status }), settings: settings(), today: "2026-11-30", log: [] })).toBeNull()
    }
    for (const status of ["sent", "pending", "received", "accepted", "overdue"]) {
      expect(planInvoiceReminder({ invoice: invoice({ status }), settings: settings(), today: "2026-11-30", log: [] })).not.toBeNull()
    }
  })

  it("relances désactivées : rien ne part", () => {
    expect(simulate(invoice(), settings({ invoiceRemindersEnabled: false }), "2026-09-01", "2026-12-31")).toEqual([])
    expect(simulate(invoice(), settings({ afterDueDays: [] }), "2026-09-01", "2026-12-31")).toEqual([])
  })

  it(`laisse ${MIN_GAP_DAYS} jours après une relance manuelle`, () => {
    const manual: ReminderLogEntry[] = [{ stage: "manual", origin: "manual", sent_at: "2026-10-07T15:00:00Z" }]
    const s = settings({ afterDueDays: [7] })
    expect(planInvoiceReminder({ invoice: invoice(), settings: s, today: "2026-10-08", log: manual })).toBeNull()
    expect(planInvoiceReminder({ invoice: invoice(), settings: s, today: "2026-10-10", log: manual })).toMatchObject({ stage: "after_7", reminderNumber: 2 })
  })

  it("les relances de l'ancien cron (reprises en J+30 et J+45) ne repartent pas", () => {
    const legacy: ReminderLogEntry[] = [{ stage: "after_30", origin: "legacy", sent_at: "2026-10-31T07:00:00Z" }]
    // J+7 et J+15 ajoutés après coup : déjà dépassés par la relance J+30
    const sent = simulate(invoice(), settings({ afterDueDays: [7, 15, 30, 45] }), "2026-11-01", "2026-12-31", legacy)
    expect(sent).toEqual([{ day: "2026-11-15", stage: "after_45", number: 2 }])
  })

  it("marque la dernière étape programmée", () => {
    const s = settings({ afterDueDays: [7, 15] })
    expect(planInvoiceReminder({ invoice: invoice(), settings: s, today: "2026-10-08", log: [] })?.isLast).toBe(false)
    expect(planInvoiceReminder({ invoice: invoice(), settings: s, today: "2026-10-16", log: [{ stage: "after_7", origin: "auto", sent_at: "2026-10-08T07:00:00Z" }] })?.isLast).toBe(true)
  })
})

/* ------------------------------------------------------------------ */
/* Devis                                                               */
/* ------------------------------------------------------------------ */

describe("planQuoteFollowup", () => {
  const quote = { status: "sent", issue_date: "2026-09-10", valid_until: "2026-10-10", sent_at: "2026-09-10T09:00:00Z", converted_invoice_id: null }
  const on = settings({ quoteFollowupEnabled: true, quoteFollowupDays: 7, quoteFollowupMax: 1 })

  function simulateQuote(q: typeof quote, s: ReminderSettings, from: string, to: string) {
    const log: ReminderLogEntry[] = []
    const sent: string[] = []
    for (let day = from; day <= to; day = addDays(day, 1)) {
      for (let pass = 0; pass < 2; pass++) {
        const plan = planQuoteFollowup({ quote: q, settings: s, today: day, log })
        if (!plan || log.some((e) => e.stage === plan.stage)) continue
        log.push({ stage: plan.stage, origin: "auto", sent_at: `${day}T07:00:00Z` })
        sent.push(`${day} ${plan.stage}`)
      }
    }
    return sent
  }

  it("désactivée par défaut : aucun email aux clients sans l'accord de l'artisan", () => {
    expect(DEFAULT_REMINDER_SETTINGS.quoteFollowupEnabled).toBe(false)
    expect(simulateQuote(quote, settings(), "2026-09-10", "2026-10-31")).toEqual([])
  })

  it("une seule fois par défaut, N jours après l'envoi", () => {
    expect(simulateQuote(quote, on, "2026-09-10", "2026-10-31")).toEqual(["2026-09-17 quote_1"])
  })

  it("deux fois au plus, espacées de N jours", () => {
    expect(simulateQuote(quote, { ...on, quoteFollowupMax: 2 }, "2026-09-10", "2026-10-31")).toEqual(["2026-09-17 quote_1", "2026-09-24 quote_2"])
  })

  it("jamais après la date de validité", () => {
    const late = { ...quote, valid_until: "2026-09-15" }
    expect(simulateQuote(late, on, "2026-09-10", "2026-10-31")).toEqual([])
    // Validité qui tombe entre les deux relances : la seconde ne part pas
    expect(simulateQuote({ ...quote, valid_until: "2026-09-20" }, { ...on, quoteFollowupMax: 2 }, "2026-09-10", "2026-10-31")).toEqual(["2026-09-17 quote_1"])
  })

  it("jamais pour un devis accepté, refusé, brouillon ou déjà facturé", () => {
    for (const q of [{ ...quote, status: "accepted" }, { ...quote, status: "rejected" }, { ...quote, status: "draft" }, { ...quote, converted_invoice_id: "inv-1" }]) {
      expect(planQuoteFollowup({ quote: q as typeof quote, settings: on, today: "2026-09-20", log: [] })).toBeNull()
    }
  })

  it("sans date d'envoi (marqué envoyé à la main), part de la date du devis", () => {
    expect(planQuoteFollowup({ quote: { ...quote, sent_at: null }, settings: on, today: "2026-09-17", log: [] })).toMatchObject({ stage: "quote_1", daysSinceSent: 7 })
  })
})

/* ------------------------------------------------------------------ */
/* Réglages                                                            */
/* ------------------------------------------------------------------ */

describe("réglages des relances", () => {
  it("sans ligne en base : J+30 et J+45, rien d'autre", () => {
    expect(settingsFromRow(null)).toEqual(DEFAULT_REMINDER_SETTINGS)
    expect(describeInvoiceSchedule(settingsFromRow(null))).toBe("30 et 45 jours après l'échéance")
  })
  it("ignore une valeur hors des choix proposés", () => {
    const s = settingsFromRow({ before_due_days: 2, after_due_days: [45, 7, 8, 7], quote_followup_days: 9, quote_followup_max: 5 })
    expect(s.beforeDueDays).toBeNull()
    expect(s.afterDueDays).toEqual([7, 45])
    expect(s.quoteFollowupDays).toBe(7)
    expect(s.quoteFollowupMax).toBe(1)
  })
  it("valide une saisie et refuse les valeurs inconnues", () => {
    const ok = { invoiceRemindersEnabled: true, beforeDueDays: 3, afterDueDays: [30, 7], quoteFollowupEnabled: true, quoteFollowupDays: 10, quoteFollowupMax: 2 }
    expect(parseReminderSettingsInput(ok)).toEqual({ settings: { ...ok, afterDueDays: [7, 30] } })
    expect("error" in parseReminderSettingsInput({ ...ok, afterDueDays: [60] })).toBe(true)
    expect("error" in parseReminderSettingsInput({ ...ok, beforeDueDays: 2 })).toBe(true)
    expect("error" in parseReminderSettingsInput({ ...ok, quoteFollowupMax: 3 })).toBe(true)
    expect("error" in parseReminderSettingsInput(null)).toBe(true)
  })
})
