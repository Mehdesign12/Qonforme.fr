export const dynamic = "force-dynamic"

import { formatDate } from "@/lib/utils/invoice"

const MOCK_CREDIT_NOTES = [
  { id: "1", credit_note_number: "AV-2026-003", client: "Renovbat SARL",      issue_date: "2026-03-04", amount_ttc: -1200, original_invoice: "F-2026-009", reason: "Erreur de facturation" },
  { id: "2", credit_note_number: "AV-2026-002", client: "Électricité Dupont", issue_date: "2026-02-18", amount_ttc: -450,  original_invoice: "F-2026-007", reason: "Prestation non réalisée" },
  { id: "3", credit_note_number: "AV-2026-001", client: "Martin Plomberie",   issue_date: "2026-01-25", amount_ttc: -850,  original_invoice: "F-2026-005", reason: "Remise commerciale accordée" },
]

function formatNegativeCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount)
}

export default function DemoCreditNotesPage() {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Bandeau légal */}
      <div className="flex items-start gap-3 bg-[#FFF7ED] border border-[#FED7AA] rounded-xl px-4 py-3.5 text-sm">
        <span className="text-lg leading-none mt-0.5">⚖️</span>
        <p className="text-[#92400E]">
          <strong>Rappel légal :</strong> Un avoir est le seul moyen légal de corriger ou annuler une facture émise.
          Il annule tout ou partie du montant d&apos;une facture existante.
        </p>
      </div>

      {/* Vue mobile : cards */}
      <div className="sm:hidden space-y-3">
        {MOCK_CREDIT_NOTES.map((cn) => (
          <div key={cn.id} className="bg-white rounded-xl border border-[#E2E8F0] px-4 py-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-sm text-[#F97316] font-bold">{cn.credit_note_number}</span>
              <span className="font-mono text-sm font-bold text-[#EF4444]">{formatNegativeCurrency(cn.amount_ttc)}</span>
            </div>
            <p className="text-sm font-medium text-[#0F172A]">{cn.client}</p>
            <p className="text-xs text-slate-400 mt-0.5">{cn.reason}</p>
            <p className="text-xs text-slate-300 mt-1">
              Lié à la facture <span className="font-mono text-[#2563EB]">{cn.original_invoice}</span>
              {" · "}{formatDate(cn.issue_date)}
            </p>
          </div>
        ))}
      </div>

      {/* Vue desktop : table */}
      <div className="hidden sm:block bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">N° avoir</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Client</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Date</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Facture d&apos;origine</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Motif</th>
              <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Montant TTC</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_CREDIT_NOTES.map((cn) => (
              <tr key={cn.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors last:border-0">
                <td className="px-5 py-4">
                  <span className="font-mono text-sm text-[#F97316] font-bold">{cn.credit_note_number}</span>
                </td>
                <td className="px-5 py-4 text-sm text-[#0F172A] font-medium">{cn.client}</td>
                <td className="px-5 py-4 text-sm text-slate-500">{formatDate(cn.issue_date)}</td>
                <td className="px-5 py-4">
                  <span className="font-mono text-sm text-[#2563EB]">{cn.original_invoice}</span>
                </td>
                <td className="px-5 py-4 text-sm text-slate-500 max-w-[200px] truncate">{cn.reason}</td>
                <td className="px-5 py-4 text-right font-mono text-sm font-bold text-[#EF4444]">
                  {formatNegativeCurrency(cn.amount_ttc)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
