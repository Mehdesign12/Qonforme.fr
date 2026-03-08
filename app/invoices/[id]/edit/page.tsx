'use client'

export const dynamic = "force-dynamic"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, Plus, Trash2, Loader2, Save, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { calculateLineTotals, calculateInvoiceTotals, formatCurrency, VAT_RATES } from "@/lib/utils/invoice"

type VatRate = 0 | 5.5 | 10 | 20

type Line = {
  id: string
  description: string
  quantity: string
  unit_price_ht: string
  vat_rate: VatRate
}

type FormState = {
  client_id: string
  issue_date: string
  due_date: string
  notes: string
  lines: Line[]
}

interface Client { id: string; name: string }

function newLine(): Line {
  return { id: crypto.randomUUID(), description: "", quantity: "1", unit_price_ht: "", vat_rate: 20 }
}

export default function EditInvoicePage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [clients, setClients]             = useState<Client[]>([])
  const [loadingData, setLoadingData]     = useState(true)
  const [saving, setSaving]               = useState(false)
  const [sending, setSending]             = useState(false)
  const [errors, setErrors]               = useState<Record<string, string>>({})

  const [form, setForm] = useState<FormState>({
    client_id: "", issue_date: "", due_date: "", notes: "", lines: [newLine()],
  })

  // Charger la facture + les clients
  useEffect(() => {
    Promise.all([
      fetch(`/api/invoices/${id}`).then(r => r.json()),
      fetch("/api/clients").then(r => r.json()),
    ]).then(([invJson, cliJson]) => {
      if (invJson.invoice) {
        const inv = invJson.invoice
        if (inv.status !== "draft") {
          toast.error("Seules les factures brouillons peuvent être modifiées")
          router.replace(`/invoices/${id}`)
          return
        }
        setInvoiceNumber(inv.invoice_number)
        setForm({
          client_id: inv.client_id || "",
          issue_date: inv.issue_date || "",
          due_date:   inv.due_date   || "",
          notes:      inv.notes      || "",
          lines: (inv.lines || []).map((l: {
            description: string; quantity: number; unit_price_ht: number; vat_rate: number
          }) => ({
            id:            crypto.randomUUID(),
            description:   l.description,
            quantity:      String(l.quantity),
            unit_price_ht: String(l.unit_price_ht),
            vat_rate:      l.vat_rate as VatRate,
          })),
        })
      }
      if (cliJson.clients) setClients(cliJson.clients)
    }).finally(() => setLoadingData(false))
  }, [id, router])

  const setField = (key: keyof Omit<FormState, "lines">) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm(prev => ({ ...prev, [key]: e.target.value }))
      if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
    }

  const setLine = (lineId: string, key: keyof Line) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm(prev => ({
        ...prev,
        lines: prev.lines.map(l =>
          l.id === lineId ? { ...l, [key]: key === "vat_rate" ? Number(e.target.value) as VatRate : e.target.value } : l
        ),
      }))
    }

  const addLine    = () => setForm(prev => ({ ...prev, lines: [...prev.lines, newLine()] }))
  const removeLine = (lineId: string) => setForm(prev => ({ ...prev, lines: prev.lines.filter(l => l.id !== lineId) }))

  const computedLines = form.lines.map(line => {
    const qty   = parseFloat(line.quantity) || 0
    const price = parseFloat(line.unit_price_ht) || 0
    return calculateLineTotals(qty, price, line.vat_rate)
  })

  const totals = calculateInvoiceTotals(
    computedLines.map(l => ({ total_ht: l.totalHT, total_vat: l.totalVAT, total_ttc: l.totalTTC }))
  )

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.client_id)   errs.client_id  = "Client requis"
    if (!form.issue_date)  errs.issue_date  = "Date d'émission requise"
    if (!form.due_date)    errs.due_date    = "Date d'échéance requise"
    form.lines.forEach((line, i) => {
      if (!line.description.trim()) errs[`line_${i}_desc`]  = "Description requise"
      if (!line.quantity || parseFloat(line.quantity) <= 0)  errs[`line_${i}_qty`]   = "Quantité invalide"
      if (line.unit_price_ht === "" || parseFloat(line.unit_price_ht) < 0) errs[`line_${i}_price`] = "Prix invalide"
    })
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const submit = async (action: "draft" | "send") => {
    if (!validate()) { toast.error("Corrigez les erreurs avant de continuer"); return }
    if (action === "send") setSending(true); else setSaving(true)

    try {
      const enrichedLines = form.lines.map((line, i) => ({
        description:   line.description.trim(),
        quantity:      parseFloat(line.quantity) || 0,
        unit_price_ht: parseFloat(line.unit_price_ht) || 0,
        vat_rate:      line.vat_rate,
        total_ht:      computedLines[i].totalHT,
        total_vat:     computedLines[i].totalVAT,
        total_ttc:     computedLines[i].totalTTC,
      }))

      const payload = {
        client_id:  form.client_id,
        issue_date: form.issue_date,
        due_date:   form.due_date,
        notes:      form.notes || null,
        lines:      enrichedLines,
        status:     action === "send" ? "sent" : "draft",
      }

      const res  = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || "Erreur lors de la sauvegarde"); return }

      toast.success(action === "send" ? "Facture envoyée !" : "Brouillon sauvegardé !")
      router.push(`/invoices/${id}`)
      router.refresh()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setSaving(false); setSending(false)
    }
  }

  if (loadingData) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 text-[#2563EB] animate-spin" />
    </div>
  )

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/invoices/${id}`}>
          <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4" /> Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">Modifier {invoiceNumber}</h1>
          <p className="text-sm text-slate-400 mt-0.5">Brouillon — modifications non publiées</p>
        </div>
      </div>

      {/* Client + dates */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-[#0F172A]">Informations de facturation</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <div className="md:col-span-1">
            <Label>Client *</Label>
            <select
              value={form.client_id}
              onChange={setField("client_id")}
              className="mt-1 w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              <option value="">Sélectionner un client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.client_id && <p className="text-xs text-red-500 mt-1">{errors.client_id}</p>}
          </div>

          <div>
            <Label>Date d&apos;émission *</Label>
            <Input type="date" className="mt-1 font-mono" value={form.issue_date} onChange={setField("issue_date")} />
            {errors.issue_date && <p className="text-xs text-red-500 mt-1">{errors.issue_date}</p>}
          </div>

          <div>
            <Label>Date d&apos;échéance *</Label>
            <Input type="date" className="mt-1 font-mono" value={form.due_date} onChange={setField("due_date")} />
            {errors.due_date && <p className="text-xs text-red-500 mt-1">{errors.due_date}</p>}
          </div>
        </div>
      </div>

      {/* Lignes */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[#0F172A]">Prestations</h2>
          <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
          </Button>
        </div>

        <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-slate-400 pb-1 border-b border-[#E2E8F0]">
          <div className="col-span-5">Description</div>
          <div className="col-span-2 text-right">Qté</div>
          <div className="col-span-2 text-right">Prix HT (€)</div>
          <div className="col-span-2 text-center">TVA</div>
          <div className="col-span-1" />
        </div>

        {form.lines.map((line, index) => {
          const calc      = computedLines[index]
          const hasValues = parseFloat(line.quantity) > 0 && parseFloat(line.unit_price_ht) > 0
          return (
            <div key={line.id}>
              <div className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-12 sm:col-span-5">
                  <Input placeholder="Description" className="text-sm" value={line.description} onChange={setLine(line.id, "description")} />
                  {errors[`line_${index}_desc`] && <p className="text-xs text-red-500 mt-0.5">{errors[`line_${index}_desc`]}</p>}
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Input type="number" min="0" step="0.01" placeholder="1" className="text-sm text-right font-mono" value={line.quantity} onChange={setLine(line.id, "quantity")} />
                  {errors[`line_${index}_qty`] && <p className="text-xs text-red-500 mt-0.5">{errors[`line_${index}_qty`]}</p>}
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Input type="number" min="0" step="0.01" placeholder="0.00" className="text-sm text-right font-mono" value={line.unit_price_ht} onChange={setLine(line.id, "unit_price_ht")} />
                  {errors[`line_${index}_price`] && <p className="text-xs text-red-500 mt-0.5">{errors[`line_${index}_price`]}</p>}
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <select value={line.vat_rate} onChange={setLine(line.id, "vat_rate")}
                    className="w-full px-2 py-2 text-sm border border-[#E2E8F0] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] font-mono">
                    {VAT_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
                <div className="col-span-1 flex items-center justify-center">
                  {form.lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(line.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              {hasValues && (
                <div className="flex justify-end text-xs text-slate-400 mt-1 pr-8">
                  HT : <span className="font-mono font-medium text-[#0F172A] mx-1">{formatCurrency(calc.totalHT)}</span>
                  {" · "}TVA : <span className="font-mono mx-1">{formatCurrency(calc.totalVAT)}</span>
                  {" · "}TTC : <span className="font-mono font-semibold text-[#2563EB] ml-1">{formatCurrency(calc.totalTTC)}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Notes + Récap */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
          <Label>Notes / conditions de paiement</Label>
          <textarea
            placeholder="Paiement par virement sous 30 jours…"
            rows={4} value={form.notes} onChange={setField("notes")}
            className="mt-2 w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-slate-600"
          />
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
          <h3 className="font-semibold text-[#0F172A] mb-4">Récapitulatif</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Sous-total HT</span>
              <span className="font-mono font-medium text-[#0F172A]">{formatCurrency(totals.subtotal_ht)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">TVA</span>
              <span className="font-mono text-slate-600">{formatCurrency(totals.total_vat)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span className="font-semibold text-[#0F172A]">Total TTC</span>
              <span className="font-mono text-xl font-bold text-[#2563EB]">{formatCurrency(totals.total_ttc)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pb-8">
        <Link href={`/invoices/${id}`}>
          <Button variant="outline" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Annuler
          </Button>
        </Link>
        <Button variant="outline" disabled={saving} onClick={() => submit("draft")} className="gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Sauvegarder le brouillon
        </Button>
        <Button
          className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-1.5 ml-auto"
          disabled={sending} onClick={() => submit("send")}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Envoyer la facture
        </Button>
      </div>
    </div>
  )
}
