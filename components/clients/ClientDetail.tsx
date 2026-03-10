'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, Pencil, Plus, Loader2, Building2, Mail, Phone, MapPin, Receipt, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCurrency, formatDate, INVOICE_STATUS_LABELS } from "@/lib/utils/invoice"
import { InvoiceStatus } from "@/types"

interface Invoice {
  id: string
  invoice_number: string
  status: InvoiceStatus
  issue_date: string
  total_ttc: number
}

interface Client {
  id: string
  name: string
  siren: string | null
  vat_number: string | null
  email: string | null
  phone: string | null
  address: string | null
  zip_code: string | null
  city: string | null
  country: string
  invoices: Invoice[]
}

interface Props { clientId: string }

const STATUS_STYLE: Record<InvoiceStatus, string> = {
  draft:     "bg-[#F1F5F9] text-[#475569]",
  sent:      "bg-[#DBEAFE] text-[#1E40AF]",
  pending:   "bg-[#FEF3C7] text-[#92400E]",
  received:  "bg-[#EDE9FE] text-[#5B21B6]",
  accepted:  "bg-[#D1FAE5] text-[#065F46]",
  rejected:  "bg-[#FEE2E2] text-[#991B1B]",
  paid:      "bg-[#D1FAE5] text-[#065F46]",
  overdue:   "bg-[#FEE2E2] text-[#991B1B]",
  cancelled: "bg-[#F1F5F9] text-[#64748B]",
  credited:  "bg-[#FFF7ED] text-[#C2410C]",
}

