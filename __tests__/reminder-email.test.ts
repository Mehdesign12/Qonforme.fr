/**
 * Emails de relance (lib/email/templates/reminder.ts, quote-followup.ts) et
 * comptage des factures relancées au tableau de bord (bug « overdue »).
 */
import { describe, expect, it } from "vitest"
import { buildReminderEmail, type ReminderEmailData } from "@/lib/email/templates/reminder"
import { buildQuoteFollowupEmail } from "@/lib/email/templates/quote-followup"
import { TAUX_PENALITES_DEFAUT } from "@/lib/outils/penalites"
import { buildDashboardView, type DashInvoice, type DashboardInput } from "@/components/dashboard/model"

const base: ReminderEmailData = {
  reminderNumber: 1,
  kind: "after_due",
  daysLate: 7,
  invoiceNumber: "F-2026-012",
  issueDate: "2026-09-01",
  dueDate: "2026-10-01",
  subtotalHt: 1000,
  totalVat: 200,
  totalTtc: 1200,
  companyName: "Garnier Plâtrerie",
  companyIban: "FR76 0000",
  accentColor: "#2563EB",
  clientName: "Bâti Ouest SAS",
}

describe("buildReminderEmail", () => {
  it("rappelle pénalités et indemnité de 40 € à un client professionnel, au taux de lib/outils/penalites.ts", () => {
    const { html } = buildReminderEmail({ ...base, clientIsProfessional: true })
    const rate = TAUX_PENALITES_DEFAUT.toLocaleString("fr-FR", { minimumFractionDigits: 2 })
    expect(html).toContain(`${rate} %`)
    expect(html).toContain("40 €")
    expect(html).toContain("L441-10")
    expect(html).toContain("D441-5")
  })

  it("n'en parle pas à un particulier (règles entre professionnels)", () => {
    const { html } = buildReminderEmail({ ...base, clientIsProfessional: false })
    expect(html).not.toContain("indemnité forfaitaire")
  })

  it("ni dans un rappel avant l'échéance", () => {
    const { subject, html } = buildReminderEmail({ ...base, kind: "before_due", daysLate: 0, clientIsProfessional: true })
    expect(subject).toMatch(/^Rappel — Facture F-2026-012/)
    expect(html).not.toContain("indemnité forfaitaire")
    expect(html).toContain("arrive à échéance")
  })

  it("affiche « Régler la facture » seulement avec un lien de paiement", () => {
    expect(buildReminderEmail(base).html).not.toContain("Régler la facture")
    const { html } = buildReminderEmail({ ...base, paymentUrl: "https://qonforme.fr/regler/abc?x=1&y=\"2\"" })
    expect(html).toContain("Régler la facture")
    expect(html).toContain('href="https://qonforme.fr/regler/abc?x=1&amp;y=&quot;2&quot;"')
  })

  it("vouvoie, sans menace de recouvrement", () => {
    for (const d of [base, { ...base, reminderNumber: 3, isLast: true }]) {
      const { html } = buildReminderEmail(d)
      expect(html).not.toMatch(/\b(tu|ton|ta|tes)\b/i)
      expect(html).not.toMatch(/recouvrement judiciaire|contentieux|huissier|procédure de recouvrement/i)
      expect(html).toContain("vous")
    }
  })

  it("dernière relance : ton plus net, seulement à partir de la deuxième", () => {
    expect(buildReminderEmail({ ...base, reminderNumber: 1, isLast: true }).subject).toMatch(/^Relance —/)
    expect(buildReminderEmail({ ...base, reminderNumber: 2, isLast: true }).subject).toMatch(/^Dernière relance —/)
    expect(buildReminderEmail({ ...base, reminderNumber: 2, isLast: false }).subject).toMatch(/^Relance —/)
  })

  it("échappe le nom de l'entreprise", () => {
    const { html } = buildReminderEmail({ ...base, companyName: "Dupont <script>" })
    expect(html).not.toContain("<script>")
  })
})

describe("buildQuoteFollowupEmail", () => {
  const quote = {
    quoteNumber: "D-2026-031", issueDate: "2026-09-04", validUntil: "2026-10-04", sentDate: "2026-09-04",
    subtotalHt: 1000, totalVat: 200, totalTtc: 1200, companyName: "Garnier Plâtrerie", accentColor: "#2563EB",
    clientName: "M. Morel", followupNumber: 1, hasAttachment: true,
  }
  it("rappelle le devis et sa validité, avec un bouton seulement si un lien est fourni", () => {
    const plain = buildQuoteFollowupEmail(quote)
    expect(plain.html).toContain("D-2026-031")
    expect(plain.html).toContain("valable jusqu'au")
    expect(plain.html).toContain("pièce jointe")
    expect(plain.html).not.toContain("Consulter le devis")
    expect(buildQuoteFollowupEmail({ ...quote, quoteUrl: "https://qonforme.fr/d/xyz" }).html).toContain("Consulter le devis")
    expect(buildQuoteFollowupEmail({ ...quote, hasAttachment: false }).html).not.toContain("pièce jointe")
  })
})

/* ------------------------------------------------------------------ */
/* Bug « overdue » : une facture relancée reste à encaisser et en retard */
/* ------------------------------------------------------------------ */

describe("tableau de bord : factures relancées", () => {
  const inv = (id: string, status: string, due: string, total: number): DashInvoice => ({
    id, invoice_number: `F-2026-${id}`, status, issue_date: "2026-08-01", due_date: due, total_ttc: total,
    client_name: "Client", client_city: null, client_email: "c@example.com",
  })
  const input = (open: DashInvoice[]): DashboardInput => ({
    mode: "app", today: "2026-10-03", firstName: "", company: null, counts: { invoices: open.length, quotes: 0 },
    issued: [], open, paid: [], drafts: [], recent: [], quotes: [], clientsWithoutSiren: null,
  })

  it("compte une facture « overdue » dans le montant à encaisser et dans le retard", () => {
    const view = buildDashboardView(input([
      inv("001", "overdue", "2026-09-01", 500),  // relancée par l'ancien cron
      inv("002", "sent", "2026-09-15", 300),     // échue, jamais relancée
      inv("003", "accepted", "2026-10-20", 200), // pas encore échue
    ]))
    expect(view.kpi.open).toEqual({ amount: 1000, count: 3 })
    expect(view.kpi.late).toMatchObject({ amount: 800, count: 2, oldestDays: 32 })
  })

  it("calcule le retard sur l'échéance à l'heure de Paris : échue aujourd'hui n'est pas en retard", () => {
    const view = buildDashboardView(input([inv("004", "sent", "2026-10-03", 100)]))
    expect(view.kpi.late.count).toBe(0)
    expect(view.kpi.dueSoon.count).toBe(1)
  })

  it("affiche « Brouillon » pour une facture pas encore émise", () => {
    const view = buildDashboardView({ ...input([]), recent: [{ ...inv("x", "draft", "2026-10-30", 90), invoice_number: null }] })
    expect(view.recent[0].number).toBe("Brouillon")
  })
})
