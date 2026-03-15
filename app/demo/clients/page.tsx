export const dynamic = "force-dynamic"

import { formatCurrency } from "@/lib/utils/invoice"

const MOCK_CLIENTS = [
  { id: "1", name: "Renovbat SARL",         siren: "123456789", email: "contact@renovbat.fr",    city: "Paris",     invoices_count: 4, total_amount: 12400 },
  { id: "2", name: "Électricité Dupont",     siren: "987654321", email: "dupont@elec.fr",         city: "Lyon",      invoices_count: 3, total_amount: 8650  },
  { id: "3", name: "Martin Plomberie",       siren: "456789123", email: "martin@plomberie.fr",    city: "Bordeaux",  invoices_count: 2, total_amount: 6200  },
  { id: "4", name: "Toiture Martin",         siren: "789123456", email: "contact@toiture-martin.fr", city: "Marseille", invoices_count: 1, total_amount: 4800 },
  { id: "5", name: "Maçonnerie Bernard",     siren: "321654987", email: "bernard@maconnerie.fr",  city: "Toulouse",  invoices_count: 2, total_amount: 3200  },
  { id: "6", name: "Peinture Leblanc",       siren: "789456123", email: "leblanc@peinture.fr",    city: "Nantes",    invoices_count: 1, total_amount: 950   },
]

const AVATAR_COLORS = [
  ['#EFF6FF', '#2563EB'],
  ['#F5F3FF', '#7C3AED'],
  ['#ECFEFF', '#0891B2'],
  ['#ECFDF5', '#059669'],
  ['#FFF7ED', '#EA580C'],
  ['#FDF4FF', '#A21CAF'],
]

function ClientAvatar({ name, index }: { name: string; index: number }) {
  const [bg, text] = AVATAR_COLORS[index % AVATAR_COLORS.length]
  const initials = name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('')
  return (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[12px] font-bold shrink-0"
      style={{ background: bg, color: text }}>
      {initials || '?'}
    </div>
  )
}

export default function DemoClientsPage() {
  return (
    <div className="space-y-5 animate-fade-in">

      {/* Vue mobile : cards */}
      <div className="sm:hidden space-y-3">
        {MOCK_CLIENTS.map((client, i) => (
          <div key={client.id} className="bg-white rounded-xl border border-[#E2E8F0] px-4 py-3.5 shadow-sm">
            <div className="flex items-center gap-3">
              <ClientAvatar name={client.name} index={i} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0F172A] truncate">{client.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{client.city} · SIREN {client.siren}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-sm font-bold text-[#0F172A]">{formatCurrency(client.total_amount)}</p>
                <p className="text-xs text-slate-400 mt-0.5">{client.invoices_count} facture{client.invoices_count > 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Vue desktop : table */}
      <div className="hidden sm:block bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Nom</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">SIREN</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3 hidden md:table-cell">Email</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Ville</th>
              <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Factures</th>
              <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Total TTC</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_CLIENTS.map((client, i) => (
              <tr key={client.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors last:border-0">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2.5">
                    <ClientAvatar name={client.name} index={i} />
                    <span className="text-sm font-medium text-[#0F172A]">{client.name}</span>
                  </div>
                </td>
                <td className="px-5 py-4 font-mono text-sm text-slate-500">{client.siren}</td>
                <td className="px-5 py-4 text-sm text-slate-500 hidden md:table-cell">{client.email}</td>
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
