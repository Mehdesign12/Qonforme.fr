'use client'

export const dynamic = "force-dynamic"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft, Loader2, Send, CheckCircle2, XCircle,
  Printer, Trash2, Download, AlertTriangle, Pencil, X,
  ShoppingCart, Ban,
} from "lucide-react"
import { Button }    from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { formatCurrency, formatDate } from "@/lib/utils/invoice"
import { createClient } from "@/lib/supabase/client"

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

type POStatus = "draft" | "sent" | "confirmed" | "cancelled"

interface POLine {
  description:   string
  quantity:      number
  unit_price_ht: number
  vat_rate:      number
  total_ht:      number
  total_vat:     number
  total_ttc:     number
}

interface PurchaseOrder {
  id:            string
  po_number:     string
  status:        POStatus
  issue_date:    string
  delivery_date: string | null
  reference:     string | null
  lines:         POLine[]
  subtotal_ht:   number
  total_vat:     number
  total_ttc:     number
  notes:         string | null
  sent_at:       string | null
  confirmed_at:  string | null
  created_at:    string
  client: {
    id:        string
    name:      string
    email:     string | null
    address:   string | null
    zip_code:  string | null
    city:      string | null
    siren:     string | null
    vat_number: string | null
  } | null
}

interface Company {
  name:       string
  address:    string | null
  zip_code:   string | null
  city:       string | null
  siret:      string | null
  siren:      string | null
  vat_number: string | null
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const INDIGO = "#4F46E5"

const STATUS_BADGE: Record<POStatus, string> = {
  draft:     "bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]",
  sent:      "bg-[#EEF2FF] text-[#3730A3] border-[#A5B4FC]",
  confirmed: "bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]",
  cancelled: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
}

const STATUS_LABELS: Record<POStatus, string> = {
  draft:     "Brouillon",
  sent:      "Envoyé",
  confirmed: "Confirmé",
  cancelled: "Annulé",
}

/* Actions disponibles par statut */
const NEXT_ACTIONS: Partial<Record<POStatus, {
  label:     string
  status:    POStatus
  icon:      React.ElementType
  className: string
}[]>> = {
  draft: [
    { label: "Marquer comme envoyé", status: "sent",      icon: Send,          className: "bg-[#4F46E5] hover:bg-[#3730A3] text-white" },
  ],
  sent: [
    { label: "Confirmer la commande", status: "confirmed", icon: CheckCircle2,  className: "bg-[#0f9457] hover:bg-[#0a7a47] text-white" },
    { label: "Annuler",               status: "cancelled", icon: XCircle,       className: "border-[#FCA5A5] text-[#991B1B] hover:bg-[#FEE2E2]" },
  ],
  confirmed: [
    { label: "Annuler",               status: "cancelled", icon: Ban,           className: "border-[#FCA5A5] text-[#991B1B] hover:bg-[#FEE2E2]" },
  ],
}

/* ------------------------------------------------------------------ */
/* Composant                                                            */
/* ------------------------------------------------------------------ */

export default function PurchaseOrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()

  const [po, setPo]                         = useState<PurchaseOrder | null>(null)
  const [company, setCompany]               = useState<Company | null>(null)
  const [loading, setLoading]               = useState(true)
  const [statusLoading, setStatusLoading]   = useState(false)
  const [deleteLoading, setDeleteLoading]   = useState(false)
  const [pdfLoading, setPdfLoading]         = useState(false)
  const [showSendModal, setShowSendModal]   = useState(false)
  const [sendLoading, setSendLoading]       = useState(false)

