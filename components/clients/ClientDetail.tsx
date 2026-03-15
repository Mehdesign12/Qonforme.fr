'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft, Pencil, Plus, Loader2, Building2,
  Mail, Phone, MapPin, Receipt, X, Check, FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  formatCurrency, formatDate,
  INVOICE_STATUS_LABELS, QUOTE_STATUS_LABELS,
} from "@/lib/utils/invoice"
import { InvoiceStatus, QuoteStatus } from "@/types"

// ── Local types ────────────────────────────────────────────────────────────

interface DocInvoice {
  id: string
  invoice_number: string
  status: InvoiceStatus
  issue_date: string
  due_date: string
  total_ttc: number
}

interface DocQuote {
  id: string
  quote_number: string
  status: QuoteStatus
  issue_date: string
  valid_until: string
  total_ttc: number
}

interface DocCreditNote {
  id: string
  credit_note_number: string
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
  invoices: DocInvoice[]
  quotes: DocQuote[]
  credit_notes: DocCreditNote[]
}

interface Props { clientId: string }

type DocTab = 'all' | 'invoices' | 'quotes' | 'credit_notes'

// ── Status styles ──────────────────────────────────────────────────────────

const INV_STYLE: Record<InvoiceStatus, { bg: string; text: string }> = {
  draft:     { bg: '#F1F5F9', text: '#475569' },
  sent:      { bg: '#DBEAFE', text: '#1E40AF' },
  pending:   { bg: '#FEF3C7', text: '#92400E' },
  received:  { bg: '#EDE9FE', text: '#5B21B6' },
  accepted:  { bg: '#D1FAE5', text: '#065F46' },
  rejected:  { bg: '#FEE2E2', text: '#991B1B' },
  paid:      { bg: '#D1FAE5', text: '#065F46' },
  overdue:   { bg: '#FEE2E2', text: '#991B1B' },
  cancelled: { bg: '#F1F5F9', text: '#64748B' },
  credited:  { bg: '#FFF7ED', text: '#C2410C' },
}

const Q_STYLE: Record<QuoteStatus, { bg: string; text: string }> = {
  draft:    { bg: '#F1F5F9', text: '#475569' },
  sent:     { bg: '#DBEAFE', text: '#1E40AF' },
  accepted: { bg: '#D1FAE5', text: '#065F46' },
  rejected: { bg: '#FEE2E2', text: '#991B1B' },
}

// ── Unified document type ──────────────────────────────────────────────────

interface UnifiedDoc {
  id: string
  type: 'invoice' | 'quote' | 'credit_note'
  number: string
  issue_date: string
  due_or_valid: string | null
  total_ttc: number
  statusLabel: string
  statusStyle: { bg: string; text: string }
  href: string
  isCredit: boolean
}

const TYPE_LABEL: Record<UnifiedDoc['type'], string> = {
  invoice:     'Facture',
  quote:       'Devis',
  credit_note: 'Avoir',
}

const TYPE_STYLE: Record<UnifiedDoc['type'], { bg: string; text: string }> = {
  invoice:     { bg: '#EFF6FF', text: '#2563EB' },
  quote:       { bg: '#F5F3FF', text: '#7C3AED' },
  credit_note: { bg: '#FFF7ED', text: '#C2410C' },
}

function buildDocs(client: Client): UnifiedDoc[] {
  const docs: UnifiedDoc[] = []

  for (const inv of (client.invoices || [])) {
    docs.push({
      id: inv.id,
      type: 'invoice',
      number: inv.invoice_number,
      issue_date: inv.issue_date,
      due_or_valid: inv.due_date || null,
      total_ttc: inv.total_ttc,
      statusLabel: INVOICE_STATUS_LABELS[inv.status],
      statusStyle: INV_STYLE[inv.status],
      href: `/invoices/${inv.id}`,
      isCredit: false,
    })
  }

  for (const q of (client.quotes || [])) {
    docs.push({
      id: q.id,
      type: 'quote',
      number: q.quote_number,
      issue_date: q.issue_date,
      due_or_valid: q.valid_until || null,
      total_ttc: q.total_ttc,
      statusLabel: QUOTE_STATUS_LABELS[q.status],
      statusStyle: Q_STYLE[q.status],
      href: `/quotes/${q.id}`,
      isCredit: false,
    })
  }

  for (const cn of (client.credit_notes || [])) {
    docs.push({
      id: cn.id,
      type: 'credit_note',
      number: cn.credit_note_number,
      issue_date: cn.issue_date,
      due_or_valid: null,
      total_ttc: cn.total_ttc,
      statusLabel: 'Avoir',
      statusStyle: { bg: '#FFF7ED', text: '#C2410C' },
      href: `/credit-notes/${cn.id}`,
      isCredit: true,
    })
  }

  docs.sort((a, b) => new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime())
  return docs
}