export function ClientDetail({ clientId }: Props) {
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<Client>>({})

  useEffect(() => {
    fetch(`/api/clients/${clientId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.client) { setClient(json.client); setForm(json.client) }
      })
      .finally(() => setLoading(false))
  }, [clientId])

  const saveEdit = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      setClient(json.client)
      setEditing(false)
      toast.success("Client mis à jour")
    } catch { toast.error("Erreur réseau") }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 text-[#2563EB] animate-spin" />
    </div>
  )

  if (!client) return (
    <div className="py-16 text-center">
      <p className="text-slate-500">Client introuvable</p>
      <Link href="/clients" className="text-[#2563EB] text-sm hover:underline mt-2 inline-block">← Retour aux clients</Link>
    </div>
  )

  const totalCA = client.invoices?.reduce((sum, inv) => sum + (inv.total_ttc || 0), 0) || 0

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/clients">
            <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500 shrink-0">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Clients</span>
            </Button>
          </Link>
          <div className="w-9 h-9 rounded-xl bg-[#DBEAFE] flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-[#2563EB]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-[#0F172A] truncate">{client.name}</h1>
            {client.siren && <p className="text-xs text-slate-400 font-mono">SIREN {client.siren}</p>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {!editing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
                <Pencil className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Modifier</span>
              </Button>
              <Link href={`/invoices/new?client=${clientId}`}>
                <Button size="sm" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Facturer</span>
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => { setEditing(false); setForm(client) }} className="gap-1.5">
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Annuler</span>
              </Button>
              <Button size="sm" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-1.5" onClick={saveEdit} disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Enregistrer</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── KPIs mobiles (horizontal scroll) ── */}
      <div className="grid grid-cols-3 gap-3 md:hidden">
        {[
          { label: "CA total", value: formatCurrency(totalCA) },
          { label: "Factures", value: String(client.invoices?.length || 0) },
          { label: "Pays", value: "🇫🇷 FR" },
        ].map(item => (
          <div key={item.label} className="bg-white rounded-xl border border-[#E2E8F0] p-3 shadow-sm text-center">
            <p className="text-xs text-slate-400 mb-0.5">{item.label}</p>
            <p className="text-sm font-bold text-[#0F172A] font-mono truncate">{item.value}</p>
          </div>
        ))}
      </div>

      {/* ── Grille principale ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Infos + Factures */}
        <div className="md:col-span-2 space-y-5">

          {/* Informations */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#0F172A] mb-4">Informations</h2>
            {editing ? (
              <div className="space-y-3">
                <div>
                  <Label>Raison sociale</Label>
                  <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label>Téléphone</Label>
                    <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label>Adresse</Label>
                  <Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Code postal</Label>
                    <Input value={form.zip_code || ""} onChange={(e) => setForm({ ...form, zip_code: e.target.value })} className="mt-1 font-mono" />
                  </div>
                  <div className="col-span-2">
                    <Label>Ville</Label>
                    <Input value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-1" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {client.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <a href={`mailto:${client.email}`} className="text-[#2563EB] hover:underline truncate">{client.email}</a>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-600">{client.phone}</span>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <span className="text-slate-600">{client.address}<br />{client.zip_code} {client.city}</span>
                  </div>
                )}
                {client.vat_number && (
                  <div className="flex items-center gap-2 text-sm">
                    <Receipt className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-mono text-slate-600">{client.vat_number}</span>
                  </div>
                )}
                {!client.email && !client.phone && !client.address && (
                  <p className="text-sm text-slate-400">Aucune information de contact renseignée</p>
                )}
              </div>
            )}
          </div>

          {/* Historique factures */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#0F172A]">Factures ({client.invoices?.length || 0})</h2>
              <Link href={`/invoices/new?client=${clientId}`}>
                <Button variant="ghost" size="sm" className="gap-1.5 text-[#2563EB] h-7">
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Nouvelle facture</span>
                </Button>
              </Link>
            </div>
            {!client.invoices || client.invoices.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">Aucune facture pour ce client</div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-[#F1F5F9]">
                  {client.invoices.map((inv) => (
                    <Link key={inv.id} href={`/invoices/${inv.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-[#F8FAFC]">
                      <div>
                        <p className="font-mono text-sm text-[#2563EB] font-medium">{inv.invoice_number}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{formatDate(inv.issue_date)}</p>
                      </div>
                      <div className="text-right ml-3">
                        <p className="font-mono text-sm font-semibold text-[#0F172A]">{formatCurrency(inv.total_ttc)}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${STATUS_STYLE[inv.status]}`}>
                          {INVOICE_STATUS_LABELS[inv.status]}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
                {/* Desktop table */}
                <table className="hidden sm:table w-full">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">N° facture</th>
                      <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Date</th>
                      <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Montant TTC</th>
                      <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {client.invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors last:border-0">
                        <td className="px-5 py-3.5">
                          <Link href={`/invoices/${inv.id}`} className="font-mono text-sm text-[#2563EB] hover:underline font-medium">
                            {inv.invoice_number}
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-500">{formatDate(inv.issue_date)}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-sm font-semibold text-[#0F172A]">{formatCurrency(inv.total_ttc)}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[inv.status]}`}>
                            {INVOICE_STATUS_LABELS[inv.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>

        {/* KPIs desktop */}
        <div className="hidden md:flex flex-col gap-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm text-center">
            <p className="text-xs text-slate-400 mb-1">CA total</p>
            <p className="text-2xl font-bold font-mono text-[#0F172A]">{formatCurrency(totalCA)}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm text-center">
            <p className="text-xs text-slate-400 mb-1">Factures</p>
            <p className="text-2xl font-bold text-[#0F172A]">{client.invoices?.length || 0}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm text-center">
            <p className="text-xs text-slate-400 mb-1">Pays</p>
            <p className="text-lg font-medium text-[#0F172A]">🇫🇷 France</p>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-xl border border-[#FEE2E2] p-5">
        <h3 className="text-sm font-semibold text-[#991B1B] mb-2">Zone de danger</h3>
        <p className="text-xs text-slate-500 mb-3">L&apos;archivage masque le client de la liste. Les factures associées sont conservées.</p>
        <Button
          variant="outline" size="sm"
          className="border-[#FCA5A5] text-[#991B1B] hover:bg-[#FEE2E2] gap-1.5"
          onClick={async () => {
            if (!confirm("Archiver ce client ?")) return
            const res = await fetch(`/api/clients/${clientId}`, { method: "DELETE" })
            if (res.ok) { toast.success("Client archivé"); router.push("/clients") }
          }}
        >
          Archiver ce client
        </Button>
      </div>
    </div>
  )
}
