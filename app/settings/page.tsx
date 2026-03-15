import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, Building2, FileText, Wifi, Bell, CreditCard, Download } from "lucide-react"

export const metadata: Metadata = { title: "Paramètres" }
export const dynamic = "force-dynamic"

const settingsLinks = [
  { href: "/settings/company", label: "Mon entreprise", desc: "Raison sociale, SIREN, adresse, IBAN", icon: Building2 },
  { href: "/settings/invoices", label: "Préférences factures", desc: "Numérotation, mentions personnalisées, logo", icon: FileText },
  { href: "/settings/ppf", label: "Connexion transmission", desc: "Configuration de la transmission automatique", icon: Wifi },
  { href: "/settings/notifications", label: "Notifications", desc: "Emails de confirmation, alertes de retard", icon: Bell },
  { href: "/settings/exports", label: "Exports comptables", desc: "FEC (Fichier des Écritures Comptables) pour l'expert-comptable", icon: Download },
  { href: "/settings/billing", label: "Abonnement", desc: "Plan actuel, facturation, paiement", icon: CreditCard },
]

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-3 animate-fade-in">
      {settingsLinks.map(({ href, label, desc, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="flex items-center gap-4 bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] px-5 py-4 hover:border-[#2563EB] hover:shadow-sm transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-[#2563EB]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[#0F172A] dark:text-[#E2E8F0] text-sm">{label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#2563EB] transition-colors" />
        </Link>
      ))}
    </div>
  )
}