// ── Component ──────────────────────────────────────────────────────────────

export function ClientDetail({ clientId }: Props) {
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<Client>>({})
  const [activeTab, setActiveTab] = useState<DocTab>('all')

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
      // Preserve nested docs since PATCH only returns flat client fields
      setClient(prev => prev ? {
        ...json.client,
        invoices: prev.invoices || [],
        quotes: prev.quotes || [],
        credit_notes: prev.credit_notes || [],
      } : null)
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

  // ── KPI computations ──────────────────────────────────────────────────────
  const invoices = client.invoices || []
  const quotes = client.quotes || []
  const creditNotes = client.credit_notes || []

  const caEncaisse = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total_ttc, 0)
  const encours = invoices
    .filter(i => ['sent', 'pending', 'received', 'accepted'].includes(i.status))
    .reduce((s, i) => s + i.total_ttc, 0)
  const enRetard = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.total_ttc, 0)

  const allDocs = buildDocs(client)
  const filteredDocs = activeTab === 'all' ? allDocs
    : activeTab === 'invoices' ? allDocs.filter(d => d.type === 'invoice')
    : activeTab === 'quotes' ? allDocs.filter(d => d.type === 'quote')
    : allDocs.filter(d => d.type === 'credit_note')

  const tabs: { key: DocTab; label: string; count: number }[] = [
    { key: 'all',          label: 'Tous',     count: allDocs.length },
    { key: 'invoices',     label: 'Factures', count: invoices.length },
    { key: 'quotes',       label: 'Devis',    count: quotes.length },
    { key: 'credit_notes', label: 'Avoirs',   count: creditNotes.length },
  ]

  // mid-tone colors readable on both white and dark-blue (#0F1E35) backgrounds
  const kpis = [
    {
      label: 'CA encaissé',
      value: formatCurrency(caEncaisse),
      activeColor: '#10B981',
      isActive: caEncaisse > 0,
    },
    {
      label: 'Encours',
      value: formatCurrency(encours),
      activeColor: '#3B82F6',
      isActive: encours > 0,
    },
    {
      label: 'En retard',
      value: formatCurrency(enRetard),
      activeColor: '#EF4444',
      isActive: enRetard > 0,
    },
    {
      label: 'Factures',
      value: String(invoices.length),
      activeColor: null,
      isActive: false,
    },
  ]

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
            <h1 className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#E2E8F0] truncate">{client.name}</h1>
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

      {/* ── KPIs mobile (2×2 grid) — hidden on md+ ── */}
      <div className="grid grid-cols-2 gap-3 md:hidden">
        {kpis.map(k => (
          <div
            key={k.label}
            className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-3.5 shadow-sm"
          >
            <p className="text-xs text-slate-400 mb-1">{k.label}</p>
            <p
              className="text-sm font-bold font-mono truncate text-[#0F172A] dark:text-[#E2E8F0]"
              style={k.isActive && k.activeColor ? { color: k.activeColor } : undefined}
            >
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Left col — Infos + Historique */}
        <div className="md:col-span-2 space-y-5">

          {/* Informations */}
          <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0] mb-4">Informations</h2>
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
                    <span className="text-slate-600 dark:text-slate-400">{client.phone}</span>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <span className="text-slate-600 dark:text-slate-400">{client.address}<br />{client.zip_code} {client.city}</span>
                  </div>
                )}
                {client.vat_number && (
                  <div className="flex items-center gap-2 text-sm">
                    <Receipt className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-mono text-slate-600 dark:text-slate-400">{client.vat_number}</span>
                  </div>
                )}
                {!client.email && !client.phone && !client.address && (
                  <p className="text-sm text-slate-400">Aucune information de contact renseignée</p>
                )}
              </div>
            )}
          </div>

          {/* Historique commercial */}
          <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] shadow-sm overflow-hidden">

            {/* Card header */}
            <div className="px-5 py-4 border-b border-[#E2E8F0] dark:border-[#1E3A5F] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Documents</h2>
              <Link href={`/invoices/new?client=${clientId}`}>
                <Button variant="ghost" size="sm" className="gap-1.5 text-[#2563EB] h-7 px-2">
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-xs">Nouvelle facture</span>
                </Button>
              </Link>
            </div>

            {/* Tabs — horizontal scroll, no scrollbar, iOS-safe */}
            <div
              className="flex overflow-x-auto border-b border-[#E2E8F0] dark:border-[#1E3A5F]"
              style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
            >
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`shrink-0 flex items-center gap-1.5 px-4 text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'border-b-2 border-[#2563EB] text-[#2563EB]'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
                  }`}
                  style={{ minHeight: '44px' }}
                >
                  {tab.label}
                  <span
                    className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                      activeTab === tab.key
                        ? 'bg-[#DBEAFE] text-[#2563EB]'
                        : 'bg-[#F1F5F9] dark:bg-[#1E3A5F] text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Document list */}
            {filteredDocs.length === 0 ? (
              <div className="py-12 text-center px-6">
                <FileText className="w-8 h-8 text-slate-200 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Aucun document pour ce client</p>
              </div>
            ) : (
              <>
                {/* ── Mobile cards ── */}
                <div className="sm:hidden divide-y divide-[#F1F5F9] dark:divide-[#162032]">
                  {filteredDocs.map(doc => (
                    <Link
                      key={`${doc.type}-${doc.id}`}
                      href={doc.href}
                      className="flex items-center justify-between px-4 py-3.5 hover:bg-[#F8FAFC] active:bg-[#F0F4FF] dark:hover:bg-[#162032] dark:active:bg-[#0D1926] transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0"
                            style={{ background: TYPE_STYLE[doc.type].bg, color: TYPE_STYLE[doc.type].text }}
                          >
                            {TYPE_LABEL[doc.type]}
                          </span>
                          <span className="font-mono text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0] truncate">
                            {doc.number}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {formatDate(doc.issue_date)}
                          {doc.due_or_valid ? ` · éch. ${formatDate(doc.due_or_valid)}` : ''}
                        </p>
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <p
                          className="font-mono text-sm font-bold"
                          style={{ color: doc.isCredit ? '#C2410C' : undefined }}
                        >
                          <span className="text-[#0F172A] dark:text-[#E2E8F0]" style={{ color: doc.isCredit ? '#C2410C' : undefined }}>
                            {doc.isCredit ? '−' : ''}{formatCurrency(doc.total_ttc)}
                          </span>
                        </p>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1"
                          style={{ background: doc.statusStyle.bg, color: doc.statusStyle.text }}
                        >
                          {doc.statusLabel}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* ── Desktop table ── */}
                <table className="hidden sm:table w-full">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#162032]">
                      <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-300 px-5 py-3">Type</th>
                      <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-300 px-5 py-3">N° document</th>
                      <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-300 px-5 py-3">Émission</th>
                      <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-300 px-5 py-3 hidden lg:table-cell">Échéance</th>
                      <th className="text-right text-[10px] font-bold uppercase tracking-wider text-slate-300 px-5 py-3">Montant TTC</th>
                      <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-300 px-5 py-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocs.map(doc => (
                      <tr
                        key={`${doc.type}-${doc.id}`}
                        className="border-b border-[#F1F5F9] dark:border-[#162032] hover:bg-[#F8FAFC] dark:hover:bg-[#162032] transition-colors last:border-0"
                      >
                        <td className="px-5 py-3.5">
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
                            style={{ background: TYPE_STYLE[doc.type].bg, color: TYPE_STYLE[doc.type].text }}
                          >
                            {TYPE_LABEL[doc.type]}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <Link href={doc.href} className="font-mono text-sm text-[#2563EB] hover:underline font-medium">
                            {doc.number}
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-500">{formatDate(doc.issue_date)}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-500 hidden lg:table-cell">
                          {doc.due_or_valid ? formatDate(doc.due_or_valid) : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-sm font-semibold" style={{ color: doc.isCredit ? '#C2410C' : undefined }}>
                          <span className="text-[#0F172A] dark:text-[#E2E8F0]" style={{ color: doc.isCredit ? '#C2410C' : undefined }}>
                            {doc.isCredit ? '−' : ''}{formatCurrency(doc.total_ttc)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                            style={{ background: doc.statusStyle.bg, color: doc.statusStyle.text }}
                          >
                            {doc.statusLabel}
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

        {/* Right col — KPIs desktop */}
        <div className="hidden md:flex flex-col gap-4">
          {kpis.map(k => (
            <div
              key={k.label}
              className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-5 shadow-sm text-center"
            >
              <p className="text-xs text-slate-400 mb-1">{k.label}</p>
              <p
                className="text-xl font-bold font-mono text-[#0F172A] dark:text-[#E2E8F0]"
                style={k.isActive && k.activeColor ? { color: k.activeColor } : undefined}
              >
                {k.value}
              </p>
            </div>
          ))}
        </div>

      </div>

      {/* Danger zone */}
      <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#FEE2E2] p-5">
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
