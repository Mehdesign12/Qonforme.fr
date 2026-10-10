/**
 * File des relances (lib/reminders/queue.ts) : elle rejoue le planificateur du
 * cron jour par jour, donc annonce exactement les relances qui partiront.
 */
import { describe, expect, it } from "vitest"
import { buildReminderQueue, legacyLog, stageLabel, type QueueInvoice, type QueueQuote } from "@/lib/reminders/queue"
import { DEFAULT_REMINDER_SETTINGS, type ReminderSettings } from "@/lib/reminders/settings"

const settings: ReminderSettings = {
  invoiceRemindersEnabled: true, beforeDueDays: 3, afterDueDays: [7, 30],
  quoteFollowupEnabled: true, quoteFollowupDays: 7, quoteFollowupMax: 1,
}
const TODAY = "2026-10-10"
const inv = (id: string, due: string, extra: Partial<QueueInvoice> = {}): QueueInvoice => ({
  id, invoice_number: `F-${id}`, status: "sent", issue_date: "2026-09-01", due_date: due, sent_at: "2026-09-01T09:00:00Z",
  total_ttc: 1000, client_name: `Client ${id}`, client_email: `${id}@example.com`, reminders: [], ...extra,
})

describe("libellés", () => {
  it("rappel, relance, devis, manuelle", () => {
    expect(stageLabel("before_3")).toBe("Rappel J−3")
    expect(stageLabel("after_30")).toBe("Relance J+30")
    expect(stageLabel("quote_1")).toBe("Relance du devis")
    expect(stageLabel("quote_2")).toBe("Relance du devis n° 2")
    expect(stageLabel("manual", "manual")).toBe("Relance manuelle")
  })
})

describe("file des relances", () => {
  it("annonce les relances des 14 prochains jours, dans l'ordre, comme le cron", () => {
    const q = buildReminderQueue({
      invoices: [
        inv("A", "2026-10-12"),                                                                  // rappel J−3 dû le 9 : part aujourd'hui (rattrapage)
        inv("B", "2026-10-03", { reminders: [{ stage: "before_3", origin: "auto", sent_at: "2026-09-30T07:00:00Z" }] }), // J+7 le 10
        inv("C", "2026-11-30"),                                                                  // hors fenêtre
        inv("D", "2026-10-15", { status: "paid" }),                                              // réglée
      ],
      quotes: [], settings, today: TODAY,
    })
    expect(q.upcoming.map((e) => [e.number, e.date, e.label])).toEqual([
      ["F-A", "2026-10-10", "Rappel J−3"],
      ["F-B", "2026-10-10", "Relance J+7"],
      ["F-A", "2026-10-19", "Relance J+7"],
    ])
  })

  it("respecte l'écart minimal entre deux relances d'un même document", () => {
    const q = buildReminderQueue({
      invoices: [inv("E", "2026-09-05", { reminders: [{ stage: "manual", origin: "manual", sent_at: "2026-10-09T15:00:00Z" }] })],
      quotes: [], settings, today: TODAY,
    })
    // J+30 atteint le 5 octobre, mais une relance manuelle hier : rien avant le 12
    expect(q.upcoming.map((e) => [e.date, e.label])).toEqual([["2026-10-12", "Relance J+30"]])
  })

  it("factures relancées jusqu'au bout et toujours dues : à traiter à la main", () => {
    const q = buildReminderQueue({
      invoices: [inv("F", "2026-08-01", { status: "overdue", reminders: [
        { stage: "after_7", origin: "auto", sent_at: "2026-08-08T07:00:00Z" },
        { stage: "after_30", origin: "auto", sent_at: "2026-08-31T07:00:00Z" },
      ] })],
      quotes: [], settings, today: TODAY,
    })
    expect(q.upcoming).toEqual([])
    expect(q.exhausted).toMatchObject([{ number: "F-F", daysLate: 70, count: 2 }])
  })

  it("compte les documents sans adresse email, et relance les devis sans réponse", () => {
    const quote: QueueQuote = {
      id: "Q", quote_number: "D-1", status: "sent", issue_date: "2026-10-05", valid_until: "2026-11-05", sent_at: "2026-10-05T09:00:00Z",
      total_ttc: 500, client_name: "M. Q", client_email: null, reminders: [],
    }
    const q = buildReminderQueue({ invoices: [inv("G", "2026-10-12", { client_email: "" })], quotes: [quote], settings, today: TODAY })
    expect(q.upcoming.find((e) => e.type === "quote")).toMatchObject({ date: "2026-10-12", label: "Relance du devis", noEmail: true })
    expect(q.noEmail).toBe(2)
  })

  it("relances désactivées : rien de prévu ; historique des 30 derniers jours", () => {
    const q = buildReminderQueue({
      invoices: [inv("H", "2026-09-01", { reminders: [
        { stage: "after_7", origin: "auto", sent_at: "2026-09-08T07:00:00Z" },
        { stage: "after_30", origin: "auto", sent_at: "2026-10-01T07:00:00Z" },
      ] })],
      quotes: [], settings: { ...settings, invoiceRemindersEnabled: false }, today: TODAY,
    })
    expect(q.upcoming).toEqual([])
    expect(q.sent.map((s) => s.label)).toEqual(["Relance J+30"])
  })

  it("ancien fonctionnement : J+30 et J+45 reconstitués depuis les colonnes de la facture", () => {
    const log = legacyLog({ reminder_1_sent_at: "2026-09-15T08:00:00Z", reminder_2_sent_at: null })
    expect(log).toEqual([{ stage: "after_30", origin: "legacy", sent_at: "2026-09-15T08:00:00Z" }])
    const q = buildReminderQueue({ invoices: [inv("I", "2026-08-16", { reminders: log })], quotes: [], settings: DEFAULT_REMINDER_SETTINGS, today: TODAY })
    expect(q.upcoming.map((e) => [e.date, e.label])).toEqual([["2026-10-10", "Relance J+45"]])
  })
})
