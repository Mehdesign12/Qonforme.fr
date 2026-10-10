/**
 * Factures ouvertes fictives de la démo (Trésorerie, Relances).
 * Les échéances sont calculées à partir du jour où la démo est ouverte, pour
 * qu'elle montre toujours des retards et des échéances à venir réalistes.
 */
import { addDays } from "@/lib/treasury/forecast"

export interface DemoOpenInvoice {
  id:                 string
  invoice_number:     string
  client_name:        string
  client_email:       string
  due_date:           string
  total_ttc:          number
  credited_ttc:       number
  status:             string
  reminder_1_sent_at: string | null
  reminder_2_sent_at: string | null
}

/** [id, numéro, client, email, échéance (jours depuis aujourd'hui), TTC, avoirs, statut, relance 1 (jours), relance 2 (jours)] */
const ROWS: [string, string, string, string, number, number, number, string, number | null, number | null][] = [
  ["3",  "F-2026-010", "Électricité Dupont", "compta@electricite-dupont.fr", -52, 1650, 0,   "overdue", -22, -7],
  ["8",  "F-2026-004", "Renovbat SARL",      "factures@renovbat.fr",         -37, 720,  0,   "overdue", -7,  null],
  ["9",  "F-2026-013", "Toiture Martin",     "contact@toiture-martin.fr",    -12, 1880, 0,   "sent",    null, null],
  ["1",  "F-2026-012", "Renovbat SARL",      "factures@renovbat.fr",         3,   2400, 0,   "sent",    null, null],
  ["4",  "F-2026-009", "Maçonnerie Bernard", "admin@maconnerie-bernard.fr",  9,   3200, 400, "accepted", null, null],
  ["10", "F-2026-014", "Peinture Leblanc",   "p.leblanc@peinture-leblanc.fr", 16, 960,  0,   "sent",    null, null],
  ["11", "F-2026-015", "Martin Plomberie",   "martin.plomberie@orange.fr",   24,  1340, 0,   "sent",    null, null],
  ["12", "F-2026-016", "Toiture Martin",     "contact@toiture-martin.fr",    41,  4200, 0,   "sent",    null, null],
  ["13", "F-2026-017", "Électricité Dupont", "compta@electricite-dupont.fr", 67,  2750, 0,   "sent",    null, null],
]

export function demoOpenInvoices(today: string): DemoOpenInvoice[] {
  const at = (n: number | null) => (n === null ? null : `${addDays(today, n)}T09:00:00.000Z`)
  return ROWS.map(([id, num, client, email, due, ttc, credited, status, r1, r2]) => ({
    id,
    invoice_number:     num,
    client_name:        client,
    client_email:       email,
    due_date:           addDays(today, due),
    total_ttc:          ttc,
    credited_ttc:       credited,
    status,
    reminder_1_sent_at: at(r1),
    reminder_2_sent_at: at(r2),
  }))
}
