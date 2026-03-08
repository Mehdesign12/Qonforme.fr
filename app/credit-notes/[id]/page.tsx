'use client'

export const dynamic = "force-dynamic"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft, Loader2, Download, Printer, RotateCcw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { formatCurrency, formatDate } from "@/lib/utils/invoice"

interface CreditNoteLine {
  description: string
  quantity: number
  unit_price_ht: number
  vat_rate: number
  total_ht: number
  total_vat: number
  total_ttc: number
}

interface CreditNote {
  id: string
  credit_note_number: string
  issue_date: string
  reason: string
  lines: CreditNoteLine[]
  subtotal_ht: number
  total_vat: number
  total_ttc: number
  created_at: string
  client: {
    id: string
    name: string
    email: string | null
    address: string | null
    zip_code: string | null
    city: string | null
    siren: string | null
    vat_number: string | null
  } | null
  original_invoice: {
    id: string
    invoice_number: string
    issue_date: string
    total_ttc: number
  } | null
}

export default function CreditNoteDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [creditNote, setCreditNote] = useState<CreditNote | null>(null)
  const [loading, setLoading]       = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/credit-notes/${params.id}`)
      .then(r => r.json())
      .then(json => {
        if (json.credit_note) setCreditNote(json.credit_note)
      })
      .finally(() => setLoading(false))
  }, [params.id])

  const downloadPDF = async () => {
    if (!creditNote) return
    setPdfLoading(true)
    try {
      const res = await fetch(`/api/credit-notes/${params.id}/pdf`)
      if (!res.ok) { toast.error("Erreur lors de la génération du PDF"); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url; a.download = `${creditNote.credit_note_number}.pdf`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
      toast.success("PDF téléchargé !")
    } catch { toast.error("Erreur lors du téléchargement") }
    finally { setPdfLoading(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 text-[#C2410C] animate-spin" />
    </div>
  )

  if (!creditNote) return (
    <div className="py-16 text-center space-y-3">
      <p className="text-slate-500">Avoir introuvable</p>
      <Link href="/credit-notes" className="text-[#2563EB] text-sm hover:underline">← Retour aux avoirs</Link>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/credit-notes")}>
            <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500 hover:text-slate-700">
              <ArrowLeft className="w-4 h-4" /> Avoirs
            </Button>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-[#FFF7ED] flex items-center justify-center">
              <RotateCcw className="w-3.5 h-3.5 text-[#C2410C]" />
            </div>
            <h1 className="text-xl font-bold text-[#0F172A] font-mono">{creditNote.credit_note_number}</h1>
          </div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]">
            Avoir
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadPDF} disabled={pdfLoading}>
            {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {pdfLoading ? "Génération…" : "Télécharger PDF"}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> Imprimer
          </Button>
        </div>
      </div>

      {/* Lien vers la facture originale */}
      {creditNote.original_invoice && (
        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-[#1E40AF]">Avoir sur la facture</p>
            <p className="text-sm font-bold font-mono text-[#2563EB] mt-0.5">
              {creditNote.original_invoice.invoice_number}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Montant original</p>
            <p className="text-sm font-mono font-semibold text-[#0F172A]">
              {formatCurrency(creditNote.original_invoice.total_ttc)}
            </p>
          </div>
          <Link href={`/invoices/${creditNote.original_invoice.id}`} className="shrink-0">
            <Button size="sm" variant="outline" className="border-[#93C5FD] text-[#2563EB] hover:bg-[#DBEAFE] gap-1.5">
              Voir la facture
            </Button>
          </Link>
        </div>
      )}

      {/* Corps de l'avoir */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">

        <div className="p-6 sm:p-8 border-b border-[#E2E8F0]">
          <div className="flex flex-wrap justify-between gap-6">
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">DE</p>
              <p className="text-sm font-bold text-[#0F172A]">Votre entreprise</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">POUR</p>
              {creditNote.client ? (
                <div>
                  <Link href={`/clients/${creditNote.client.id}`} className="text-sm font-bold text-[#2563EB] hover:underline">
                    {creditNote.client.name}
                  </Link>
                  {creditNote.client.siren && (
                    <p className="text-xs text-slate-400 font-mono mt-0.5">SIREN {creditNote.client.siren}</p>
                  )}
                  {creditNote.client.address && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {creditNote.client.address}<br />
                      {creditNote.client.zip_code} {creditNote.client.city}
                    </p>
                  )}
                </div>
              ) : <p className="text-sm text-slate-400">—</p>}
            </div>
            <div className="text-right">
              <div className="mb-3">
                <p className="text-xs font-medium text-slate-400">N° AVOIR</p>
                <p className="text-sm font-bold font-mono text-[#C2410C]">{creditNote.credit_note_number}</p>
              </div>
              <div className="mb-3">
                <p className="text-xs font-medium text-slate-400">DATE D&apos;ÉMISSION</p>
                <p className="text-sm text-[#0F172A]">{formatDate(creditNote.issue_date)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">MOTIF</p>
                <p className="text-sm text-slate-600">{creditNote.reason}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tableau lignes */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#FFF7ED]">
                <th className="text-left text-xs font-medium text-slate-400 px-6 py-3">Désignation</th>
                <th className="text-right text-xs font-medium text-slate-400 px-4 py-3">Qté</th>
                <th className="text-right text-xs font-medium text-slate-400 px-4 py-3">Prix unitaire HT</th>
                <th className="text-right text-xs font-medium text-slate-400 px-4 py-3">TVA</th>
                <th className="text-right text-xs font-medium text-slate-400 px-6 py-3">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {creditNote.lines?.map((line, i) => (
                <tr key={i} className="border-b border-[#F1F5F9] last:border-0">
                  <td className="px-6 py-4 text-sm text-[#0F172A]">{line.description}</td>
                  <td className="px-4 py-4 text-right text-sm font-mono text-slate-600">{line.quantity}</td>
                  <td className="px-4 py-4 text-right text-sm font-mono text-slate-600">{formatCurrency(line.unit_price_ht)}</td>
                  <td className="px-4 py-4 text-right text-sm font-mono text-slate-600">{line.vat_rate}%</td>
                  <td className="px-6 py-4 text-right text-sm font-mono font-semibold text-[#C2410C]">-{formatCurrency(line.total_ht)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totaux */}
        <div className="p-6 sm:p-8 border-t border-[#E2E8F0]">
          <div className="flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Sous-total HT</span>
                <span className="font-mono text-slate-600">-{formatCurrency(creditNote.subtotal_ht)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">TVA</span>
                <span className="font-mono text-slate-600">-{formatCurrency(creditNote.total_vat)}</span>
              </div>
              <Separator />
              <div className="flex justify-between pt-1">
                <span className="font-bold text-[#0F172A]">Total TTC de l&apos;avoir</span>
                <span className="font-mono text-lg font-bold text-[#C2410C]">-{formatCurrency(creditNote.total_ttc)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Infos techniques */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Créé le",   value: formatDate(creditNote.created_at) },
          { label: "Émis le",   value: formatDate(creditNote.issue_date) },
          { label: "Lignes",    value: `${creditNote.lines?.length ?? 0} ligne${(creditNote.lines?.length ?? 0) > 1 ? "s" : ""}` },
        ].map(item => (
          <div key={item.label} className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
            <p className="text-xs text-slate-400 mb-1">{item.label}</p>
            <p className="text-sm font-semibold text-[#0F172A]">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