  /* ── Chargement ── */
  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      fetch(`/api/purchase-orders/${params.id}`).then(r => r.json()),
      supabase
        .from("companies")
        .select("name,address,zip_code,city,siret,siren,vat_number")
        .single(),
    ]).then(([json, { data: comp }]) => {
      if (json.purchase_order) setPo(json.purchase_order)
      if (comp) setCompany(comp)
    }).finally(() => setLoading(false))
  }, [params.id])

  /* ── Changement de statut ── */
  const changeStatus = async (newStatus: POStatus) => {
    if (!po) return
    setStatusLoading(true)
    try {
      const res  = await fetch(`/api/purchase-orders/${params.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: newStatus }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      setPo(json.purchase_order)
      toast.success(`Statut mis à jour : ${STATUS_LABELS[newStatus]}`)
    } catch { toast.error("Erreur réseau") }
    finally { setStatusLoading(false) }
  }

  /* ── Téléchargement PDF ── */
  const downloadPDF = async () => {
    if (!po) return
    setPdfLoading(true)
    try {
      const res = await fetch(`/api/purchase-orders/${params.id}/pdf`)
      if (!res.ok) { toast.error("Erreur lors de la génération du PDF"); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url
      a.download = `${po.po_number}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("PDF téléchargé !")
    } catch { toast.error("Erreur lors du téléchargement") }
    finally { setPdfLoading(false) }
  }

  /* ── Suppression brouillon ── */
  const deletePO = async () => {
    if (!po || !confirm(`Supprimer le brouillon ${po.po_number} ?`)) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/purchase-orders/${params.id}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("Brouillon supprimé")
        router.push("/purchase-orders")
      } else {
        const json = await res.json()
        toast.error(json.error)
      }
    } catch { toast.error("Erreur réseau") }
    finally { setDeleteLoading(false) }
  }

  /* ── Envoi email ── */
  const sendByEmail = async () => {
    if (!po) return
    setSendLoading(true)
    try {
      const res  = await fetch(`/api/purchase-orders/${params.id}/send`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Erreur lors de l'envoi"); return }
      setPo(prev => prev ? { ...prev, status: "sent" as POStatus } : prev)
      toast.success(`Bon de commande envoyé à ${json.sentTo}`)
      setShowSendModal(false)
    } catch { toast.error("Erreur réseau") }
    finally { setSendLoading(false) }
  }

  /* ── États d'affichage ── */
  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: INDIGO }} />
    </div>
  )

  if (!po) return (
    <div className="py-16 text-center space-y-3">
      <p className="text-slate-500">Bon de commande introuvable</p>
      <Link href="/purchase-orders" className="text-sm hover:underline" style={{ color: INDIGO }}>
        ← Retour aux bons de commande
      </Link>
    </div>
  )

  const actions          = NEXT_ACTIONS[po.status] ?? []
  const canEdit          = po.status === "draft"
  const canDelete        = po.status === "draft"
  const canSendEmail     = (po.status === "draft" || po.status === "sent") && !!po.client?.email
  const isDeliveryPassed = po.delivery_date && new Date(po.delivery_date) < new Date()

  return (
    <>
      {/* ── Modal envoi email ── */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

            {/* En-tête modale */}
            <div className="flex items-center justify-between p-6 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#EEF2FF" }}>
                  <Send className="w-4 h-4" style={{ color: INDIGO }} />
                </div>
                <div>
                  <h2 className="font-bold text-[#0F172A] text-sm">Envoyer le bon de commande</h2>
                  <p className="text-xs text-slate-400">{po.po_number}</p>
                </div>
              </div>
              <button
                onClick={() => setShowSendModal(false)}
                className="p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Corps modale */}
            <div className="p-6 space-y-4">
              <div className="rounded-xl p-4 border" style={{ backgroundColor: "#EEF2FF", borderColor: "#A5B4FC" }}>
                <p className="text-sm font-medium mb-1" style={{ color: "#3730A3" }}>Destinataire</p>
                <p className="text-sm text-[#1E293B]">{po.client?.name}</p>
                {po.client?.email
                  ? <p className="text-xs font-mono mt-0.5" style={{ color: INDIGO }}>{po.client.email}</p>
                  : <p className="text-xs text-red-500 mt-0.5">Aucune adresse email — ajoutez-en une dans la fiche client</p>
                }
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Le bon de commande <strong>{po.po_number}</strong> sera envoyé avec le PDF en pièce jointe.
                Le statut passera automatiquement à <strong>Envoyé</strong>.
              </p>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
                <p className="text-xs text-slate-500">
                  Objet :{" "}
                  <span className="font-medium text-slate-700">
                    Bon de commande {po.po_number} — {company?.name ?? "votre entreprise"}
                  </span>
                </p>
              </div>
            </div>

            {/* Actions modale */}
            <div className="flex gap-3 p-6 pt-0">
              <Button variant="outline" className="flex-1" onClick={() => setShowSendModal(false)} disabled={sendLoading}>
                Annuler
              </Button>
              <Button
                className="flex-1 text-white gap-2"
                style={{ backgroundColor: INDIGO }}
                onClick={sendByEmail}
                disabled={sendLoading || !po.client?.email}
              >
                {sendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sendLoading ? "Envoi en cours…" : "Envoyer"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page principale ── */}
      <div className="space-y-4 sm:space-y-6 max-w-4xl">

        {/* ── Barre d'actions ── */}
        <div className="space-y-3">

          {/* Gauche : retour + numéro + badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/purchase-orders">
              <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500 hover:text-slate-700 -ml-2">
                <ArrowLeft className="w-4 h-4" /> Bons de commande
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#EEF2FF" }}>
                <ShoppingCart className="w-3.5 h-3.5" style={{ color: INDIGO }} />
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-[#0F172A] font-mono">{po.po_number}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[po.status]}`}>
                {STATUS_LABELS[po.status]}
              </span>
            </div>
          </div>

          {/* Droite : boutons d'action — scroll horizontal sur mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">

            {/* PDF */}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadPDF} disabled={pdfLoading}>
              {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {pdfLoading ? "Génération…" : "Télécharger PDF"}
            </Button>

            {/* Imprimer */}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
              <Printer className="w-4 h-4" /> Imprimer
            </Button>

            {/* Modifier — brouillon uniquement */}
            {canEdit && (
              <Link href={`/purchase-orders/${params.id}/edit`} className="shrink-0">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Pencil className="w-4 h-4" /> Modifier
                </Button>
              </Link>
            )}

            {/* Supprimer brouillon */}
            {canDelete && (
              <Button
                variant="outline" size="sm"
                className="gap-1.5 shrink-0 border-[#FCA5A5] text-[#991B1B] hover:bg-[#FEE2E2]"
                onClick={deletePO} disabled={deleteLoading}
              >
                {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span className="hidden xs:inline">Supprimer</span>
              </Button>
            )}

            {/* Envoyer par email */}
            {canSendEmail && (
              <Button
                size="sm"
                className="gap-1.5 shrink-0 text-white"
                style={{ backgroundColor: INDIGO }}
                onClick={() => setShowSendModal(true)}
                disabled={sendLoading}
              >
                <Send className="w-4 h-4" />
                Envoyer par email
              </Button>
            )}

            {/* Transitions de statut manuel */}
            {actions.map(action => (
              <Button
                key={action.status}
                variant="outline"
                size="sm"
                className={`gap-1.5 shrink-0 ${action.className}`}
                onClick={() => changeStatus(action.status)}
                disabled={statusLoading}
              >
                {statusLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <action.icon className="w-4 h-4" />
                }
                {action.label}
              </Button>
            ))}
          </div>
        </div>

        {/* ── Alerte date de livraison dépassée ── */}
        {po.status === "sent" && isDeliveryPassed && (
          <div className="bg-[#FEF3C7] border border-[#FCD34D] rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0" />
            <p className="text-sm text-[#92400E]">
              La date de livraison souhaitée (<strong>{formatDate(po.delivery_date!)}</strong>) est dépassée.
              Pensez à relancer votre client.
            </p>
          </div>
        )}

        {/* ── Alerte annulé ── */}
        {po.status === "cancelled" && (
          <div className="bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl p-4 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-[#DC2626] shrink-0" />
            <p className="text-sm text-[#991B1B]">
              Ce bon de commande a été <strong>annulé</strong>. Il ne peut plus être modifié.
            </p>
          </div>
        )}

        {/* ── Corps du bon de commande ── */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">

          {/* En-tête : émetteur / destinataire / numérotation — grille mobile */}
          <div className="p-4 sm:p-8 border-b border-[#E2E8F0]">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">

              {/* Émetteur */}
              <div>
                <p className="text-xs font-medium text-slate-400 mb-1 uppercase tracking-wide">De</p>
                {company ? (
                  <div>
                    <p className="text-sm font-bold text-[#0F172A]">{company.name}</p>
                    {company.address && <p className="text-xs text-slate-500 mt-0.5">{company.address}</p>}
                    {(company.zip_code || company.city) && (
                      <p className="text-xs text-slate-500">
                        {[company.zip_code, company.city].filter(Boolean).join(" ")}
                      </p>
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

              {/* Destinataire / Client */}
              <div>
                <p className="text-xs font-medium text-slate-400 mb-1 uppercase tracking-wide">Pour</p>
                {po.client ? (
                  <div>
                    <Link
                      href={`/clients/${po.client.id}`}
                      className="text-sm font-bold hover:underline"
                      style={{ color: INDIGO }}
                    >
                      {po.client.name}
                    </Link>
                    {po.client.siren && (
                      <p className="text-xs text-slate-400 font-mono mt-0.5">SIREN {po.client.siren}</p>
                    )}
                    {po.client.address && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {po.client.address}
                        {(po.client.zip_code || po.client.city) && (
                          <><br />{[po.client.zip_code, po.client.city].filter(Boolean).join(" ")}</>
                        )}
                      </p>
                    )}
                    {po.client.email && (
                      <p className="text-xs text-slate-400 mt-0.5">{po.client.email}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">—</p>
                )}
              </div>

              {/* Méta-données */}
              <div className="sm:text-right">
                <div className="mb-3">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">N° BdC</p>
                  <p className="text-sm font-bold font-mono" style={{ color: INDIGO }}>{po.po_number}</p>
                </div>
                {po.reference && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Référence</p>
                    <p className="text-sm font-mono text-[#0F172A]">{po.reference}</p>
                  </div>
                )}
                <div className="mb-3">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Date d&apos;émission</p>
                  <p className="text-sm text-[#0F172A]">{formatDate(po.issue_date)}</p>
                </div>
                {po.delivery_date && (
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Livraison souhaitée</p>
                    <p className={`text-sm font-medium ${isDeliveryPassed && po.status === "sent" ? "text-[#EF4444]" : "text-[#0F172A]"}`}>
                      {formatDate(po.delivery_date)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tableau des lignes — mobile : cards empilées */}
          <div className="block sm:hidden divide-y divide-[#F1F5F9]">
            {po.lines?.map((line, i) => (
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
                <tr className="border-b border-[#E2E8F0]" style={{ backgroundColor: "#EEF2FF" }}>
                  <th className="text-left text-xs font-medium text-slate-400 px-6 py-3">Désignation</th>
                  <th className="text-right text-xs font-medium text-slate-400 px-4 py-3">Qté</th>
                  <th className="text-right text-xs font-medium text-slate-400 px-4 py-3">Prix unitaire HT</th>
                  <th className="text-right text-xs font-medium text-slate-400 px-4 py-3">TVA</th>
                  <th className="text-right text-xs font-medium text-slate-400 px-6 py-3">Total HT</th>
                </tr>
              </thead>
              <tbody>
                {po.lines?.map((line, i) => (
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
          <div className="p-6 sm:p-8 border-t border-[#E2E8F0]">
            <div className="flex justify-end">
              <div className="w-64 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Sous-total HT</span>
                  <span className="font-mono text-[#0F172A]">{formatCurrency(po.subtotal_ht)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">TVA</span>
                  <span className="font-mono text-slate-600">{formatCurrency(po.total_vat)}</span>
                </div>
                <Separator />
                <div className="flex justify-between pt-1">
                  <span className="font-bold text-[#0F172A]">Total TTC</span>
                  <span className="font-mono text-lg font-bold" style={{ color: INDIGO }}>
                    {formatCurrency(po.total_ttc)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {po.notes && (
            <div className="px-6 sm:px-8 pb-6 sm:pb-8">
              <Separator className="mb-4" />
              <p className="text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Notes / Conditions de livraison</p>
              <p className="text-sm text-slate-600 whitespace-pre-line">{po.notes}</p>
            </div>
          )}
        </div>

        {/* ── Métadonnées techniques ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Créé le",       value: formatDate(po.created_at) },
            { label: "Lignes",        value: `${po.lines?.length ?? 0} article${(po.lines?.length ?? 0) > 1 ? "s" : ""}` },
            { label: "Envoyé le",     value: po.sent_at      ? formatDate(po.sent_at)      : "—" },
            { label: "Confirmé le",   value: po.confirmed_at ? formatDate(po.confirmed_at) : "—" },
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
