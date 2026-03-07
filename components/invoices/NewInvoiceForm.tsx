'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Plus, Trash2, Loader2, Eye, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { calculateLineTotals, calculateInvoiceTotals, formatCurrency, VAT_RATES } from "@/lib/utils/invoice"

const lineSchema = z.object({
  description: z.string().min(1, "Description requise"),
  quantity: z.coerce.number().positive("Quantité invalide"),
  unit_price_ht: z.coerce.number().nonnegative("Prix invalide"),
  vat_rate: z.coerce.number().refine((v) => [0, 5.5, 10, 20].includes(v)),
})

const invoiceSchema = z.object({
  client_id: z.string().min(1, "Client requis"),
  issue_date: z.string().min(1, "Date requise"),
  due_date: z.string().min(1, "Échéance requise"),
  lines: z.array(lineSchema).min(1, "Au moins une prestation"),
  notes: z.string().optional(),
})

type FormData = {
  client_id: string
  issue_date: string
  due_date: string
  lines: { description: string; quantity: number; unit_price_ht: number; vat_rate: number }[]
  notes?: string
}

interface Client {
  id: string
  name: string
}

const today = new Date().toISOString().split("T")[0]
const in30days = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]

export default function NewInvoiceForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)

  // Charger les clients depuis l'API
  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((json) => {
        if (json.clients) setClients(json.clients)
      })
      .finally(() => setClientsLoading(false))
  }, [])

  const { register, handleSubmit, watch, control, formState: { errors } } = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(invoiceSchema) as any,
    defaultValues: {
      issue_date: today,
      due_date: in30days,
      lines: [{ description: "", quantity: 1, unit_price_ht: 0, vat_rate: 20 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "lines" })
  const lines = watch("lines")

  // Calcul des totaux en temps réel
  const computedLines = lines.map((line) =>
    calculateLineTotals(
      Number(line.quantity) || 0,
      Number(line.unit_price_ht) || 0,
      (Number(line.vat_rate) || 20) as 0 | 5.5 | 10 | 20
    )
  )
  const totals = calculateInvoiceTotals(
    computedLines.map((l) => ({ total_ht: l.totalHT, total_vat: l.totalVAT, total_ttc: l.totalTTC }))
  )

  const onSubmit = async (data: FormData, action: "draft" | "send") => {
    if (action === "send") setLoading(true)
    else setSaving(true)
    try {
      // Enrichir les lignes avec les totaux calculés
      const enrichedLines = data.lines.map((line, i) => ({
        ...line,
        quantity: Number(line.quantity),
        unit_price_ht: Number(line.unit_price_ht),
        vat_rate: Number(line.vat_rate),
        total_ht: computedLines[i]?.totalHT || 0,
        total_vat: computedLines[i]?.totalVAT || 0,
        total_ttc: computedLines[i]?.totalTTC || 0,
      }))

      const payload = {
        ...data,
        lines: enrichedLines,
        status: action === "draft" ? "draft" : "sent",
      }

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error || "Erreur lors de la sauvegarde")
        return
      }

      toast.success(action === "send" ? "Facture créée et envoyée !" : "Brouillon sauvegardé")
      router.push("/invoices")
      router.refresh()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setLoading(false)
      setSaving(false)
    }
  }

  return (
    <form className="space-y-6">
      {/* Section client + dates */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-[#0F172A]">Informations de facturation</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <Label>Client *</Label>
            {clientsLoading ? (
              <div className="mt-1 w-full h-10 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-center px-3">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            ) : clients.length === 0 ? (
              <div className="mt-1">
                <div className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg bg-[#FEF3C7] text-[#92400E]">
                  Aucun client — <a href="/clients/new" className="underline">Créer un client d&apos;abord</a>
                </div>
              </div>
            ) : (
              <select
                {...register("client_id")}
                className="mt-1 w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                <option value="">Sélectionner un client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            {errors.client_id && <p className="text-xs text-red-500 mt-1">{errors.client_id.message}</p>}
          </div>
          <div>
            <Label>Date d&apos;émission *</Label>
            <Input type="date" className="mt-1 font-mono" {...register("issue_date")} />
          </div>
          <div>
            <Label>Date d&apos;échéance *</Label>
            <Input type="date" className="mt-1 font-mono" {...register("due_date")} />
          </div>
        </div>
      </div>

      {/* Lignes de prestation */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[#0F172A]">Prestations</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ description: "", quantity: 1, unit_price_ht: 0, vat_rate: 20 })}
            className="gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter une ligne
          </Button>
        </div>

        {/* Header colonnes */}
        <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-slate-400 pb-1 border-b border-[#E2E8F0]">
          <div className="col-span-5">Description</div>
          <div className="col-span-2 text-right">Qté</div>
          <div className="col-span-2 text-right">Prix HT (€)</div>
          <div className="col-span-2 text-center">TVA</div>
          <div className="col-span-1" />
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
            <div className="col-span-12 sm:col-span-5">
              <Input
                placeholder="Description de la prestation"
                className="text-sm"
                {...register(`lines.${index}.description`)}
              />
            </div>
            <div className="col-span-4 sm:col-span-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="1"
                className="text-sm text-right font-mono"
                {...register(`lines.${index}.quantity`)}
              />
            </div>
            <div className="col-span-4 sm:col-span-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="text-sm text-right font-mono"
                {...register(`lines.${index}.unit_price_ht`)}
              />
            </div>
            <div className="col-span-3 sm:col-span-2">
              <select
                {...register(`lines.${index}.vat_rate`)}
                className="w-full px-2 py-2 text-sm border border-[#E2E8F0] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] font-mono"
              >
                {VAT_RATES.map((rate) => (
                  <option key={rate} value={rate}>{rate}%</option>
                ))}
              </select>
            </div>
            <div className="col-span-1 flex items-center justify-center">
              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Sous-total ligne */}
            {(Number(lines[index]?.quantity) > 0 && Number(lines[index]?.unit_price_ht) > 0) && (
              <div className="col-span-12 flex justify-end text-xs text-slate-400">
                <span>
                  HT : <span className="font-mono font-medium text-[#0F172A]">{formatCurrency(computedLines[index]?.totalHT ?? 0)}</span>
                  {" · "}
                  TVA : <span className="font-mono">{formatCurrency(computedLines[index]?.totalVAT ?? 0)}</span>
                  {" · "}
                  TTC : <span className="font-mono font-semibold text-[#0F172A]">{formatCurrency(computedLines[index]?.totalTTC ?? 0)}</span>
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Totaux + notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Notes */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
          <Label>Notes / conditions de paiement</Label>
          <textarea
            {...register("notes")}
            placeholder="Paiement par virement bancaire sous 30 jours. Pénalités de retard : 3 fois le taux légal."
            rows={4}
            className="mt-2 w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-slate-600"
          />
        </div>

        {/* Récapitulatif */}
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
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={handleSubmit((data) => onSubmit(data, "draft"))}
          className="gap-1.5"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Sauvegarder en brouillon
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-1.5"
        >
          <Eye className="w-4 h-4" />
          Aperçu PDF
        </Button>
        <Button
          type="button"
          className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-1.5 ml-auto"
          disabled={loading}
          onClick={handleSubmit((data) => onSubmit(data, "send"))}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Envoyer la facture
        </Button>
      </div>
    </form>
  )
}
