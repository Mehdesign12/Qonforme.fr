export const dynamic = "force-dynamic"

import { formatCurrency } from "@/lib/utils/invoice"

const UNIT_LABELS: Record<string, string> = {
  hour:    "Heure",
  day:     "Jour",
  forfait: "Forfait",
  piece:   "Pièce",
  month:   "Mois",
  km:      "km",
}

const MOCK_PRODUCTS = [
  { id: "1", name: "Intervention technique",      description: "Prestation sur site ou à distance", unit_price_ht: 85,   vat_rate: 20, unit: "hour",    reference: "INT-001", active: true  },
  { id: "2", name: "Forfait maintenance mensuel", description: "Contrat de maintenance préventive",  unit_price_ht: 350,  vat_rate: 20, unit: "forfait", reference: "MAI-001", active: true  },
  { id: "3", name: "Fournitures électriques",     description: "Matériel et consommables",           unit_price_ht: 45,   vat_rate: 20, unit: "piece",   reference: "FOU-001", active: true  },
  { id: "4", name: "Déplacement",                 description: "Frais kilométriques",                unit_price_ht: 0.63, vat_rate: 20, unit: "km",      reference: "DEP-001", active: true  },
  { id: "5", name: "Audit énergétique",           description: "Diagnostic complet installation",    unit_price_ht: 750,  vat_rate: 20, unit: "day",     reference: "AUD-001", active: true  },
  { id: "6", name: "Câblage réseau",              description: "Installation et configuration",       unit_price_ht: 65,   vat_rate: 20, unit: "hour",    reference: "CAB-001", active: false },
]

export default function DemoProductsPage() {
  return (
    <div className="space-y-5 animate-fade-in">

      {/* Vue mobile : cards */}
      <div className="sm:hidden space-y-3">
        {MOCK_PRODUCTS.map((p) => (
          <div key={p.id} className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] px-4 py-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0]">{p.name}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                p.active ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#F1F5F9] text-[#475569]"
              }`}>
                {p.active ? "Actif" : "Inactif"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-2">{p.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">{UNIT_LABELS[p.unit] ?? p.unit} · TVA {p.vat_rate}%</span>
              <span className="font-mono text-sm font-bold text-[#0F172A] dark:text-[#E2E8F0]">{formatCurrency(p.unit_price_ht)} HT</span>
            </div>
          </div>
        ))}
      </div>

      {/* Vue desktop : table */}
      <div className="hidden sm:block bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#162032]">
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Désignation</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3 hidden md:table-cell">Référence</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Unité</th>
              <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Prix HT</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">TVA</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_PRODUCTS.map((p) => (
              <tr key={p.id} className="border-b border-[#F1F5F9] dark:border-[#162032] hover:bg-[#F8FAFC] dark:hover:bg-[#162032] transition-colors last:border-0">
                <td className="px-5 py-4">
                  <p className="text-sm font-medium text-[#0F172A] dark:text-[#E2E8F0]">{p.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{p.description}</p>
                </td>
                <td className="px-5 py-4 hidden md:table-cell font-mono text-xs text-slate-500 dark:text-slate-400">{p.reference}</td>
                <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">{UNIT_LABELS[p.unit] ?? p.unit}</td>
                <td className="px-5 py-4 text-right font-mono text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0]">
                  {formatCurrency(p.unit_price_ht)}
                </td>
                <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">{p.vat_rate} %</td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    p.active ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#F1F5F9] text-[#475569]"
                  }`}>
                    {p.active ? "Actif" : "Inactif"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
