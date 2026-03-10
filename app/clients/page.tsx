'use client'

export const dynamic = "force-dynamic"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Plus, Search, Building2, Loader2, Archive, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface Client {
  id: string
  name: string
  siren: string | null
  email: string | null
  city: string | null
  is_archived: boolean
  created_at: string
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const fetchClients = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/clients?search=${encodeURIComponent(search)}`)
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
    if (res.ok) {
      toast.success("Client archivé")
      fetchClients()
    } else {
      toast.error("Erreur lors de l'archivage")
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Barre de recherche + CTA */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Rechercher un client…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Link href="/clients/new">
          <Button className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-2 shrink-0">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nouveau client</span>
          </Button>
        </Link>
      </div>

      {/* Contenu */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
          </div>
        ) : clients.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-600 mb-1">
              {search ? "Aucun client trouvé" : "Aucun client pour l'instant"}
            </p>
            <p className="text-xs text-slate-400 mb-4">
              {search ? "Essayez une autre recherche" : "Ajoutez votre premier client pour commencer"}
            </p>
            {!search && (
              <Link href="/clients/new">
                <Button size="sm" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white">
                  Ajouter un client
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* ── Vue mobile : cards ── */}
            <div className="sm:hidden divide-y divide-[#F1F5F9]">
              {clients.map((client) => (
                <div key={client.id} className="flex items-center justify-between px-4 py-3.5">
                  <Link href={`/clients/${client.id}`} className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#2563EB] truncate">{client.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {[client.city, client.email].filter(Boolean).join(" · ") || "Aucune info"}
                    </p>
                  </Link>
                  <div className="flex items-center gap-1 ml-3 shrink-0">
                    <Link href={`/clients/${client.id}/edit`}>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Pencil className="w-3.5 h-3.5 text-slate-400" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost" size="sm" className="h-8 w-8 p-0"
                      onClick={() => archiveClient(client.id, client.name)}
                    >
                      <Archive className="w-3.5 h-3.5 text-slate-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Vue desktop : table ── */}
            <table className="hidden sm:table w-full">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Nom</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">SIREN</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-5 py-3 hidden md:table-cell">Email</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-5 py-3 hidden md:table-cell">Ville</th>
                  <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors last:border-0">
                    <td className="px-5 py-4">
                      <Link href={`/clients/${client.id}`} className="text-sm font-medium text-[#2563EB] hover:underline">
                        {client.name}
                      </Link>
                    </td>
                    <td className="px-5 py-4 font-mono text-sm text-slate-500">{client.siren || "—"}</td>
                    <td className="px-5 py-4 text-sm text-slate-500 hidden md:table-cell">{client.email || "—"}</td>
                    <td className="px-5 py-4 text-sm text-slate-500 hidden md:table-cell">{client.city || "—"}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/clients/${client.id}/edit`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Pencil className="w-3.5 h-3.5 text-slate-400" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost" size="sm" className="h-8 w-8 p-0"
                          onClick={() => archiveClient(client.id, client.name)}
                        >
                          <Archive className="w-3.5 h-3.5 text-slate-400" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}
