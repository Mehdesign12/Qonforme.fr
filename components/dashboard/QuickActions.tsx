/**
 * Actions rapides de l'accueil mobile (canevas « Mobile — accueil ») :
 * Facture, Devis, Client, Relancer. « Situation » du canevas n'existe pas
 * (DECISIONS § 10) et cède sa place à « Client ». Sur ordinateur, la création
 * passe par le menu « Nouveau » de la barre supérieure.
 */
import Link from "next/link"
import { FileCheck2, FilePlus2, RefreshCw, UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"
import { hrefFor, plural, type DashMode } from "@/components/dashboard/model"
import { SOLID } from "@/components/dashboard/ui"

export function QuickActions({ mode, remindHref, lateCount }: { mode: DashMode; remindHref: string; lateCount: number }) {
  const tiles = [
    { key: "invoice", label: "Facture", aria: "Nouvelle facture", href: hrefFor(mode, "/invoices/new"), Icon: FilePlus2 },
    { key: "quote", label: "Devis", aria: "Nouveau devis", href: hrefFor(mode, "/quotes/new"), Icon: FileCheck2 },
    { key: "client", label: "Client", aria: "Nouveau client", href: hrefFor(mode, "/clients/new"), Icon: UserPlus },
    {
      key: "remind",
      label: "Relancer",
      aria: lateCount > 0
        ? `Relancer\u00a0: ${lateCount}\u00a0${plural(lateCount, "facture en retard", "factures en retard")}`
        : "Relancer\u00a0: aucune facture en retard",
      href: remindHref,
      Icon: RefreshCw,
    },
  ]

  return (
    <nav aria-label="Actions rapides" className="grid grid-cols-4 gap-2 md:hidden">
      {tiles.map(({ key, label, aria, href, Icon }, i) => (
        <Link
          key={key}
          href={href}
          aria-label={aria}
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3 text-xs font-semibold transition-colors",
            i === 0
              ? "bg-[var(--q-accent)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_10px_20px_-12px_rgba(37,99,235,.9)] active:bg-[#1D4ED8]"
              : cn(SOLID, "text-[var(--q-ink)]"),
          )}
        >
          <Icon className={cn("size-5", i > 0 && "text-[var(--q-accent-strong)]")} strokeWidth={2} aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  )
}
