'use client'

export const dynamic = "force-dynamic"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Plus, Search, Building2, Loader2, Archive, Pencil } from "lucide-react"
import { toast } from "sonner"

interface Client {
  id: string; name: string; siren: string | null
  email: string | null; city: string | null
  is_archived: boolean; created_at: string
}

const AVATAR_COLORS = [
  ['#EFF6FF', '#2563EB'], ['#F5F3FF', '#7C3AED'], ['#ECFEFF', '#0891B2'],
  ['#ECFDF5', '#059669'], ['#FFF7ED', '#EA580C'],
]
function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?'
}

const cardStyle: React.CSSProperties = {
  background: 'var(--card-glass-bg)',
  boxShadow: 'var(--card-glass-shadow)',
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState("")

  const fetchClients = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/clients?search=${encodeURIComponent(search)}`)
    const json = await res.json()
    if (json.clients) setClients(json.clients)
    setLoading(false)
  }, [search])

  useEffect(() => {
    const timer = setTimeout(fetchClients, 300)
    return () => clearTimeout(timer)
  }, [fetchClients])

  const archiveClient = async (id: string, name: string) => {
    if (!confirm(`Archiver "${name}" ?`)) return
    const res = await fetch(`/api/clients/${id}`, { method: "DELETE" })
    if (res.ok) { toast.success("Client archivé"); fetchClients() }
    else         toast.error("Erreur lors de l'archivage")
  }

  return (
    <div className="space-y-4 max-w-[1200px] mx-auto">

      {/* ── Barre de recherche (CTA supprimé — déjà dans le Header) ── */}
      <div
        className="relative flex items-center rounded-xl border border-white/60 dark:border-[#1E3A5F] overflow-hidden"
        style={{ background: 'var(--card-glass-bg)' }}
      >
        <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          placeholder="Rechercher un client…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 text-sm bg-transparent outline-none text-[#0F172A] dark:text-[#E2E8F0] placeholder:text-slate-400"
        />
      </div>

      {/* Contenu */}
      <div className="rounded-2xl border border-white/60 dark:border-[#1E3A5F] overflow-hidden" style={cardStyle}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
          </div>
        ) : clients.length === 0 ? (
          <div className="py-20 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-[#EFF6FF] flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-6 h-6 text-[#2563EB]" />
            </div>
            <p className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0] mb-1">
              {search ? "Aucun client trouvé" : "Aucun client pour l'instant"}
            </p>
            <p className="text-sm text-slate-400 mb-5">
              {search ? "Essayez une autre recherche" : "Ajoutez votre premier client pour commencer"}
            </p>
            {!search && (
              <Link href="/clients/new">
                <button className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl transition-colors">
                  <Plus className="w-4 h-4" />
                  Ajouter un client
                </button>
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden divide-y divide-[#F8FAFC] dark:divide-[#162032]">
              {clients.map((client, i) => {
                const [bgC, textC] = AVATAR_COLORS[i % AVATAR_COLORS.length]
                return (
                  <div key={client.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#F8FAFC] dark:hover:bg-[#162032] transition-colors">
                    {/* Avatar */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-[12px] font-bold shrink-0"
                      style={{ background: bgC, color: textC }}
                    >
                      {initials(client.name)}
                    </div>
                    <Link href={`/clients/${client.id}`} className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-[#2563EB] truncate">{client.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {[client.city, client.email].filter(Boolean).join(" · ") || "Aucune info"}
                      </p>
                    </Link>
                    <div className="flex items-center gap-1 shrink-0">
                      <Link href={`/clients/${client.id}/edit`}>
                        <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </Link>
                      <button
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        onClick={() => archiveClient(client.id, client.name)}
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop */}
            <table className="hidden sm:table w-full">
              <thead>
                <tr className="border-b border-[#F8FAFC] dark:border-[#162032] bg-[#FAFBFC]/60 dark:bg-[#162032]/40">
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-300 px-5 py-3.5">Client</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-300 px-5 py-3.5">SIREN</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-300 px-5 py-3.5 hidden md:table-cell">Email</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-300 px-5 py-3.5 hidden md:table-cell">Ville</th>
                  <th className="text-right text-[10px] font-bold uppercase tracking-wider text-slate-300 px-5 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client, i) => {
                  const [bgC, textC] = AVATAR_COLORS[i % AVATAR_COLORS.length]
                  return (
                    <tr key={client.id} className="border-b border-[#F8FAFC] dark:border-[#162032] hover:bg-[#F8FAFC]/70 dark:hover:bg-[#162032]/60 transition-colors last:border-0 group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold shrink-0"
                            style={{ background: bgC, color: textC }}>
                            {initials(client.name)}
                          </div>
                          <Link href={`/clients/${client.id}`} className="text-[13px] font-bold text-[#2563EB] hover:underline">
                            {client.name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[12px] text-slate-400">{client.siren || "—"}</td>
                      <td className="px-5 py-3.5 text-[12px] text-slate-400 hidden md:table-cell">{client.email || "—"}</td>
                      <td className="px-5 py-3.5 text-[12px] text-slate-400 hidden md:table-cell">{client.city || "—"}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/clients/${client.id}/edit`}>
                            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </Link>
                          <button
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            onClick={() => archiveClient(client.id, client.name)}
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}
