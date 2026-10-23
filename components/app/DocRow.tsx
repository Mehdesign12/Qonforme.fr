import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Initials } from "@/components/app/kit"

/**
 * Ligne compacte des listes de documents sur téléphone (maquette « Compacte
 * avec initiales », 23/10/2026) : initiales du client à gauche, client et
 * référence au milieu, montant et statut à droite, prochaine action en bleu
 * sous la référence. Partagée par devis, bons de commande, factures et avoirs
 * (réels et démo : mêmes vues).
 */
export function DocRow({ href, name, reference, mono = true, amount, pill, next, className }: {
  href: string
  name: string
  /** Référence et contexte : « D-2026-014 · 12 oct. ». */
  reference: React.ReactNode
  /** Police à chasse fixe pour une référence numérotée (pas pour « Brouillon »). */
  mono?: boolean
  amount: React.ReactNode
  pill: React.ReactNode
  /** Prochaine action (« Relancer », « Convertir en facture »). */
  next?: string | null
  className?: string
}) {
  return (
    <Link href={href} className={cn("q-list-row items-center gap-3 px-3.5 py-3", className)}>
      <Initials name={name} className="!size-11 !rounded-xl !text-sm" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">{name}</span>
        <span className={cn("truncate text-[12.5px] text-[var(--q-text-4)]", mono && "font-mono")}>{reference}</span>
        {next && (
          <span className="mt-0.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--q-accent-strong)]">
            {next}
            <ArrowRight className="size-3.5" aria-hidden />
          </span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-[15px] font-semibold tabular-nums">{amount}</span>
        {pill}
      </span>
    </Link>
  )
}
