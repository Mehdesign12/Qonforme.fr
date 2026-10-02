/**
 * Tableau de bord de la démo : mêmes calculs que la page réelle
 * (buildDashboardView), alimentés par les données fictives communes
 * de lib/demo/data.ts au lieu de Supabase.
 */
import {
  DEMO_CLIENTS, DEMO_COMPANY, DEMO_INVOICES, DEMO_MONTHLY_PAID, DEMO_QUOTES, DEMO_TODAY,
  type DemoInvoice,
} from "@/lib/demo/data"
import {
  ISSUED_INVOICE_STATUSES, OPEN_INVOICE_STATUSES, buildDashboardView,
  type DashInvoice, type DashboardView,
} from "@/components/dashboard/model"

/**
 * Historique mensuel de la démo. La page réelle montre le montant facturé par
 * mois (la date de paiement n'est pas enregistrée), la démo affiche donc les
 * montants mensuels de DEMO_MONTHLY_PAID sous ce même libellé. Nombre de
 * factures par mois : complément local, fictif comme le reste.
 */
const DEMO_MONTHLY_COUNTS: Record<string, number> = {
  "2026-04": 7, "2026-05": 9, "2026-06": 8, "2026-07": 11, "2026-08": 6, "2026-09": 10,
}

function toDash(inv: DemoInvoice): DashInvoice {
  return {
    id: inv.id,
    invoice_number: inv.invoice_number,
    status: inv.status,
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    total_ttc: inv.total_ttc,
    client_name: inv.client.name,
    client_city: inv.client.city,
    client_email: inv.client.email,
    reminder_1_sent_at: null,
    reminder_2_sent_at: null,
  }
}

const has = (list: readonly string[], status: string) => list.includes(status)

export function buildDemoDashboardView(): DashboardView {
  return buildDashboardView({
    mode: "demo",
    today: DEMO_TODAY,
    firstName: DEMO_COMPANY.owner.split(" ")[0],
    company: {
      name: DEMO_COMPANY.name,
      siren: DEMO_COMPANY.siren,
      address: DEMO_COMPANY.address,
      zip_code: DEMO_COMPANY.zip_code,
      city: DEMO_COMPANY.city,
    },
    counts: { invoices: DEMO_INVOICES.length, quotes: DEMO_QUOTES.length },
    issued: DEMO_INVOICES.filter((i) => has(ISSUED_INVOICE_STATUSES, i.status)),
    monthlyHistory: DEMO_MONTHLY_PAID.map((m) => ({ month: m.month, value: m.value, count: DEMO_MONTHLY_COUNTS[m.month] })),
    open: DEMO_INVOICES.filter((i) => has(OPEN_INVOICE_STATUSES, i.status)).map(toDash),
    paid: DEMO_INVOICES.filter((i) => i.status === "paid").map((i) => ({
      total_ttc: i.total_ttc, client_id: i.client_id, client_name: i.client.name,
    })),
    drafts: DEMO_INVOICES.filter((i) => i.status === "draft").map(toDash),
    recent: DEMO_INVOICES.slice(0, 5).map(toDash),
    quotes: DEMO_QUOTES
      .filter((q) => (q.status === "sent" || q.status === "accepted") && !q.converted_invoice_number)
      .map((q) => ({
        id: q.id, quote_number: q.quote_number, status: q.status, valid_until: q.valid_until,
        total_ttc: q.total_ttc, client_name: q.client.name,
      })),
    clientsWithoutSiren: DEMO_CLIENTS.filter((c) => !c.siren).length,
  })
}
