'use client'

import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { useState } from "react"
import { Plus, Trash2, Eye, Send, Lock, Lightbulb, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { calculateLineTotals, calculateInvoiceTotals, formatCurrency, VAT_RATES } from "@/lib/utils/invoice"
import Link from "next/link"

const lineSchema = z.object({
  description: z.string().min(1, "Description requise"),
  quantity: z.number().positive("Quantité invalide"),
  unit_price_ht: z.number().nonnegative("Prix invalide"),
  vat_rate: z.number().refine((v) => [0, 5.5, 10, 20].includes(v)),
})

const invoiceSchema = z.object({
  client_id: z.string().min(1, "Client requis"),
  issue_date: z.string().min(1),
  due_date: z.string().min(1),
  lines: z.array(lineSchema).min(1),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof invoiceSchema>

const MOCK_CLIENTS = [
  { id: "1", name: "Renovbat SARL" },
  { id: "2", name: "Martin Plomberie" },
  { id: "3", name: "Électricité Dupont" },
  { id: "4", name: "Maçonnerie Bernard" },
]

const today = new Date().toISOString().split("T")[0]
const in30days = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]

export default function DemoInvoiceForm() {
  const { register, watch, control } = useForm<FormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      client_id: "1",
      issue_date: today,
      due_date: in30days,
      lines: [
        { description: "Travaux de rénovation intérieure", quantity: 1, unit_price_ht: 1500, vat_rate: 20 },
        { description: "Fournitures et matériaux", quantity: 3, unit_price_ht: 250, vat_rate: 20 },
      ],
      notes: "Paiement par virement bancaire sous 30 jours.\nPénalités de retard : 3 fois le taux légal en vigueur.",
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "lines" })
  const lines = watch("lines")

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

  const handleDemoAction = () => {
    toast.info("Fonctionnalité disponible après inscription", {
      description: "Crée ton compte pour envoyer de vraies factures.",
      action: { label: "Créer mon compte", onClick: () => window.location.href = "/signup" },
    })
  }

  const [tipDismissed, setTipDismissed] = useState(false)

  return (
    <div>

      {/* ── Tip identité — mobile ── */}
      {!tipDismissed && (
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 mb-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
          <Lightbulb className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA] shrink-0" />
          <p className="text-[13px] text-slate-600 dark:text-slate-300 flex-1">
            <Link href="/signup" className="font-semibold text-[#2563EB] dark:text-[#60A5FA] hover:underline">
              Cr&eacute;ez votre compte
            </Link>
            {" "}pour personnaliser vos factures avec votre logo.
          </p>
          <button onClick={() => setTipDismissed(true)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex gap-6">
      {/* ── Colonne formulaire — prend tout l'espace ── */}
      <div className="flex-1 min-w-0 space-y-6">

      {/* Bandeau démo */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-amber-700 dark:text-amber-300">
            <span className="font-semibold">Mode démo</span> — Tu peux explorer le formulaire mais l&apos;envoi est désactivé.
          </span>
        </div>
        <Link href="/signup" className="text-xs font-semibold text-[#2563EB] hover:underline whitespace-nowrap">
          Créer mon compte →
        </Link>
      </div>

      {/* Section client + dates */}
      <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Informations de facturation</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <Label>Client *</Label>
            <select
              {...register("client_id")}
              className="mt-1 w-full px-3 py-2 text-sm border border-[#E2E8F0] dark:border-[#1E3A5F] rounded-lg bg-white dark:bg-[#162032] dark:text-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              {MOCK_CLIENTS.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Date d&apos;émission</Label>
            <Input type="date" className="mt-1 font-mono" {...register("issue_date")} />
          </div>
          <div>
            <Label>Date d&apos;échéance</Label>
            <Input type="date" className="mt-1 font-mono" {...register("due_date")} />
          </div>
        </div>
      </div>

      {/* Lignes */}
      <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Prestations</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ description: "", quantity: 1, unit_price_ht: 0, vat_rate: 20 })}
            className="gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
          </Button>
        </div>

        <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-400 pb-1 border-b border-[#E2E8F0] dark:border-[#1E3A5F]">
          <div className="col-span-5">Description</div>
          <div className="col-span-2 text-right">Qté</div>
          <div className="col-span-2 text-right">Prix HT (€)</div>
          <div className="col-span-2 text-center">TVA</div>
          <div className="col-span-1" />
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
            <div className="col-span-5">
              <Input placeholder="Description" className="text-sm" {...register(`lines.${index}.description`)} />
            </div>
            <div className="col-span-2">
              <Input type="number" min="0" step="0.01" className="text-sm text-right font-mono" {...register(`lines.${index}.quantity`)} />
            </div>
            <div className="col-span-2">
              <Input type="number" min="0" step="0.01" className="text-sm text-right font-mono" {...register(`lines.${index}.unit_price_ht`)} />
            </div>
            <div className="col-span-2">
              <select
                {...register(`lines.${index}.vat_rate`)}
                className="w-full px-2 py-2 text-sm border border-[#E2E8F0] dark:border-[#1E3A5F] rounded-md bg-white dark:bg-[#162032] dark:text-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-[#2563EB] font-mono"
              >
                {VAT_RATES.map((rate) => (
                  <option key={rate} value={rate}>{rate}%</option>
                ))}
              </select>
            </div>
            <div className="col-span-1 flex items-center justify-center">
              {fields.length > 1 && (
                <button type="button" onClick={() => remove(index)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            {(Number(lines[index]?.quantity) > 0 && Number(lines[index]?.unit_price_ht) > 0) && (
              <div className="col-span-12 flex justify-end text-xs text-slate-400">
                HT : <span className="font-mono font-medium text-[#0F172A] dark:text-[#E2E8F0] mx-1">{formatCurrency(computedLines[index]?.totalHT ?? 0)}</span>
                · TVA : <span className="font-mono mx-1">{formatCurrency(computedLines[index]?.totalVAT ?? 0)}</span>
                · TTC : <span className="font-mono font-semibold text-[#0F172A] ml-1">{formatCurrency(computedLines[index]?.totalTTC ?? 0)}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Totaux + notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-6 shadow-sm">
          <Label>Notes / conditions de paiement</Label>
          <textarea
            {...register("notes")}
            rows={4}
            className="mt-2 w-full px-3 py-2 text-sm border border-[#E2E8F0] dark:border-[#1E3A5F] rounded-lg resize-none bg-white dark:bg-[#162032] dark:text-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-slate-600"
          />
        </div>
        <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-6 shadow-sm">
          <h3 className="font-semibold text-[#0F172A] mb-4">Récapitulatif</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Sous-total HT</span>
              <span className="font-mono font-medium text-[#0F172A] dark:text-[#E2E8F0]">{formatCurrency(totals.subtotal_ht)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">TVA</span>
              <span className="font-mono text-slate-600 dark:text-slate-400">{formatCurrency(totals.total_vat)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span className="font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Total TTC</span>
              <span className="font-mono text-xl font-bold text-[#2563EB]">{formatCurrency(totals.total_ttc)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions — désactivées en démo */}
      <div className="flex items-center gap-3 pb-8">
        <Button type="button" variant="outline" onClick={handleDemoAction} className="gap-1.5">
          Sauvegarder en brouillon
        </Button>
        <Button type="button" variant="outline" onClick={handleDemoAction} className="gap-1.5">
          <Eye className="w-4 h-4" /> Aperçu PDF
        </Button>
        <Button
          type="button"
          className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-1.5 ml-auto"
          onClick={handleDemoAction}
        >
          <Send className="w-4 h-4" />
          Envoyer la facture
        </Button>
      </div>

      </div>{/* fin colonne formulaire */}

      {/* ── Tip identité — desktop (aside sticky) ── */}
      {!tipDismissed && (
        <aside className="hidden lg:block w-[260px] flex-shrink-0 pt-1">
          <div className="sticky top-24 rounded-2xl border border-blue-100 dark:border-blue-900/50 bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/30 dark:to-[#0B1120] p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="w-8 h-8 rounded-lg bg-[#2563EB]/10 dark:bg-[#2563EB]/20 flex items-center justify-center">
                <Lightbulb className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
              </div>
              <button onClick={() => setTipDismissed(true)} className="p-1 -mt-1 -mr-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-[#0F172A] dark:text-[#E2E8F0]">
                Personnalisez vos documents
              </h3>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Ajoutez votre logo et vos informations pour des factures professionnelles.
              </p>
            </div>
            <Link
              href="/signup"
              className="flex items-center justify-center gap-2 w-full px-3 py-2 text-[12px] font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl transition-colors shadow-sm"
            >
              Cr&eacute;er mon compte
            </Link>
          </div>
        </aside>
      )}

      </div>{/* fin flex row */}
    </div>
  )
}
