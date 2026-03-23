import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Démo interactive — Qonforme",
  description: "Explorez la démo interactive de Qonforme : créez des factures, devis et bons de commande conformes à la réglementation 2026.",
  alternates: { canonical: "/demo" },
  openGraph: {
    images: [{ url: "/api/og?title=D%C3%A9mo%20interactive&subtitle=Cr%C3%A9ez%20factures%2C%20devis%20et%20bons%20de%20commande%20conformes%20%E2%80%94%20sans%20inscription", width: 1200, height: 630 }],
  },
}
import { FileText, FileCheck2, Users, ShoppingCart, ArrowRight, BookOpen } from "lucide-react"
import { PPFStatusBanner } from "@/components/dashboard/PPFStatusBanner"
import { DemoDashboardStats } from "@/components/demo/DemoDashboardStats"
import { DemoRecentInvoices } from "@/components/demo/DemoRecentInvoices"
import { DemoRevenueChart } from "@/components/demo/DemoRevenueChart"
import { DemoTopClients } from "@/components/demo/DemoTopClients"

const QUICK_ACTIONS = [
  {
    href:   "/demo/invoices",
    label:  "Nouvelle facture",
    sub:    "Créer & envoyer",
    icon:   FileText,
    color:  "#2563EB",
    bg:     "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
    iconBg: "#2563EB",
    shadow: "rgba(37,99,235,0.18)",
  },
  {
    href:   "/demo/quotes",
    label:  "Nouveau devis",
    sub:    "Proposer un projet",
    icon:   FileCheck2,
    color:  "#7C3AED",
    bg:     "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)",
    iconBg: "#7C3AED",
    shadow: "rgba(124,58,237,0.15)",
  },
  {
    href:   "/demo/clients",
    label:  "Nouveau client",
    sub:    "Ajouter un contact",
    icon:   Users,
    color:  "#0891B2",
    bg:     "linear-gradient(135deg, #ECFEFF 0%, #CFFAFE 100%)",
    iconBg: "#0891B2",
    shadow: "rgba(8,145,178,0.15)",
  },
  {
    href:   "/demo/purchase-orders",
    label:  "Bon de commande",
    sub:    "Créer un BdC",
    icon:   ShoppingCart,
    color:  "#059669",
    bg:     "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)",
    iconBg: "#059669",
    shadow: "rgba(5,150,105,0.15)",
  },
]

export default function DemoDashboardPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Salutation */}
      <div>
        <h1 className="text-xl font-bold text-[#0F172A] dark:text-[#E2E8F0]">Bonjour, Jean 👋</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">Voici un aperçu de votre activité ce mois-ci.</p>
      </div>

      <PPFStatusBanner connected={false} />

      {/* KPI cards */}
      <DemoDashboardStats />

      {/* Graphique CA + Top clients */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <DemoRevenueChart />
        </div>
        <div>
          <DemoTopClients />
        </div>
      </div>

      {/* Actions rapides + Dernières factures */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Quick Actions */}
        <div>
          <h2 className="text-[14px] font-bold text-[#0F172A] dark:text-[#E2E8F0] mb-4">Actions rapides</h2>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map((a) => (
              <Link key={a.href} href={a.href} className="block">
                <div
                  className="group relative overflow-hidden rounded-2xl border border-white/80 p-4 cursor-pointer hover:-translate-y-0.5 active:scale-95 aspect-square flex flex-col justify-between touch-manipulation"
                  style={{
                    background:  a.bg,
                    boxShadow:   `0 2px 10px ${a.shadow}`,
                    transition:  'transform 0.15s ease, box-shadow 0.15s ease',
                    contain:     'layout style',
                  }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: a.iconBg }}>
                    <a.icon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-[#0F172A] dark:text-[#E2E8F0] leading-tight">{a.label}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: a.color, opacity: 0.75 }}>{a.sub}</p>
                  </div>
                  <div
                    className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                    style={{ background: a.iconBg }}
                  >
                    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 9.5L9.5 2.5M9.5 2.5H4.5M9.5 2.5V7.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Dernières factures */}
        <div className="lg:col-span-2">
          <h2 className="text-[14px] font-bold text-[#0F172A] dark:text-[#E2E8F0] mb-4">Dernières factures</h2>
          <DemoRecentInvoices />
        </div>

      </div>

      {/* CTA — maillage interne vers pricing et blog */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/pricing" className="group flex items-center gap-4 rounded-2xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#0F1E35] p-5 hover:border-[#2563EB]/30 hover:shadow-md transition-all">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF]">
            <ArrowRight className="h-4 w-4 text-[#2563EB]" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-[#0F172A] dark:text-[#E2E8F0] group-hover:text-[#2563EB] transition-colors">Prêt à démarrer ?</p>
            <p className="text-[12px] text-slate-400">Voir les tarifs — à partir de 9 €/mois</p>
          </div>
        </Link>
        <Link href="/blog" className="group flex items-center gap-4 rounded-2xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#0F1E35] p-5 hover:border-[#2563EB]/30 hover:shadow-md transition-all">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF]">
            <BookOpen className="h-4 w-4 text-[#2563EB]" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-[#0F172A] dark:text-[#E2E8F0] group-hover:text-[#2563EB] transition-colors">Guides et conseils</p>
            <p className="text-[12px] text-slate-400">Tout savoir sur la facturation électronique 2026</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
