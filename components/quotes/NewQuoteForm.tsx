'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Trash2, Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { calculateLineTotals, calculateInvoiceTotals, formatCurrency, VAT_RATES } from "@/lib/utils/invoice"
import { ProductCombobox, type ProductSuggestion } from "@/components/products/ProductCombobox"

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
  valid_until: string
  notes: string
  lines: Line[]
}

interface Client { id: string; name: string }

const today    = new Date().toISOString().split("T")[0]
const in30days = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]

function newLine(): Line {
  return { id: crypto.randomUUID(), description: "", quantity: "1", unit_price_ht: "", vat_rate: 20 }
}

export default function NewQuoteForm() {
  const router = useRouter()
  const [loading, setLoading]           = useState(false)
  const [saving, setSaving]             = useState(false)
  const [clients, setClients]           = useState<Client[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [errors, setErrors]             = useState<Record<string, string>>({})

  const [form, setForm] = useState<FormState>({
    client_id:   "",
    issue_date:  today,
    valid_until: in30days,
    notes:       "",
    lines:       [newLine()],
  })

  useEffect(() => {
    fetch("/api/clients")
      .then(r => r.json())
      .then(json => { if (json.clients) setClients(json.clients) })
      .finally(() => setClientsLoading(false))
  }, [])

  const setField = (key: keyof Omit<FormState, "lines">) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm(prev => ({ ...prev, [key]: e.target.value }))
      if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
    }

  const setLine = (id: string, key: keyof Line) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm(prev => ({
        ...prev,
        lines: prev.lines.map(l =>
          l.id === id ? { ...l, [key]: key === "vat_rate" ? Number(e.target.value) as VatRate : e.target.value } : l
        ),
      }))
    }

  const addLine    = () => setForm(prev => ({ ...prev, lines: [...prev.lines, newLine()] }))
  const removeLine = (id: string) => setForm(prev => ({ ...prev, lines: prev.lines.filter(l => l.id !== id) }))

  // Insérer un produit du catalogue comme nouvelle ligne
  const insertFromProduct = (product: ProductSuggestion) => {
    const newL: Line = {
      id:            crypto.randomUUID(),
      description:   product.name + (product.description ? ` — ${product.description}` : ""),
      quantity:      "1",
      unit_price_ht: String(product.unit_price_ht),
      vat_rate:      product.vat_rate as VatRate,
    }
    setForm(prev => ({ ...prev, lines: [...prev.lines, newL] }))
  }

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
    if (!form.client_id)   errs.client_id   = "Client requis"
    if (!form.issue_date)  errs.issue_date   = "Date d'émission requise"
    if (!form.valid_until) errs.valid_until  = "Date de validité requise"
    form.lines.forEach((line, i) => {
      if (!line.description.trim()) errs[`line_${i}_desc`]  = "Description requise"
      if (!line.quantity || parseFloat(line.quantity) <= 0) errs[`line_${i}_qty`] = "Quantité invalide"
      if (line.unit_price_ht === "" || parseFloat(line.unit_price_ht) < 0) errs[`line_${i}_price`] = "Prix invalide"
    })
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const submit = async (action: "draft" | "send") => {
    if (!validate()) { toast.error("Corrigez les erreurs avant de continuer"); return }
    if (action === "send") setLoading(true); else setSaving(true)

    try {
      const enrichedLines = form.lines.map((line, i) => ({
        description:    line.description.trim(),
        quantity:       parseFloat(line.quantity) || 0,
        unit_price_ht:  parseFloat(line.unit_price_ht) || 0,
        vat_rate:       line.vat_rate,
        total_ht:       computedLines[i].totalHT,
        total_vat:      computedLines[i].totalVAT,
        total_ttc:      computedLines[i].totalTTC,
      }))

      const payload = {
        client_id:   form.client_id,
        issue_date:  form.issue_date,
        valid_until: form.valid_until,
        notes:       form.notes || null,
        lines:       enrichedLines,
        status:      action === "draft" ? "draft" : "sent",
      }

      const res  = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || "Erreur lors de la sauvegarde"); return }

      toast.success(action === "send" ? "Devis créé !" : "Brouillon sauvegardé !")
      router.push(`/quotes/${json.quote.id}`)
      router.refresh()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setLoading(false); setSaving(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* Client + dates */}
      <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Informations du devis</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <div className="md:col-span-1">
            <Label>Client *</Label>
            {clientsLoading ? (
              <div className="mt-1 w-full h-10 rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#162032] flex items-center px-3">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            ) : clients.length === 0 ? (
              <div className="mt-1 w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg bg-[#FEF3C7] text-[#92400E]">
                Aucun client — <a href="/clients/new" className="underline">Créer un client d&apos;abord</a>
              </div>
            ) : (
              <select
                value={form.client_id}
                onChange={setField("client_id")}
                className="mt-1 w-full px-3 py-2 text-sm border border-[#E2E8F0] dark:border-[#1E3A5F] rounded-lg bg-white dark:bg-[#162032] dark:text-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-[#0f9457]"
              >
                <option value="">Sélectionner un client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            {errors.client_id && <p className="text-xs text-red-500 mt-1">{errors.client_id}</p>}
          </div>

          <div>
            <Label>Date d&apos;émission *</Label>
            <Input type="date" className="mt-1 font-mono" value={form.issue_date} onChange={setField("issue_date")} />
            {errors.issue_date && <p className="text-xs text-red-500 mt-1">{errors.issue_date}</p>}
          </div>

          <div>
            <Label>Date de validité *</Label>
            <Input type="date" className="mt-1 font-mono" value={form.valid_until} onChange={setField("valid_until")} />
            {errors.valid_until && <p className="text-xs text-red-500 mt-1">{errors.valid_until}</p>}
          </div>

        </div>
      </div>

      {/* Lignes */}
      <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Prestations / Produits</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <ProductCombobox onSelect={insertFromProduct} />
            <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
            </Button>
          </div>
        </div>

        <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-slate-400 pb-1 border-b border-[#E2E8F0] dark:border-[#1E3A5F]">
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
                  <Input
                    placeholder="Description de la prestation"
                    className="text-sm"
                    value={line.description}
                    onChange={setLine(line.id, "description")}
                  />
                  {errors[`line_${index}_desc`] && <p className="text-xs text-red-500 mt-0.5">{errors[`line_${index}_desc`]}</p>}
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Input type="number" min="0" step="0.01" placeholder="1"
                    className="text-sm text-right font-mono" value={line.quantity}
                    onChange={setLine(line.id, "quantity")} />
                  {errors[`line_${index}_qty`] && <p className="text-xs text-red-500 mt-0.5">{errors[`line_${index}_qty`]}</p>}
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Input type="number" min="0" step="0.01" placeholder="0.00"
                    className="text-sm text-right font-mono" value={line.unit_price_ht}
                    onChange={setLine(line.id, "unit_price_ht")} />
                  {errors[`line_${index}_price`] && <p className="text-xs text-red-500 mt-0.5">{errors[`line_${index}_price`]}</p>}
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <select value={line.vat_rate} onChange={setLine(line.id, "vat_rate")}
                    className="w-full px-2 py-2 text-sm border border-[#E2E8F0] dark:border-[#1E3A5F] rounded-md bg-white dark:bg-[#162032] dark:text-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-[#0f9457] font-mono">
                    {VAT_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
                <div className="col-span-1 flex items-center justify-center">
                  {form.lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(line.id)}
                      className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              {hasValues && (
                <div className="flex justify-end text-xs text-slate-400 mt-1 pr-8">
                  HT : <span className="font-mono font-medium text-[#0F172A] dark:text-[#E2E8F0] mx-1">{formatCurrency(calc.totalHT)}</span>
                  {" · "}TVA : <span className="font-mono mx-1">{formatCurrency(calc.totalVAT)}</span>
                  {" · "}TTC : <span className="font-mono font-semibold text-[#0f9457] ml-1">{formatCurrency(calc.totalTTC)}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Notes + Récap */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-6 shadow-sm">
          <Label>Notes / conditions</Label>
          <textarea
            placeholder="Devis valable 30 jours. Acompte de 30% à la commande."
            rows={4}
            value={form.notes}
            onChange={setField("notes")}
            className="mt-2 w-full px-3 py-2 text-sm border border-[#E2E8F0] dark:border-[#1E3A5F] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#0f9457] text-slate-600 dark:text-slate-300 bg-white dark:bg-[#162032]"
          />
        </div>

        <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-6 shadow-sm">
          <h3 className="font-semibold text-[#0F172A] dark:text-[#E2E8F0] mb-4">Récapitulatif</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Sous-total HT</span>
              <span className="font-mono font-medium text-[#0F172A] dark:text-[#E2E8F0]">{formatCurrency(totals.subtotal_ht)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">TVA</span>
              <span className="font-mono text-slate-600">{formatCurrency(totals.total_vat)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span className="font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Total TTC</span>
              <span className="font-mono text-xl font-bold text-[#0f9457]">{formatCurrency(totals.total_ttc)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 pb-8">
        <Button type="button" variant="outline" disabled={saving} onClick={() => submit("draft")} className="gap-1.5 w-full sm:w-auto">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Sauvegarder en brouillon
        </Button>
        <Button
          type="button"
          className="bg-[#0f9457] hover:bg-[#0a7a47] text-white gap-1.5 w-full sm:w-auto sm:ml-auto"
          disabled={loading}
          onClick={() => submit("send")}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Envoyer le devis
        </Button>
      </div>
    </div>
  )
}
