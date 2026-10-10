/**
 * Recherche de la palette ⌘K en mode démo : mêmes résultats qu'en vrai, sur
 * les données fictives (aucun appel réseau).
 */
import { fold, type SearchResults } from "@/lib/search/types"
import { demoOpenInvoices } from "@/lib/demo/open-invoices"
import { isoDay } from "@/lib/treasury/forecast"

const CLIENTS = [
  { id: "1", name: "Renovbat SARL", sub: "Nantes · factures@renovbat.fr" },
  { id: "2", name: "Martin Plomberie", sub: "Angers · martin.plomberie@orange.fr" },
  { id: "3", name: "Électricité Dupont", sub: "Angers · compta@electricite-dupont.fr" },
  { id: "4", name: "Maçonnerie Bernard", sub: "Saumur · admin@maconnerie-bernard.fr" },
  { id: "5", name: "Peinture Leblanc", sub: "Avrillé · p.leblanc@peinture-leblanc.fr" },
  { id: "6", name: "Toiture Martin", sub: "Angers · contact@toiture-martin.fr" },
]

const QUOTES = [
  { id: "1", number: "D-2026-012", client: "Renovbat SARL", amount: 42600, status: "accepted" },
  { id: "2", number: "D-2026-028", client: "Maçonnerie Bernard", amount: 7680, status: "accepted" },
  { id: "3", number: "D-2026-029", client: "Toiture Martin", amount: 4836, status: "sent" },
  { id: "5", number: "D-2026-033", client: "Renovbat SARL", amount: 8424, status: "sent" },
]

export async function demoSearch(q: string): Promise<SearchResults> {
  const t = fold(q)
  const has = (...v: string[]) => v.some((x) => fold(x).includes(t))
  const invoices = demoOpenInvoices(isoDay(new Date())).map((i) => ({ id: i.id, number: i.invoice_number, client: i.client_name, amount: i.total_ttc, status: i.status }))
  return {
    clients: CLIENTS.filter((c) => has(c.name)).slice(0, 6),
    invoices: invoices.filter((i) => has(i.number, i.client)).slice(0, 6),
    quotes: QUOTES.filter((d) => has(d.number, d.client)).slice(0, 6),
  }
}
