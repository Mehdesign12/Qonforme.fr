import Image from "next/image"
import { cn } from "@/lib/utils"

/**
 * Cadres d'appareils de l'accueil, en CSS pur (aucune image de cadre à charger).
 * Les écrans affichés sont de vraies captures du produit (pages de démo,
 * données fictives) : public/landing/ecrans/.
 *
 * Ni backdrop-filter ni will-change (règle iOS de CLAUDE.md) : les ombres et
 * reflets sont de simples dégradés.
 */

interface ScreenProps {
  src: string
  alt: string
  /** Largeur et hauteur réelles du fichier, pour éviter tout décalage de mise en page. */
  width: number
  height: number
  sizes: string
  priority?: boolean
}

/** Ordinateur portable : écran 16/10, châssis aluminium. */
export function MacBook({ screen, className, children }: { screen?: ScreenProps; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("relative w-full", className)}>
      {/* Écran */}
      <div className="relative mx-auto w-[86%] rounded-[2.2%/3.4%] bg-[#0B0F19] p-[1.15%] shadow-[0_0_0_1px_rgba(10,17,34,.35),0_40px_80px_-30px_rgba(10,17,34,.45)]">
        <span aria-hidden className="absolute left-1/2 top-[0.55%] h-[0.7%] w-[0.7%] min-h-[4px] min-w-[4px] -translate-x-1/2 rounded-full bg-[#1F2937]" />
        <div className="relative aspect-[16/10] overflow-hidden rounded-[0.6%/1%] bg-white">
          {children ?? (screen && (
            <Image
              src={screen.src}
              alt={screen.alt}
              width={screen.width}
              height={screen.height}
              sizes={screen.sizes}
              priority={screen.priority}
              loading={screen.priority ? undefined : "lazy"}
              className="h-full w-full object-cover object-top"
            />
          ))}
          {/* Reflet très léger */}
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,.10)_0%,rgba(255,255,255,0)_38%)]" />
        </div>
      </div>
      {/* Base */}
      <div aria-hidden className="relative mx-auto h-[1.6vw] max-h-[18px] min-h-[8px] w-full rounded-b-[40%_100%] bg-[linear-gradient(180deg,#E3E6EB_0%,#C9CED6_45%,#A9AFB9_100%)] shadow-[0_18px_30px_-16px_rgba(10,17,34,.45)]">
        <span className="absolute left-1/2 top-0 h-[38%] w-[14%] -translate-x-1/2 rounded-b-[10px] bg-[linear-gradient(180deg,#B8BEC7,#D5D9DF)]" />
      </div>
    </div>
  )
}

/** Téléphone : écran 9/19.5, îlot dynamique, boutons latéraux. */
export function IPhone({ screen, className, children }: { screen?: ScreenProps; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("relative", className)}>
      <div className="relative rounded-[16%/7.4%] bg-[#0B0F19] p-[3.2%] shadow-[0_0_0_1.5px_#2A3140,0_0_0_3px_#0B0F19,0_40px_70px_-28px_rgba(10,17,34,.55)]">
        {/* Boutons latéraux */}
        <span aria-hidden className="absolute -left-[2.4%] top-[19%] h-[6%] w-[1.6%] rounded-l-sm bg-[#1F2633]" />
        <span aria-hidden className="absolute -left-[2.4%] top-[28%] h-[9.5%] w-[1.6%] rounded-l-sm bg-[#1F2633]" />
        <span aria-hidden className="absolute -right-[2.4%] top-[25%] h-[13%] w-[1.6%] rounded-r-sm bg-[#1F2633]" />
        <div className="relative aspect-[9/19.5] overflow-hidden rounded-[12.5%/5.8%] bg-white">
          {children ?? (screen && (
            <Image
              src={screen.src}
              alt={screen.alt}
              width={screen.width}
              height={screen.height}
              sizes={screen.sizes}
              priority={screen.priority}
              loading={screen.priority ? undefined : "lazy"}
              className="h-full w-full object-cover object-top"
            />
          ))}
          {/* Îlot dynamique */}
          <span aria-hidden className="absolute left-1/2 top-[1.6%] h-[3.4%] w-[30%] -translate-x-1/2 rounded-full bg-[#0B0F19]" />
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,.12)_0%,rgba(255,255,255,0)_35%)]" />
        </div>
      </div>
    </div>
  )
}

/** Captures disponibles (dimensions réelles des fichiers). */
export const SCREENS = {
  tableauDeBord: { src: "/landing/ecrans/tableau-de-bord.webp", width: 1920, height: 1200, alt: "Tableau de bord Qonforme : chiffre d'affaires du mois, montants en attente et en retard, dernières factures" },
  devis: { src: "/landing/ecrans/devis.webp", width: 1920, height: 1200, alt: "Fiche d'un devis dans Qonforme : lignes, totaux HT et TTC, envoi par email" },
  facture: { src: "/landing/ecrans/facture.webp", width: 1920, height: 1200, alt: "Fiche d'une facture envoyée dans Qonforme, avec les boutons Relancer et Marquer comme payée" },
  factures: { src: "/landing/ecrans/factures.webp", width: 1920, height: 1200, alt: "Liste des factures dans Qonforme avec leur statut" },
  mobileDevis: { src: "/landing/ecrans/mobile-devis.webp", width: 780, height: 1688, alt: "Un devis consulté sur téléphone dans Qonforme" },
  mobileTableauDeBord: { src: "/landing/ecrans/mobile-tableau-de-bord.webp", width: 780, height: 1688, alt: "Le tableau de bord Qonforme sur téléphone" },
  mobileFactures: { src: "/landing/ecrans/mobile-factures.webp", width: 780, height: 1688, alt: "La liste des factures Qonforme sur téléphone" },
  mobileFacture: { src: "/landing/ecrans/mobile-facture.webp", width: 780, height: 1688, alt: "Une facture envoyée, consultée sur téléphone dans Qonforme" },
} as const
