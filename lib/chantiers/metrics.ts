/**
 * Chiffres d'un chantier : marché, facturé, reste à facturer, avancement,
 * retenue de garantie. Logique pure, partagée par les pages réelles et la démo,
 * testée dans __tests__/chantiers-metrics.test.ts.
 */

export type ChantierStatus = "todo" | "active" | "done" | "archived"

export const CHANTIER_STATUS_LABELS: Record<ChantierStatus, string> = {
  todo:     "À démarrer",
  active:   "En cours",
  done:     "Terminé",
  archived: "Archivé",
}

export interface ChantierLot {
  label:     string
  amount_ht: number
}

export interface ChantierDoc {
  id:          string
  number:      string
  status:      string
  issue_date:  string
  subtotal_ht: number
  total_ttc:   number
}

export interface Chantier {
  id:               string
  name:             string
  client_id:        string | null
  client_name:      string | null
  address:          string | null
  start_date:       string | null
  end_date:         string | null
  status:           ChantierStatus
  lots:             ChantierLot[]
  retenue_garantie: boolean
  retenue_rate:     number
  autoliquidation:  boolean
  notes:            string | null
  quotes:           ChantierDoc[]
  invoices:         ChantierDoc[]
}

export interface ChantierMetrics {
  /** Marché HT : total des lots, sinon des devis acceptés */
  marketHt:    number
  /** D'où vient le marché */
  marketFrom:  "lots" | "quotes" | "none"
  invoicedHt:  number
  invoicedTtc: number
  paidTtc:     number
  remainingHt: number
  /** Avancement de la facturation, 0 à 100 */
  progress:    number
  /** Retenue de garantie sur le TTC facturé (0 si non applicable) */
  retenueTtc:  number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Statuts de facture qui ne comptent pas dans le facturé */
const NOT_INVOICED = ["draft", "cancelled"]

export function chantierMetrics(c: Pick<Chantier, "lots" | "quotes" | "invoices" | "retenue_garantie" | "retenue_rate">): ChantierMetrics {
  const lotsHt = c.lots.reduce((s, l) => s + (Number(l.amount_ht) || 0), 0)
  const quotesHt = c.quotes.filter((q) => q.status === "accepted").reduce((s, q) => s + (q.subtotal_ht || 0), 0)
  const marketHt = lotsHt > 0 ? lotsHt : quotesHt
  const marketFrom = lotsHt > 0 ? "lots" : quotesHt > 0 ? "quotes" : "none"

  const billed = c.invoices.filter((i) => !NOT_INVOICED.includes(i.status))
  const invoicedHt = billed.reduce((s, i) => s + (i.subtotal_ht || 0), 0)
  const invoicedTtc = billed.reduce((s, i) => s + (i.total_ttc || 0), 0)
  const paidTtc = billed.filter((i) => i.status === "paid").reduce((s, i) => s + (i.total_ttc || 0), 0)

  return {
    marketHt:    round2(marketHt),
    marketFrom,
    invoicedHt:  round2(invoicedHt),
    invoicedTtc: round2(invoicedTtc),
    paidTtc:     round2(paidTtc),
    remainingHt: round2(Math.max(0, marketHt - invoicedHt)),
    progress:    marketHt > 0 ? Math.min(100, Math.round((invoicedHt / marketHt) * 100)) : 0,
    retenueTtc:  c.retenue_garantie ? round2((invoicedTtc * (c.retenue_rate || 0)) / 100) : 0,
  }
}

/** Lots saisis dans le formulaire : libellé non vide, montant positif */
export function cleanLots(lots: { label: string; amount_ht: number | string }[]): ChantierLot[] {
  return lots
    .map((l) => ({
      label:     String(l.label || "").trim().slice(0, 200),
      amount_ht: round2(Number(String(l.amount_ht).replace(/\s/g, "").replace(",", ".")) || 0),
    }))
    .filter((l) => l.label && l.amount_ht > 0)
}
