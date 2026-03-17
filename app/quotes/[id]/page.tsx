'use client'

export const dynamic = "force-dynamic"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft, Loader2, Send, CheckCircle2, XCircle,
  Printer, Trash2, Download, AlertTriangle, FileText, RotateCcw, Pencil, X,
} from "lucide-react"
import { Button }    from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { formatCurrency, formatDate } from "@/lib/utils/invoice"
import { createClient } from "@/lib/supabase/client"

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired"

interface QuoteLine {
  description: string
  quantity: number
  unit_price_ht: number
  vat_rate: number
  total_ht: number
  total_ttc: number
}

interface Quote {
  id: string
  quote_number: string
  status: QuoteStatus
  issue_date: string
  valid_until: string
  lines: QuoteLine[]
  subtotal_ht: number
  total_vat: number
  total_ttc: number
  notes: string | null
  converted_invoice_id: string | null
  created_at: string
  client: {
    id: string
    name: string
    email: string | null
    address: string | null
    zip_code: string | null
    city: string | null
    siren: string | null
  } | null
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const STATUS_BADGE: Record<QuoteStatus, string> = {
  draft:    "bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]",
  sent:     "bg-[#DBEAFE] text-[#1E40AF] border-[#93C5FD]",
  accepted: "bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]",
  rejected: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
  expired:  "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
}

const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft:    "Brouillon",
  sent:     "Envoyé",
  accepted: "Accepté",
  rejected: "Refusé",
  expired:  "Expiré",
}

const NEXT_ACTIONS: Partial<Record<QuoteStatus, { label: string; status: QuoteStatus; icon: React.ElementType; variant: "default" | "outline"; className?: string }[]>> = {
  draft: [
    { label: "Marquer comme envoyé", status: "sent", icon: Send, variant: "default", className: "bg-[#0f9457] hover:bg-[#0a7a47] text-white" },
  ],
  sent: [
    { label: "Accepté par le client",  status: "accepted", icon: CheckCircle2, variant: "default", className: "bg-[#0f9457] hover:bg-[#0a7a47] text-white" },
    { label: "Refusé par le client",   status: "rejected", icon: XCircle,      variant: "outline" },
  ],
}

/* ------------------------------------------------------------------ */
/* Composant                                                            */
/* ------------------------------------------------------------------ */

