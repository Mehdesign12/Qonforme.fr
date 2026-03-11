import Link from "next/link"
import { FileText, Users, FileCheck2, ShoppingCart, Plus } from "lucide-react"

const ACTIONS = [
  {
    href:    "/invoices/new",
    label:   "Nouvelle facture",
    sub:     "Créer & envoyer",
    icon:    FileText,
    color:   "#2563EB",
    bg:      "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
    iconBg:  "#2563EB",
  },
  {
    href:    "/quotes/new",
    label:   "Nouveau devis",
    sub:     "Proposer un projet",
    icon:    FileCheck2,
    color:   "#7C3AED",
    bg:      "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)",
    iconBg:  "#7C3AED",
  },
  {
    href:    "/clients/new",
    label:   "Nouveau client",
    sub:     "Ajouter au carnet",
    icon:    Users,
    color:   "#0891B2",
    bg:      "linear-gradient(135deg, #ECFEFF 0%, #CFFAFE 100%)",
    iconBg:  "#0891B2",
  },
  {
    href:    "/purchase-orders/new",
    label:   "Bon de commande",
    sub:     "Commander / Acheter",
    icon:    ShoppingCart,
    color:   "#059669",
    bg:      "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)",
    iconBg:  "#059669",
  },
]

export function QuickActions() {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-bold text-[#0F172A]">Actions rapides</h2>
        <span className="flex items-center gap-1 text-[11px] text-slate-400">
          <Plus className="w-3 h-3" />
          Tout créer
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ACTIONS.map((a) => (
          <Link key={a.href} href={a.href}>
            <div
              className="group relative overflow-hidden rounded-2xl border border-white/80 p-3.5 sm:p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
              style={{
                background:          a.bg,
                backdropFilter:      'blur(8px)',
                WebkitBackdropFilter:'blur(8px)',
                boxShadow:           '0 1px 8px rgba(0,0,0,0.04)',
              }}
            >
              {/* Icône */}
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-transform duration-200 group-hover:scale-110"
                style={{ background: a.iconBg }}
              >
                <a.icon className="w-4 h-4 text-white" />
              </div>
              <p className="text-[13px] font-bold text-[#0F172A] leading-tight">{a.label}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{a.sub}</p>

              {/* Flèche hover */}
              <div
                className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                style={{ background: a.iconBg }}
              >
                <Plus className="w-3 h-3 text-white" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
