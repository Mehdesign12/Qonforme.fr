import Link from "next/link"
import { FileText, Users, FileCheck2, ShoppingCart } from "lucide-react"

const ACTIONS = [
  {
    href:   "/invoices/new",
    label:  "Nouvelle facture",
    sub:    "Créer & envoyer",
    icon:   FileText,
    color:  "#2563EB",
    bg:     "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
    iconBg: "#2563EB",
    shadow: "rgba(37,99,235,0.18)",
  },
  {
    href:   "/quotes/new",
    label:  "Nouveau devis",
    sub:    "Proposer un projet",
    icon:   FileCheck2,
    color:  "#7C3AED",
    bg:     "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)",
    iconBg: "#7C3AED",
    shadow: "rgba(124,58,237,0.15)",
  },
  {
    href:   "/clients/new",
    label:  "Nouveau client",
    sub:    "Ajouter un contact",
    icon:   Users,
    color:  "#0891B2",
    bg:     "linear-gradient(135deg, #ECFEFF 0%, #CFFAFE 100%)",
    iconBg: "#0891B2",
    shadow: "rgba(8,145,178,0.15)",
  },
  {
    href:   "/purchase-orders/new",
    label:  "Bon de commande",
    sub:    "Créer un BdC",
    icon:   ShoppingCart,
    color:  "#059669",
    bg:     "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)",
    iconBg: "#059669",
    shadow: "rgba(5,150,105,0.15)",
  },
]

export function QuickActions() {
  return (
    <div className="h-full flex flex-col">
      {/* En-tête */}
      <h2 className="text-[14px] font-bold text-[#0F172A] mb-4">Actions rapides</h2>

      {/* Grille 2×2 — cards carrées */}
      <div className="grid grid-cols-2 gap-3 flex-1">
        {ACTIONS.map((a) => (
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
              {/* Icône */}
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: a.iconBg }}
              >
                <a.icon className="w-4 h-4 text-white" />
              </div>

              {/* Textes */}
              <div>
                <p className="text-[12px] font-bold text-[#0F172A] leading-tight">{a.label}</p>
                <p className="text-[11px] mt-0.5" style={{ color: a.color, opacity: 0.75 }}>{a.sub}</p>
              </div>

              {/* Flèche hover */}
              <div
                className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                style={{ background: a.iconBg }}
              >
                <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 9.5L9.5 2.5M9.5 2.5H4.5M9.5 2.5V7.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