export default function QuoteDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [quote, setQuote]               = useState<Quote | null>(null)
  const [company, setCompany]           = useState<{ name: string; address?: string | null; zip_code?: string | null; city?: string | null; siret?: string | null; siren?: string | null; vat_number?: string | null } | null>(null)
  const [loading, setLoading]           = useState(true)
  const [statusLoading, setStatusLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [pdfLoading, setPdfLoading]     = useState(false)
  const [convertLoading, setConvertLoading] = useState(false)
  const [showSendModal, setShowSendModal]   = useState(false)
  const [sendLoading, setSendLoading]       = useState(false)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      fetch(`/api/quotes/${params.id}`).then(r => r.json()),
      supabase.from("companies").select("name,address,zip_code,city,siret,siren,vat_number").single(),
    ]).then(([json, { data: comp }]) => {
      if (json.quote) setQuote(json.quote)
      if (comp) setCompany(comp)
    }).finally(() => setLoading(false))
  }, [params.id])

  const changeStatus = async (newStatus: QuoteStatus) => {
    if (!quote) return
    setStatusLoading(true)
    try {
      const res  = await fetch(`/api/quotes/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      setQuote(json.quote)
      toast.success(`Statut mis à jour : ${STATUS_LABELS[newStatus]}`)
    } catch { toast.error("Erreur réseau") }
    finally { setStatusLoading(false) }
  }

  const downloadPDF = async () => {
    if (!quote) return
    setPdfLoading(true)
    try {
      const res = await fetch(`/api/quotes/${params.id}/pdf`)
      if (!res.ok) { toast.error("Erreur lors de la génération du PDF"); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url; a.download = `${quote.quote_number}.pdf`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
      toast.success("PDF téléchargé !")
    } catch { toast.error("Erreur lors du téléchargement") }
    finally { setPdfLoading(false) }
  }

  const deleteQuote = async () => {
    if (!quote || !confirm(`Supprimer le brouillon ${quote.quote_number} ?`)) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/quotes/${params.id}`, { method: "DELETE" })
      if (res.ok) { toast.success("Brouillon supprimé"); router.push("/quotes") }
      else { const json = await res.json(); toast.error(json.error) }
    } catch { toast.error("Erreur réseau") }
    finally { setDeleteLoading(false) }
  }

  const sendByEmail = async () => {
    if (!quote) return
    setSendLoading(true)
    try {
      const res  = await fetch(`/api/quotes/${params.id}/send`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Erreur lors de l'envoi"); return }
      setQuote({ ...quote, status: "sent" as QuoteStatus })
      toast.success(`Devis envoyé à ${json.sentTo}`)
      setShowSendModal(false)
    } catch { toast.error("Erreur réseau") }
    finally { setSendLoading(false) }
  }

  const convertToInvoice = async () => {
    if (!quote || !confirm("Convertir ce devis en facture brouillon ?")) return
    setConvertLoading(true)
    try {
      const res  = await fetch(`/api/quotes/${params.id}/convert`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success("Devis converti en facture !")
      router.push(`/invoices/${json.invoice.id}`)
    } catch { toast.error("Erreur réseau") }
    finally { setConvertLoading(false) }
  }

  /* ── Render ── */
  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 text-[#0f9457] animate-spin" />
    </div>
  )

  if (!quote) return (
    <div className="py-16 text-center space-y-3">
      <p className="text-slate-500">Devis introuvable</p>
      <Link href="/quotes" className="text-[#0f9457] text-sm hover:underline">← Retour aux devis</Link>
    </div>
  )

  const actions    = NEXT_ACTIONS[quote.status] ?? []
  const isExpired  = quote.status === "sent" && new Date(quote.valid_until) < new Date()
  const canConvert = (quote.status === "accepted" || quote.status === "sent") && !quote.converted_invoice_id

  return (
    <>
    {/* Modal envoi email */}
    {showSendModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 md:backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between p-5 sm:p-6 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                <Send className="w-4 h-4 text-[#0f9457]" />
              </div>
              <div>
                <h2 className="font-bold text-[#0F172A] text-sm">Envoyer le devis</h2>
                <p className="text-xs text-slate-400">{quote?.quote_number}</p>
              </div>
            </div>
            <button onClick={() => setShowSendModal(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div className="p-5 sm:p-6 space-y-4">
            <div className="bg-[#F0FDF4] border border-[#86EFAC] rounded-xl p-4">
              <p className="text-sm text-[#166534] font-medium mb-1">Destinataire</p>
              <p className="text-sm text-[#1E293B]">{quote?.client?.name}</p>
              {quote?.client?.email
                ? <p className="text-xs text-[#0f9457] font-mono mt-0.5">{quote.client.email}</p>
                : <p className="text-xs text-red-500 mt-0.5">Aucune adresse email — ajoutez-en une dans la fiche client</p>
              }
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Le devis <strong>{quote?.quote_number}</strong> sera envoyé avec le PDF en pièce jointe.
              Le statut passera automatiquement à <strong>Envoyé</strong>.
            </p>
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
              <p className="text-xs text-slate-500">Objet : <span className="font-medium text-slate-700">Devis {quote?.quote_number} — votre entreprise</span></p>
            </div>
          </div>
          <div className="flex gap-3 p-5 sm:p-6 pt-0" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}>
            <Button variant="outline" className="flex-1" onClick={() => setShowSendModal(false)} disabled={sendLoading}>
              Annuler
            </Button>
            <Button
              className="flex-1 bg-[#0f9457] hover:bg-[#0a7a47] text-white gap-2"
              onClick={sendByEmail}
              disabled={sendLoading || !quote?.client?.email}
            >
              {sendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sendLoading ? "Envoi…" : "Envoyer"}
            </Button>
          </div>
        </div>
      </div>
    )}

    <div className="space-y-4 sm:space-y-6 max-w-4xl">

      {/* Header — retour + numéro + badge */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/quotes">
            <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500 hover:text-slate-700 -ml-2">
              <ArrowLeft className="w-4 h-4" /> Devis
            </Button>
          </Link>
          <h1 className="text-lg sm:text-xl font-bold text-[#0F172A] font-mono">{quote.quote_number}</h1>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[quote.status]}`}>
            {STATUS_LABELS[quote.status]}
          </span>
        </div>

        {/* Boutons d'action — scroll horizontal sur mobile */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={downloadPDF} disabled={pdfLoading}>
            {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span className="hidden xs:inline">{pdfLoading ? "Génération…" : "PDF"}</span>
          </Button>

          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            <span className="hidden xs:inline">Imprimer</span>
          </Button>

          {quote.status === "draft" && (
            <Link href={`/quotes/${params.id}/edit`} className="shrink-0">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Pencil className="w-4 h-4" /> Modifier
              </Button>
            </Link>
          )}

          {quote.status === "draft" && (
            <Button variant="outline" size="sm"
              className="gap-1.5 shrink-0 border-[#FCA5A5] text-[#991B1B] hover:bg-[#FEE2E2]"
              onClick={deleteQuote} disabled={deleteLoading}>
              {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span className="hidden xs:inline">Supprimer</span>
            </Button>
          )}

          {canConvert && (
            <Button size="sm"
              className="gap-1.5 shrink-0 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
              onClick={convertToInvoice} disabled={convertLoading}>
              {convertLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              <span>{convertLoading ? "Conversion…" : "Convertir en facture"}</span>
            </Button>
          )}

          {quote.status === "draft" && quote.client?.email && (
            <Button size="sm"
              className="gap-1.5 shrink-0 bg-[#0f9457] hover:bg-[#0a7a47] text-white"
              onClick={() => setShowSendModal(true)}
              disabled={sendLoading}>
              <Send className="w-4 h-4" />
              Envoyer par email
            </Button>
          )}

          {actions.filter(a => a.status !== "sent" || quote.status !== "draft").map(action => (
            <Button key={action.status} variant={action.variant} size="sm"
              className={`gap-1.5 shrink-0 ${action.className ?? ""}`}
              onClick={() => changeStatus(action.status)} disabled={statusLoading}>
              {statusLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <action.icon className="w-4 h-4" />}
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Alerte expiré */}
      {isExpired && (
        <div className="bg-[#FEF3C7] border border-[#FCD34D] rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
          <p className="text-sm text-[#92400E]">
            Ce devis a <strong>expiré</strong> le {formatDate(quote.valid_until)}. Pensez à renouveler sa validité.
          </p>
        </div>
      )}

      {/* Devis déjà converti */}
      {quote.converted_invoice_id && (
        <div className="bg-[#D1FAE5] border border-[#6EE7B7] rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <RotateCcw className="w-5 h-5 text-[#065F46] shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#065F46]">Ce devis a été converti en facture</p>
              <p className="text-xs text-[#047857] mt-0.5">La facture correspondante est disponible dans la section Factures.</p>
            </div>
          </div>
          <Link href={`/invoices/${quote.converted_invoice_id}`} className="shrink-0">
            <Button size="sm" variant="outline" className="border-[#6EE7B7] text-[#065F46] hover:bg-[#D1FAE5] gap-1.5">
              <FileText className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Voir la facture</span>
            </Button>
          </Link>
        </div>
      )}

      {/* Corps devis */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">

        {/* En-tête DE / POUR / Numéros — empilé sur mobile */}
        <div className="p-4 sm:p-8 border-b border-[#E2E8F0]">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {/* DE */}
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1 uppercase tracking-wide">De</p>
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

            {/* POUR */}
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1 uppercase tracking-wide">Pour</p>
              {quote.client ? (
                <div>
                  <Link href={`/clients/${quote.client.id}`} className="text-sm font-bold text-[#2563EB] hover:underline">
                    {quote.client.name}
                  </Link>
                  {quote.client.siren && (
                    <p className="text-xs text-slate-400 font-mono mt-0.5">SIREN {quote.client.siren}</p>
                  )}
                  {quote.client.address && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {quote.client.address}<br />
                      {quote.client.zip_code} {quote.client.city}
                    </p>
                  )}
                </div>
              ) : <p className="text-sm text-slate-400">—</p>}
            </div>

            {/* Numéros */}
            <div className="sm:text-right">
              <div className="mb-3">
                <p className="text-xs font-medium text-slate-400 uppercase">N° Devis</p>
                <p className="text-sm font-bold font-mono text-[#0f9457]">{quote.quote_number}</p>
              </div>
              <div className="mb-3">
                <p className="text-xs font-medium text-slate-400 uppercase">Émission</p>
                <p className="text-sm text-[#0F172A]">{formatDate(quote.issue_date)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase">Valable jusqu&apos;au</p>
                <p className={`text-sm font-medium ${isExpired ? "text-[#EF4444]" : "text-[#0F172A]"}`}>
                  {formatDate(quote.valid_until)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tableau lignes — mobile : cards empilées */}
        <div className="block sm:hidden divide-y divide-[#F1F5F9]">
          {quote.lines?.map((line, i) => (
            <div key={i} className="px-4 py-3">
              <p className="text-sm font-medium text-[#0F172A] mb-1">{line.description}</p>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{line.quantity} × {formatCurrency(line.unit_price_ht)} HT · TVA {line.vat_rate}%</span>
                <span className="font-mono font-semibold text-[#0F172A]">{formatCurrency(line.total_ht)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F0FDF4]">
                <th className="text-left text-xs font-medium text-slate-400 px-6 py-3">Désignation</th>
                <th className="text-right text-xs font-medium text-slate-400 px-4 py-3">Qté</th>
                <th className="text-right text-xs font-medium text-slate-400 px-4 py-3">Prix unitaire HT</th>
                <th className="text-right text-xs font-medium text-slate-400 px-4 py-3">TVA</th>
                <th className="text-right text-xs font-medium text-slate-400 px-6 py-3">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {quote.lines?.map((line, i) => (
                <tr key={i} className="border-b border-[#F1F5F9] last:border-0">
                  <td className="px-6 py-4 text-sm text-[#0F172A]">{line.description}</td>
                  <td className="px-4 py-4 text-right text-sm font-mono text-slate-600">{line.quantity}</td>
                  <td className="px-4 py-4 text-right text-sm font-mono text-slate-600">{formatCurrency(line.unit_price_ht)}</td>
                  <td className="px-4 py-4 text-right text-sm font-mono text-slate-600">{line.vat_rate}%</td>
                  <td className="px-6 py-4 text-right text-sm font-mono font-semibold text-[#0F172A]">{formatCurrency(line.total_ht)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totaux */}
        <div className="p-4 sm:p-8 border-t border-[#E2E8F0]">
          <div className="flex justify-end">
            <div className="w-full sm:w-64 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Sous-total HT</span>
                <span className="font-mono text-[#0F172A]">{formatCurrency(quote.subtotal_ht)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">TVA</span>
                <span className="font-mono text-slate-600">{formatCurrency(quote.total_vat)}</span>
              </div>
              <Separator />
              <div className="flex justify-between pt-1">
                <span className="font-bold text-[#0F172A]">Total TTC</span>
                <span className="font-mono text-lg font-bold text-[#0f9457]">{formatCurrency(quote.total_ttc)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="px-4 sm:px-8 pb-4 sm:pb-8">
            <Separator className="mb-4" />
            <p className="text-xs font-medium text-slate-400 mb-1.5 uppercase">Notes / Conditions</p>
            <p className="text-sm text-slate-600 whitespace-pre-line">{quote.notes}</p>
          </div>
        )}
      </div>

      {/* Infos techniques */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Créé le",    value: formatDate(quote.created_at) },
          { label: "Valide jusqu'au", value: formatDate(quote.valid_until) },
          { label: "Lignes",     value: `${quote.lines?.length ?? 0} prestation${(quote.lines?.length ?? 0) > 1 ? "s" : ""}` },
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
