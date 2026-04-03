'use client'

import Link from "next/link"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft, Send, Download, Printer, Truck,
  CheckCircle2, Clock, XCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatDate } from "@/lib/utils/invoice"

type POStatus = "draft" | "sent" | "confirmed" | "cancelled"

const PO_STATUS_LABELS: Record<POStatus, string> = {
  draft:     "Brouillon",
  sent:      "Envoyé",
  confirmed: "Confirmé",
  cancelled: "Annulé",
}

const STATUS_BADGE: Record<POStatus, string> = {
  draft:     "bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]",
  sent:      "bg-[#DBEAFE] text-[#1E40AF] border-[#93C5FD]",
  confirmed: "bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]",
  cancelled: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
}

const MOCK_POS: Record<string, {
  id: string; po_number: string; status: POStatus
  issue_date: string; delivery_date: string; notes: string | null
  client: { name: string; email: string; address: string; city: string; zip_code: string; siren: string }
  lines: { description: string; quantity: number; unit_price_ht: number; vat_rate: number; total_ht: number }[]
  subtotal_ht: number; total_vat: number; total_ttc: number
}> = {
  "1": {
    id: "1", po_number: "BC-2026-004", status: "confirmed",
    issue_date: "2026-03-06", delivery_date: "2026-03-20", notes: "Livraison sur chantier — accès par le portail arrière",
    client: { name: "Renovbat SARL", email: "contact@renovbat.fr", address: "12 rue de la Paix", city: "Paris", zip_code: "75002", siren: "123456789" },
    lines: [
      { description: "Câbles électriques 3G2.5 (100m)", quantity: 3, unit_price_ht: 450, vat_rate: 20, total_ht: 1350 },
      { description: "Tableau électrique 3 rangées", quantity: 2, unit_price_ht: 380, vat_rate: 20, total_ht: 760 },
      { description: "Disjoncteurs différentiels 30mA", quantity: 6, unit_price_ht: 145, vat_rate: 20, total_ht: 870 },
    ],
    subtotal_ht: 2980, total_vat: 596, total_ttc: 3576,
  },
  "2": {
    id: "2", po_number: "BC-2026-003", status: "sent",
    issue_date: "2026-02-22", delivery_date: "2026-03-10", notes: null,
    client: { name: "Électricité Dupont", email: "dupont@elec.fr", address: "5 avenue des Lilas", city: "Lyon", zip_code: "69003", siren: "987654321" },
    lines: [
      { description: "Tubes LED T8 120cm", quantity: 20, unit_price_ht: 35, vat_rate: 20, total_ht: 700 },
      { description: "Prises encastrables", quantity: 30, unit_price_ht: 28, vat_rate: 20, total_ht: 840 },
    ],
    subtotal_ht: 1540, total_vat: 308, total_ttc: 1848,
  },
  "3": {
    id: "3", po_number: "BC-2026-002", status: "draft",
    issue_date: "2026-02-14", delivery_date: "2026-03-05", notes: "À confirmer avec le fournisseur",
    client: { name: "Fournitures Leclerc Pro", email: "pro@leclerc.fr", address: "ZI des Moulins", city: "Nantes", zip_code: "44000", siren: "456789123" },
    lines: [
      { description: "Peinture acrylique blanche 10L", quantity: 5, unit_price_ht: 85, vat_rate: 20, total_ht: 425 },
      { description: "Rouleaux et pinceaux (lot)", quantity: 3, unit_price_ht: 45, vat_rate: 20, total_ht: 135 },
    ],
    subtotal_ht: 560, total_vat: 112, total_ttc: 672,
  },
  "4": {
    id: "4", po_number: "BC-2026-001", status: "cancelled",
    issue_date: "2026-01-28", delivery_date: "2026-02-15", notes: "Commande annulée — fournisseur en rupture de stock",
    client: { name: "Martin Plomberie", email: "martin@plomberie.fr", address: "18 rue des Artisans", city: "Bordeaux", zip_code: "33000", siren: "789123456" },
    lines: [
      { description: "Tubes cuivre 22mm (barre 5m)", quantity: 10, unit_price_ht: 95, vat_rate: 20, total_ht: 950 },
      { description: "Raccords laiton (lot 50)", quantity: 2, unit_price_ht: 320, vat_rate: 20, total_ht: 640 },
      { description: "Joints fibre (lot 100)", quantity: 4, unit_price_ht: 55, vat_rate: 20, total_ht: 220 },
    ],
    subtotal_ht: 1810, total_vat: 362, total_ttc: 2172,
  },
}

const ctaToast = () => toast("Créez un compte pour utiliser cette fonctionnalité", {
  action: { label: "S'inscrire", onClick: () => window.location.href = "/signup" },
})

