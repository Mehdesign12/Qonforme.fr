'use client'

export const dynamic = "force-dynamic"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft, Loader2, Download, Printer, RotateCcw, Send, X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
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
  const [company, setCompany]       = useState<{ name: string; address?: string | null; zip_code?: string | null; city?: string | null; siret?: string | null; siren?: string | null; vat_number?: string | null } | null>(null)
  const [loading, setLoading]       = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendLoading, setSendLoading]     = useState(false)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      fetch(`/api/credit-notes/${params.id}`).then(r => r.json()),
      supabase.from("companies").select("name,address,zip_code,city,siret,siren,vat_number").single(),
    ]).then(([json, { data: comp }]) => {
      if (json.credit_note) setCreditNote(json.credit_note)
      if (comp) setCompany(comp)
    }).finally(() => setLoading(false))
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

  const sendByEmail = async () => {
    if (!creditNote) return
    setSendLoading(true)
    try {
      const res  = await fetch(`/api/credit-notes/${params.id}/send`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Erreur lors de l'envoi"); return }
      toast.success(`Avoir envoyé à ${json.sentTo}`)
      setShowSendModal(false)
    } catch { toast.error("Erreur réseau") }
    finally { setSendLoading(false) }
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
    <>
    {/* Modal envoi email */}
    {showSendModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between p-6 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#FFF7ED] flex items-center justify-center">
                <Send className="w-4 h-4 text-[#C2410C]" />
              </div>
              <div>
                <h2 className="font-bold text-[#0F172A] text-sm">Envoyer l&apos;avoir</h2>
                <p className="text-xs text-slate-400">{creditNote?.credit_note_number}</p>
              </div>
            </div>
            <button onClick={() => setShowSendModal(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-xl p-4">
              <p className="text-sm text-[#9A3412] font-medium mb-1">Destinataire</p>
              <p className="text-sm text-[#1E293B]">{creditNote?.client?.name}</p>
              {creditNote?.client?.email
                ? <p className="text-xs text-[#C2410C] font-mono mt-0.5">{creditNote.client.email}</p>
                : <p className="text-xs text-red-500 mt-0.5">Aucune adresse email — ajoutez-en une dans la fiche client</p>
              }
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              L&apos;avoir <strong>{creditNote?.credit_note_number}</strong> sera envoyé avec le PDF en pièce jointe.
            </p>
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
              <p className="text-xs text-slate-500">Objet : <span className="font-medium text-slate-700">Avoir {creditNote?.credit_note_number} — votre entreprise</span></p>
            </div>
          </div>
          <div className="flex gap-3 p-6 pt-0">
            <Button variant="outline" className="flex-1" onClick={() => setShowSendModal(false)} disabled={sendLoading}>
              Annuler
            </Button>
            <Button
              className="flex-1 bg-[#C2410C] hover:bg-[#9A3412] text-white gap-2"
              onClick={sendByEmail}
              disabled={sendLoading || !creditNote?.client?.email}
            >
              {sendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sendLoading ? "Envoi en cours…" : "Envoyer"}
            </Button>
          </div>
        </div>
      </div>
    )}
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
          {/* Bouton Envoyer par email */}
          {creditNote.client?.email && (
            <Button
              size="sm"
              className="gap-1.5 bg-[#C2410C] hover:bg-[#9A3412] text-white"
              onClick={() => setShowSendModal(true)}
              disabled={sendLoading}
            >
              <Send className="w-4 h-4" />
              Envoyer par email
            </Button>
          )}
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
              {company ? (
                <div>
                  <p className="text-sm font-bold text-[#0F172A]">{company.name}</p>
                  {company.address && <p className="text-xs text-slate-500 mt-0.5">{company.address}</p>}
                  {(company.zip_code || company.city) && (
                    <p className="text-xs text-slate-500">{[company.zip_code, company.city].filter(Boolean).join(" ")}</p>
                  )}
                  {(company.siret || company.siren) && (
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      {company.siret ? `SIRET ${company.siret}` : `SIREN ${company.siren}`}
                    </p>
                  )}
                  {company.vat_number && (
                    <p className="text-xs text-slate-400 font-mono">TVA {company.vat_number}</p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-sm font-bold text-[#0F172A]">Votre entreprise</p>
                  <p className="text-xs text-slate-500 mt-0.5">Complétez dans Paramètres → Entreprise</p>
                </div>
              )}
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
    </>
  )
}
