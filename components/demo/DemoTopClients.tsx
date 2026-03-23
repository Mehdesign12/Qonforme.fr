import { formatCurrency } from "@/lib/utils/invoice"
import Link from "next/link"
import { Users } from "lucide-react"

const MOCK_TOP_CLIENTS = [
  { id: "1", name: "Renovbat SARL",      total: 12400 },
  { id: "3", name: "Électricité Dupont", total: 8650  },
  { id: "2", name: "Martin Plomberie",   total: 6200  },
  { id: "5", name: "Toiture Martin",     total: 4800  },
  { id: "4", name: "Maçonnerie Bernard", total: 3200  },
]

export function DemoTopClients() {
  const max = MOCK_TOP_CLIENTS[0].total

  return (
    <div className="rounded-2xl border border-white/60 p-4 sm:p-5 h-full"
      style={{ background: 'var(--card-glass-bg)', boxShadow: 'var(--card-glass-shadow)' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[14px] font-bold text-[#0F172A] dark:text-[#E2E8F0]">Top clients</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">par CA encaissé</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EFF6FF] dark:bg-[#1E3A5F]">
          <Users className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
        </div>
      </div>

      <div className="space-y-3">
        {MOCK_TOP_CLIENTS.map((client, i) => (
          <Link key={client.id} href="/demo/clients" className="flex items-center gap-3 group">
            <span className="w-5 text-[11px] font-bold text-slate-300 shrink-0 text-center">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[13px] font-semibold text-[#0F172A] dark:text-[#E2E8F0] truncate group-hover:text-[#2563EB] transition-colors">
                  {client.name}
                </p>
                <p className="text-[12px] font-mono font-bold text-[#0F172A] dark:text-[#E2E8F0] shrink-0 ml-2">
                  {formatCurrency(client.total)}
                </p>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[#F1F5F9] dark:bg-[#1E3A5F] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.round((client.total / max) * 100)}%`,
                    background: i === 0
                      ? 'linear-gradient(90deg, #2563EB, #60A5FA)'
                      : 'linear-gradient(90deg, #60A5FA, #93C5FD)',
                    opacity: 1 - i * 0.12,
                  }}
                />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
