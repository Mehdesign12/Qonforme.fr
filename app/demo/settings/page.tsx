export const dynamic = "force-dynamic"

import Link from "next/link"
import { ChevronRight, Building2, FileText, Wifi, Bell, CreditCard } from "lucide-react"

const settingsLinks = [
  { href: "/demo/settings/ppf", label: "Connexion transmission", desc: "Configuration de la transmission automatique", icon: Wifi },
  { href: "/demo/settings", label: "Mon entreprise", desc: "Raison sociale, SIREN, adresse, IBAN", icon: Building2 },
  { href: "/demo/settings", label: "Préférences factures", desc: "Numérotation, mentions personnalisées, logo", icon: FileText },
  { href: "/demo/settings", label: "Notifications", desc: "Emails de confirmation, alertes de retard", icon: Bell },
  { href: "/demo/settings", label: "Abonnement", desc: "Plan Pro actif · Renouvellement le 07/04/2026", icon: CreditCard },
]

export default function DemoSettingsPage() {
  return (
    <div className="max-w-2xl space-y-3 animate-fade-in">
      {settingsLinks.map(({ href, label, desc, icon: Icon }, i) => (
        <Link
          key={i}
          href={href}
          className="flex items-center gap-4 bg-white rounded-xl border border-[#E2E8F0] px-5 py-4 hover:border-[#2563EB] hover:shadow-sm transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-[#2563EB]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[#0F172A] text-sm">{label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#2563EB] transition-colors" />
        </Link>
      ))}
    </div>
  )
}
