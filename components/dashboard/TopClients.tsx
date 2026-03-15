import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/utils/invoice"
import Link from "next/link"
import { Users } from "lucide-react"

export const revalidate = 60

export async function TopClients() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: invoices } = await supabase
    .from("invoices")
    .select("total_ttc, client_id, client:clients(id, name)")
    .eq("user_id", user.id)
    .eq("status", "paid")

  if (!invoices?.length) return null

  // Agréger par client
  const byClient = new Map<string, { name: string; total: number; clientId: string }>()
  for (const inv of invoices) {
    const cid  = inv.client_id as string
    const name = (inv.client as unknown as { id: string; name: string } | null)?.name ?? "Client inconnu"
    const existing = byClient.get(cid)
    if (existing) {
      existing.total += inv.total_ttc || 0
    } else {
      byClient.set(cid, { name, total: inv.total_ttc || 0, clientId: cid })
    }
  }

  const top5 = Array.from(byClient.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  if (!top5.length) return null

  const max = top5[0].total

  return (
    <div
      className="rounded-2xl border border-white/60 dark:border-[#1E3A5F] p-4 sm:p-5"
      style={{ background: 'var(--card-glass-bg)', boxShadow: 'var(--card-glass-shadow)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[14px] font-bold text-[#0F172A] dark:text-[#E2E8F0]">Top clients</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">par CA encaissé</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EFF6FF]">
          <Users className="w-4 h-4 text-[#2563EB]" />
        </div>
      </div>

      <div className="space-y-3">
        {top5.map((client, i) => (
          <Link
            key={client.clientId}
            href={`/clients/${client.clientId}`}
            className="flex items-center gap-3 group"
          >
            {/* Rang */}
            <span className="w-5 text-[11px] font-bold text-slate-300 dark:text-slate-600 shrink-0 text-center">
              {i + 1}
            </span>

            {/* Nom + barre */}
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