export default function DemoPurchaseOrderDetailPage() {
  const params = useParams()
  const id = params.id as string
  const po = MOCK_POS[id] ?? MOCK_POS["1"]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/demo/purchase-orders">
            <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 -ml-2">
              <ArrowLeft className="w-4 h-4" /> Bons de commande
            </Button>
          </Link>
          <h1 className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#E2E8F0] font-mono">{po.po_number}</h1>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[po.status]}`}>
            {PO_STATUS_LABELS[po.status]}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={ctaToast}>
            <Download className="w-4 h-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> Imprimer
          </Button>
          <Button size="sm" className="gap-1.5 shrink-0 bg-[#4F46E5] hover:bg-[#4338CA] text-white" onClick={ctaToast}>
            <Send className="w-4 h-4" /> Envoyer au fournisseur
          </Button>
        </div>
      </div>

      {/* Status actions */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={ctaToast}>
          <CheckCircle2 className="w-4 h-4" /> <span className="hidden xs:inline">Confirmer</span><span className="xs:hidden">OK</span>
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={ctaToast}>
          <XCircle className="w-4 h-4" /> Annuler
        </Button>
      </div>

      {/* Mobile: sidebar info first (dates + fournisseur) */}
      <div className="lg:hidden space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] px-4 py-3 shadow-sm">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">Émission</p>
            <p className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0]">{formatDate(po.issue_date)}</p>
          </div>
          <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] px-4 py-3 shadow-sm">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">Livraison</p>
            <p className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0]">{formatDate(po.delivery_date)}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] px-4 py-3 shadow-sm flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5] text-[11px] font-bold">
            {po.client.name.split(' ').slice(0, 2).map(w => w[0]).join('')}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0] truncate">{po.client.name}</p>
            <p className="text-xs text-slate-400 truncate">{po.client.city} · {po.client.email}</p>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Lines */}
          <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#162032]">
              <h2 className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Articles commandés</h2>
            </div>
            <div className="divide-y divide-[#F1F5F9] dark:divide-[#162032]">
              {po.lines.map((line, i) => (
                <div key={i} className="px-5 py-3.5 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#0F172A] dark:text-[#E2E8F0] truncate">{line.description}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {line.quantity} × {formatCurrency(line.unit_price_ht)} HT · TVA {line.vat_rate}%
                    </p>
                  </div>
                  <p className="font-mono text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0] shrink-0">
                    {formatCurrency(line.total_ht)} HT
                  </p>
                </div>
              ))}
            </div>
            {/* Totals */}
            <div className="px-5 py-4 border-t border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#162032] space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Total HT</span>
                <span className="font-mono font-semibold text-[#0F172A] dark:text-[#E2E8F0]">{formatCurrency(po.subtotal_ht)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">TVA</span>
                <span className="font-mono text-slate-500 dark:text-slate-400">{formatCurrency(po.total_vat)}</span>
              </div>
              <div className="flex justify-between text-sm pt-1.5 border-t border-[#E2E8F0] dark:border-[#1E3A5F]">
                <span className="font-bold text-[#0F172A] dark:text-[#E2E8F0]">Total TTC</span>
                <span className="font-mono text-lg font-extrabold text-[#4F46E5]">{formatCurrency(po.total_ttc)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {po.notes && (
            <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] px-5 py-4 shadow-sm">
              <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0] mb-1">Notes</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{po.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar info — desktop only (mobile shown above) */}
        <div className="hidden lg:flex flex-col space-y-4">
          {/* Dates */}
          <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] px-5 py-4 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Dates</h3>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-slate-500 dark:text-slate-400">Émission : {formatDate(po.issue_date)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Truck className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-slate-500 dark:text-slate-400">Livraison prévue : {formatDate(po.delivery_date)}</span>
            </div>
          </div>

          {/* Fournisseur */}
          <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] px-5 py-4 shadow-sm space-y-2">
            <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Fournisseur</h3>
            <p className="text-sm font-medium text-[#0F172A] dark:text-[#E2E8F0]">{po.client.name}</p>
            <p className="text-xs text-slate-400">{po.client.address}</p>
            <p className="text-xs text-slate-400">{po.client.zip_code} {po.client.city}</p>
            <p className="text-xs text-[#4F46E5] font-mono mt-1">{po.client.email}</p>
            <p className="text-xs text-slate-400 font-mono">SIREN {po.client.siren}</p>
          </div>

          {/* CTA */}
          <Link href="/signup" className="block">
            <div className="rounded-xl border border-[#4F46E5]/20 bg-[#EEF2FF] dark:bg-[#1E3A5F]/50 px-5 py-4 text-center hover:shadow-md transition-all">
              <p className="text-sm font-bold text-[#4F46E5]">Essayez Qonforme</p>
              <p className="text-xs text-[#4F46E5]/70 mt-0.5">Gérez vos bons de commande en toute simplicité</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
