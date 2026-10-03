/**
 * Bandeaux d'état de la formule Artisan, communs aux écrans Chantiers :
 * - formule non souscrite (ou pas encore en vente) : ce que fait la formule,
 *   lien vers la démo et vers les tarifs ;
 * - fonction pas encore activée (migration non appliquée) : dit simplement
 *   qu'elle n'est pas encore disponible sur le compte.
 */
import Link from "next/link"
import { HardHat, Info } from "lucide-react"
import { PLANS } from "@/lib/stripe/plans"

export function ArtisanLockedBanner({ onChoose, demoHref = "/demo/chantiers" }: { onChoose?: () => void; demoHref?: string }) {
  const plan = PLANS.pro
  return (
    <div className="q-banner items-start text-[14px] leading-normal" role="note">
      <HardHat className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p>
          <strong className="font-semibold">Avec la formule {plan.name}.</strong>{" "}
          Suivi par chantier, factures d&apos;acompte, situations de travaux, retenue de garantie et autoliquidation en sous-traitance.
          {plan.available ? "" : " La formule n'est pas encore en vente : vous pouvez l'essayer dans la démo."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={demoHref} className="q-btn q-btn-secondary q-btn-sm">Voir dans la démo</Link>
          {plan.available && (onChoose
            ? <button type="button" className="q-btn q-btn-primary q-btn-sm" onClick={onChoose}>Choisir {plan.name}</button>
            : <Link href="/pricing" className="q-btn q-btn-primary q-btn-sm">Voir les tarifs</Link>)}
        </div>
      </div>
    </div>
  )
}

export function ArtisanUnavailable({ demoHref = "/demo/chantiers" }: { demoHref?: string }) {
  return (
    <div className="q-banner items-start text-[14px] leading-normal" role="status">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p>Le suivi par chantier n&apos;est pas encore disponible sur votre compte. Vos devis et factures ne changent pas.</p>
        <Link href={demoHref} className="q-btn q-btn-secondary q-btn-sm self-start">Voir dans la démo</Link>
      </div>
    </div>
  )
}
