import type { Metadata } from "next"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils/invoice"

export const metadata: Metadata = { title: "Clients" }
export const dynamic = "force-dynamic"

const MOCK_CLIENTS = [
  { id: "1", name: "Renovbat SARL", siren: "123456789", email: "contact@renovbat.fr", city: "Paris", invoices_count: 4, total_amount: 8200 },
  { id: "2", name: "Martin Plomberie", siren: "987654321", email: "martin@plomberie.fr", city: "Lyon", invoices_count: 2, total_amount: 1750 },
  { id: "3", name: "Électricité Dupont", siren: "456789123", email: "dupont@elec.fr", city: "Marseille", invoices_count: 3, total_amount: 5400 },
]

export default function ClientsPage() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Nom</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">SIREN</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Email</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Ville</th>
              <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Factures</th>
              <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Total TTC</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_CLIENTS.map((client) => (
              <tr key={client.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors last:border-0">
                <td className="px-5 py-4">
                  <Link href={`/clients/${client.id}`} className="text-sm font-medium text-[#2563EB] hover:underline">
                    {client.name}
                  </Link>
                </td>
                <td className="px-5 py-4 font-mono text-sm text-slate-500">{client.siren}</td>
                <td className="px-5 py-4 text-sm text-slate-500">{client.email}</td>
                <td className="px-5 py-4 text-sm text-slate-500">{client.city}</td>
                <td className="px-5 py-4 text-right text-sm font-medium text-[#0F172A]">{client.invoices_count}</td>
                <td className="px-5 py-4 text-right font-mono text-sm font-semibold text-[#0F172A]">
                  {formatCurrency(client.total_amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
