/**
 * Chantiers fictifs de la démo. Les documents reprennent les numéros des
 * factures et devis de démonstration existants.
 */
import type { Chantier } from "@/lib/chantiers/metrics"
import type { AttachableDoc } from "@/components/chantiers/ChantierDetailView"

const doc = (id: string, number: string, status: string, issue_date: string, ht: number) => ({
  id, number, status, issue_date, subtotal_ht: ht, total_ttc: Math.round(ht * 120) / 100,
})

export const DEMO_CHANTIERS: Chantier[] = [
  {
    id: "1", name: "Résidence Les Tilleuls", client_id: "c1", client_name: "Renovbat SARL",
    address: "12 rue des Tilleuls, 44000 Nantes", start_date: "2026-06-15", end_date: "2026-11-30", status: "active",
    lots: [
      { label: "Dépose et préparation des supports", amount_ht: 9500 },
      { label: "Doublages et isolation", amount_ht: 14200 },
      { label: "Cloisons et plafonds", amount_ht: 11800 },
    ],
    retenue_garantie: true, retenue_rate: 5, autoliquidation: false,
    notes: "Accès chantier par la rue arrière. Contact sur place : M. Durand, conducteur de travaux.",
    quotes: [doc("1", "D-2026-012", "accepted", "2026-05-28", 35500)],
    invoices: [
      doc("14", "F-2026-003", "paid", "2026-07-08", 7100),
      doc("15", "F-2026-018", "sent", "2026-09-12", 9940),
    ],
  },
  {
    id: "2", name: "Extension maison individuelle", client_id: "c2", client_name: "Maçonnerie Bernard",
    address: "8 chemin des Vignes, 49400 Saumur", start_date: "2026-09-14", end_date: "2026-10-16", status: "active",
    lots: [], retenue_garantie: false, retenue_rate: 5, autoliquidation: true, notes: null,
    quotes: [doc("2", "D-2026-028", "accepted", "2026-09-01", 6400)],
    invoices: [doc("4", "F-2026-009", "accepted", "2026-09-25", 2666.67)],
  },
  {
    id: "3", name: "Ravalement cage d’escalier", client_id: "c3", client_name: "Toiture Martin",
    address: "3 place du Ralliement, 49100 Angers", start_date: "2026-10-26", end_date: "2026-11-06", status: "todo",
    lots: [{ label: "Échafaudage et protection", amount_ht: 1200 }, { label: "Enduit et peinture", amount_ht: 2830 }],
    retenue_garantie: false, retenue_rate: 5, autoliquidation: false, notes: null,
    quotes: [doc("3", "D-2026-029", "accepted", "2026-10-02", 4030)],
    invoices: [doc("9", "F-2026-013", "sent", "2026-10-03", 1566.67)],
  },
  {
    id: "4", name: "Isolation des combles", client_id: "c4", client_name: "Peinture Leblanc",
    address: "21 rue Saint-Aubin, 49240 Avrillé", start_date: "2026-07-22", end_date: "2026-07-24", status: "done",
    lots: [], retenue_garantie: false, retenue_rate: 5, autoliquidation: false, notes: null,
    quotes: [doc("4", "D-2026-026", "accepted", "2026-07-10", 1750)],
    invoices: [doc("16", "F-2026-002", "paid", "2026-07-25", 1750)],
  },
]

/** Documents du client proposés au rattachement (démo) */
export const DEMO_ATTACHABLE: { quotes: AttachableDoc[]; invoices: AttachableDoc[] } = {
  quotes: [{ id: "5", number: "D-2026-033", status: "sent", issue_date: "2026-09-30", total_ttc: 8424 }],
  invoices: [{ id: "8", number: "F-2026-004", status: "overdue", issue_date: "2026-08-04", total_ttc: 720 }],
}

export const DEMO_CLIENTS = [
  { id: "c1", name: "Renovbat SARL", address: "12 rue des Tilleuls, 44000 Nantes" },
  { id: "c2", name: "Maçonnerie Bernard", address: "8 chemin des Vignes, 49400 Saumur" },
  { id: "c3", name: "Toiture Martin", address: "3 place du Ralliement, 49100 Angers" },
  { id: "c4", name: "Peinture Leblanc", address: "21 rue Saint-Aubin, 49240 Avrillé" },
  { id: "c5", name: "Électricité Dupont", address: "5 rue Lenepveu, 49100 Angers" },
]
