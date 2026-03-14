'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Trash2, Loader2, Eye, Send, ChevronRight } from "lucide-react"
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
  client_id:  string
  issue_date: string
  due_date:   string
  notes:      string
  lines:      Line[]
}
interface Client { id: string; name: string }

const today    = new Date().toISOString().split("T")[0]
const in30days = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]
function newLine(): Line {
  return { id: crypto.randomUUID(), description: "", quantity: "1", unit_price_ht: "", vat_rate: 20 }
}

/* ── Styles partagés ── */
const cardStyle: React.CSSProperties = {
  background:           'var(--card-glass-bg)',
  backdropFilter:       'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  boxShadow:            '0 2px 16px rgba(37,99,235,0.06)',
}
const inputCls = "mt-1 w-full px-3 py-2.5 text-sm border border-[#E2E8F0] rounded-xl bg-white/80 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-shadow dark:bg-[#162032] dark:border-[#1E3A5F] dark:text-[#E2E8F0]"
const labelCls = "text-[12px] font-semibold text-slate-500 uppercase tracking-wide"

export default function NewInvoiceForm() {
  const router = useRouter()
  const [loading,        setLoading]        = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [previewing,     setPreviewing]     = useState(false)
  const [clients,        setClients]        = useState<Client[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [errors,         setErrors]         = useState<Record<string, string>>({})

  const [form, setForm] = useState<FormState>({
    client_id: "", issue_date: today, due_date: in30days, notes: "", lines: [newLine()],
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
        lines: prev.lines.map(l => l.id === id
          ? { ...l, [key]: key === "vat_rate" ? Number(e.target.value) as VatRate : e.target.value }
          : l)
      }))
    }

  const addLine = () => setForm(prev => ({ ...prev, lines: [...prev.lines, newLine()] }))
  const removeLine = (id: string) => setForm(prev => ({ ...prev, lines: prev.lines.filter(l => l.id !== id) }))

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
    if (!form.client_id)  errs.client_id  = "Client requis"
    if (!form.issue_date) errs.issue_date = "Date d'émission requise"
    if (!form.due_date)   errs.due_date   = "Date d'échéance requise"
    form.lines.forEach((line, i) => {
      if (!line.description.trim()) errs[`line_${i}_desc`]  = "Description requise"
      if (!line.quantity || parseFloat(line.quantity) <= 0)  errs[`line_${i}_qty`]   = "Quantité invalide"
      if (line.unit_price_ht === "" || parseFloat(line.unit_price_ht) < 0) errs[`line_${i}_price`] = "Prix invalide"
    })
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const previewPDF = async () => {
    if (!validate()) { toast.error("Corrigez les erreurs avant de continuer"); return }
    setPreviewing(true)
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
      const res = await fetch("/api/invoices", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: form.client_id, issue_date: form.issue_date,
          due_date: form.due_date, notes: form.notes || null,
          lines: enrichedLines, status: "draft",
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (res.status === 402 && json.code === "STARTER_LIMIT_REACHED") {
          toast.error(`Limite Starter atteinte (${json.invoicesThisMonth}/${json.limit} ce mois). Passez au plan Pro.`, {
            duration: 8000,
            action: { label: "Passer au Pro", onClick: () => window.location.href = "/settings/billing" },
          })
        } else {
          toast.error(json.error || "Erreur lors de la sauvegarde")
        }
        return
      }
      const invoiceId = json.invoice?.id
      window.open(`/api/invoices/${invoiceId}/pdf`, "_blank")
      toast.success("Brouillon sauvegardé — aperçu PDF ouvert dans un nouvel onglet")
      router.push(`/invoices/${invoiceId}`)
      router.refresh()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setPreviewing(false)
    }
  }

  const submit = async (action: "draft" | "send") => {
    if (!validate()) { toast.error("Corrigez les erreurs avant de continuer"); return }
    if (action === "send") setLoading(true); else setSaving(true)
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
        status:     action === "draft" ? "draft" : "sent",
      }
      const res  = await fetch("/api/invoices", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        if (res.status === 402 && json.code === "STARTER_LIMIT_REACHED") {
          toast.error(`Limite Starter atteinte (${json.invoicesThisMonth}/${json.limit} ce mois). Passez au plan Pro.`, {
            duration: 8000,
            action: { label: "Passer au Pro", onClick: () => window.location.href = "/settings/billing" },
          })
        } else {
          toast.error(json.error || "Erreur lors de la sauvegarde")
        }
        return
      }
      toast.success(action === "send" ? "Facture créée !" : "Brouillon sauvegardé !")
      router.push("/invoices")
      router.refresh()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setLoading(false); setSaving(false)
    }
  }

  return (
    <div className="space-y-4 max-w-[860px] mx-auto pb-8">

      {/* ── Infos de facturation ── */}
      <div className="rounded-2xl border border-white/60 p-5 space-y-4 dark:border-[#1E3A5F]" style={cardStyle}>
        <h2 className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0] flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] text-xs font-bold">1</span>
          Informations de facturation
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Client */}
          <div className="sm:col-span-1">
            <label className={labelCls}>Client *</label>
            {clientsLoading ? (
              <div className="mt-1 w-full h-11 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] flex items-center px-3 dark:border-[#1E3A5F] dark:bg-[#162032]">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            ) : clients.length === 0 ? (
              <div className="mt-1 w-full px-3 py-2.5 text-sm border border-[#FCD34D] rounded-xl bg-[#FFFBEB] text-[#92400E]">
                Aucun client —{" "}
                <a href="/clients/new" className="underline font-semibold text-[#D97706]">
                  Créer un client d&apos;abord
                </a>
              </div>
            ) : (
              <select
                value={form.client_id}
                onChange={setField("client_id")}
                className={`${inputCls} ${errors.client_id ? "border-red-400 ring-1 ring-red-400" : ""}`}
              >
                <option value="">Sélectionner un client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            {errors.client_id && <p className="text-xs text-red-500 mt-1">{errors.client_id}</p>}
          </div>

          {/* Date émission */}
          <div>
            <label className={labelCls}>Date d&apos;émission *</label>
            <input
              type="date"
              className={`${inputCls} font-mono ${errors.issue_date ? "border-red-400" : ""}`}
              value={form.issue_date}
              onChange={setField("issue_date")}
            />
            {errors.issue_date && <p className="text-xs text-red-500 mt-1">{errors.issue_date}</p>}
          </div>

          {/* Date échéance */}
          <div>
            <label className={labelCls}>Date d&apos;échéance *</label>
            <input
              type="date"
              className={`${inputCls} font-mono ${errors.due_date ? "border-red-400" : ""}`}
              value={form.due_date}
              onChange={setField("due_date")}
            />
            {errors.due_date && <p className="text-xs text-red-500 mt-1">{errors.due_date}</p>}
          </div>
        </div>
      </div>

      {/* ── Prestations ── */}
      <div className="rounded-2xl border border-white/60 p-5 space-y-4 dark:border-[#1E3A5F]" style={cardStyle}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0] flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] text-xs font-bold">2</span>
            Prestations
          </h2>
          <div className="flex items-center gap-2">
            <ProductCombobox onSelect={insertFromProduct} />
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors dark:bg-[#162032] dark:border-[#1E3A5F] dark:text-[#E2E8F0] dark:hover:bg-[#162032]/60"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter une ligne
            </button>
          </div>
        </div>

        {/* En-têtes desktop */}
        <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-1 border-b border-[#F1F5F9] dark:border-[#162032]">
          <div className="col-span-5">Description</div>
          <div className="col-span-2 text-right">Qté</div>
          <div className="col-span-2 text-right">Prix HT (€)</div>
          <div className="col-span-2 text-center">TVA</div>
          <div className="col-span-1" />
        </div>

        <div className="space-y-3">
          {form.lines.map((line, index) => {
            const calc      = computedLines[index]
            const hasValues = (parseFloat(line.quantity) > 0) && (parseFloat(line.unit_price_ht) > 0)
            return (
              <div
                key={line.id}
                className="rounded-xl border border-[#F1F5F9] p-3 sm:p-0 sm:border-0 sm:rounded-none bg-[#FAFBFC]/60 sm:bg-transparent dark:border-[#162032] dark:bg-[#162032]/40 sm:dark:bg-transparent"
              >
                <div className="grid grid-cols-12 gap-2 items-start">
                  {/* Description */}
                  <div className="col-span-12 sm:col-span-5">
                    <input
                      placeholder="Description de la prestation"
                      className={`${inputCls} ${errors[`line_${index}_desc`] ? "border-red-400" : ""}`}
                      value={line.description}
                      onChange={setLine(line.id, "description")}
                    />
                    {errors[`line_${index}_desc`] && (
                      <p className="text-xs text-red-500 mt-0.5">{errors[`line_${index}_desc`]}</p>
                    )}
                  </div>

                  {/* Qté */}
                  <div className="col-span-4 sm:col-span-2">
                    <label className="text-[10px] text-slate-400 sm:hidden block mb-0.5">Qté</label>
                    <input
                      type="number" min="0" step="0.01" placeholder="1"
                      className={`${inputCls} text-right font-mono ${errors[`line_${index}_qty`] ? "border-red-400" : ""}`}
                      value={line.quantity}
                      onChange={setLine(line.id, "quantity")}
                    />
                  </div>

                  {/* Prix HT */}
                  <div className="col-span-4 sm:col-span-2">
                    <label className="text-[10px] text-slate-400 sm:hidden block mb-0.5">Prix HT</label>
                    <input
                      type="number" min="0" step="0.01" placeholder="0.00"
                      className={`${inputCls} text-right font-mono ${errors[`line_${index}_price`] ? "border-red-400" : ""}`}
                      value={line.unit_price_ht}
                      onChange={setLine(line.id, "unit_price_ht")}
                    />
                  </div>

                  {/* TVA */}
                  <div className="col-span-3 sm:col-span-2">
                    <label className="text-[10px] text-slate-400 sm:hidden block mb-0.5">TVA</label>
                    <select
                      value={line.vat_rate}
                      onChange={setLine(line.id, "vat_rate")}
                      className={`${inputCls} font-mono`}
                    >
                      {VAT_RATES.map(rate => (
                        <option key={rate} value={rate}>{rate}%</option>
                      ))}
                    </select>
                  </div>

                  {/* Supprimer */}
                  <div className="col-span-1 flex items-center justify-center pt-1">
                    {form.lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(line.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Sous-total ligne */}
                {hasValues && (
                  <div className="flex justify-end text-xs text-slate-400 mt-2 gap-2 flex-wrap">
                    <span>HT : <span className="font-mono font-semibold text-[#0F172A] dark:text-[#E2E8F0]">{formatCurrency(calc.totalHT)}</span></span>
                    <span className="text-slate-200">·</span>
                    <span>TVA : <span className="font-mono">{formatCurrency(calc.totalVAT)}</span></span>
                    <span className="text-slate-200">·</span>
                    <span className="font-semibold text-[#0F172A] dark:text-[#E2E8F0]">TTC : <span className="font-mono">{formatCurrency(calc.totalTTC)}</span></span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Notes + Récap ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Notes */}
        <div className="rounded-2xl border border-white/60 p-5 dark:border-[#1E3A5F]" style={cardStyle}>
          <h2 className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0] mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] text-xs font-bold">3</span>
            Notes
          </h2>
          <textarea
            placeholder="Paiement par virement bancaire sous 30 jours. Pénalités de retard : 3 fois le taux légal."
            rows={4}
            value={form.notes}
            onChange={setField("notes")}
            className="w-full px-3 py-2.5 text-sm border border-[#E2E8F0] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-slate-600 bg-white/80 transition-shadow dark:bg-[#162032] dark:border-[#1E3A5F] dark:text-[#E2E8F0]"
          />
        </div>

        {/* Récap */}
        <div className="rounded-2xl border border-white/60 p-5 dark:border-[#1E3A5F]" style={cardStyle}>
          <h2 className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0] mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] text-xs font-bold">4</span>
            Récapitulatif
          </h2>
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Sous-total HT</span>
              <span className="font-mono font-semibold text-[#0F172A] dark:text-[#E2E8F0]">{formatCurrency(totals.subtotal_ht)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">TVA</span>
              <span className="font-mono text-slate-600">{formatCurrency(totals.total_vat)}</span>
            </div>
            <div className="h-px bg-[#E2E8F0] dark:bg-[#1E3A5F] my-1" />
            <div className="flex justify-between">
              <span className="font-bold text-[#0F172A] dark:text-[#E2E8F0]">Total TTC</span>
              <span className="font-mono text-2xl font-extrabold text-[#2563EB]">{formatCurrency(totals.total_ttc)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div
        className="rounded-2xl border border-white/60 p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 dark:border-[#1E3A5F]"
        style={cardStyle}
      >
        <button
          type="button"
          disabled={saving}
          onClick={() => submit("draft")}
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC] hover:border-slate-300 transition-colors disabled:opacity-50 w-full sm:w-auto dark:bg-[#162032] dark:border-[#1E3A5F] dark:text-[#E2E8F0] dark:hover:bg-[#162032]/60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Sauvegarder en brouillon
        </button>

        <button
          type="button"
          disabled={previewing}
          onClick={previewPDF}
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC] hover:border-slate-300 transition-colors disabled:opacity-50 w-full sm:w-auto dark:bg-[#162032] dark:border-[#1E3A5F] dark:text-[#E2E8F0] dark:hover:bg-[#162032]/60"
        >
          {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          Aperçu PDF
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => submit("send")}
          className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] rounded-xl transition-colors disabled:opacity-50 w-full sm:w-auto sm:ml-auto shadow-sm"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Envoyer la facture
          {!loading && <ChevronRight className="w-3.5 h-3.5 ml-0.5" />}
        </button>
      </div>

    </div>
  )
}
