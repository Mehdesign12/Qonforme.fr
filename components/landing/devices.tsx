import Image from "next/image"
import { cn } from "@/lib/utils"

/**
 * Cadres d'appareils de l'accueil, en CSS pur (aucune image de cadre à charger),
 * aux proportions du canevas « Main » v20.
 * Les écrans affichés sont de vraies captures du produit (pages de démo,
 * données fictives) : public/landing/ecrans/.
 *
 * Ni backdrop-filter ni will-change (règle iOS de CLAUDE.md) : les ombres sont
 * de simples box-shadow. La découpe passe par .lp-clip (overflow: clip) pour ne
 * pas figer les animations au défilement des éléments contenus.
 */

export interface ScreenProps {
  src: string
  alt: string
  /** Largeur et hauteur réelles du fichier. */
  width: number
  height: number
  sizes: string
  priority?: boolean
}

function ScreenImage({ screen }: { screen: ScreenProps }) {
  return (
    <Image
      src={screen.src}
      alt={screen.alt}
      fill
      sizes={screen.sizes}
      priority={screen.priority}
      loading={screen.priority ? undefined : "lazy"}
      className="object-cover object-top"
    />
  )
}

/**
 * Ordinateur portable : coque marine arrondie, écran 16/10, socle plus large
 * que l'écran. `screenClassName` remplace le format de l'écran (héros mobile),
 * `baseClassName` permet de masquer le socle.
 */
export function MacBook({
  screen,
  className,
  screenClassName,
  baseClassName,
  children,
}: {
  screen?: ScreenProps
  className?: string
  screenClassName?: string
  baseClassName?: string
  children?: React.ReactNode
}) {
  return (
    <div className={cn("relative", className)}>
      <div className="relative rounded-[clamp(16px,2.2vw,26px)] bg-[#0B0F19] p-[clamp(7px,1.15vw,14px)] shadow-[inset_0_0_0_1px_#2A3140,0_50px_90px_-42px_rgba(10,17,34,.55),0_24px_40px_-30px_rgba(10,17,34,.35)]">
        <span aria-hidden className="absolute left-1/2 top-[clamp(2px,.35vw,5px)] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#273041]" />
        <div className={cn("lp-clip relative aspect-[16/10] rounded-[clamp(8px,1vw,12px)] bg-[#F6F8FB]", screenClassName)}>
          {children ?? (screen && <ScreenImage screen={screen} />)}
        </div>
      </div>
      <div
        aria-hidden
        className={cn(
          "relative mx-[-5%] h-[clamp(8px,1.6vw,22px)] rounded-[3px_3px_26px_26px/3px_3px_22px_22px] bg-[linear-gradient(180deg,#E7EAEE_0%,#CCD1D8_55%,#A8AEB8_100%)] shadow-[0_30px_44px_-26px_rgba(10,17,34,.45)]",
          baseClassName,
        )}
      >
        <span className="absolute left-1/2 top-0 h-[40%] w-[16%] -translate-x-1/2 rounded-b-[12px] bg-[linear-gradient(180deg,#B7BDC6,#D9DDE2)]" />
      </div>
    </div>
  )
}

/**
 * Téléphone : coque arrondie 16 % / 7,4 %, écran 390/844 arrondi 12,6 % / 5,8 %,
 * îlot dynamique et boutons latéraux. L'écran est décalé sous l'îlot (11 % de la
 * largeur) pour que l'îlot ne cache jamais le haut de la capture.
 */
export function IPhone({
  screen,
  className,
  children,
}: {
  screen?: ScreenProps
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div className={cn("relative", className)}>
      <div className="relative rounded-[16%/7.4%] bg-[#0B0F19] p-[3.3%] shadow-[inset_0_0_0_1.5px_#2F3747,inset_0_0_0_3px_#0B0F19,0_50px_80px_-32px_rgba(10,17,34,.5),0_18px_30px_-20px_rgba(10,17,34,.32)]">
        <span aria-hidden className="absolute left-[-1.4%] top-[16%] h-[4.5%] w-[3px] rounded-[2px] bg-[#1F2633]" />
        <span aria-hidden className="absolute left-[-1.4%] top-[23%] h-[8%] w-[3px] rounded-[2px] bg-[#1F2633]" />
        <span aria-hidden className="absolute right-[-1.4%] top-[21%] h-[11%] w-[3px] rounded-[2px] bg-[#1F2633]" />
        <div className="lp-clip relative flex aspect-[390/844] flex-col rounded-[12.6%/5.8%] bg-[#F6F8FB] pt-[11%]">
          <span aria-hidden className="absolute left-1/2 top-[1.5%] z-[2] aspect-[10/3] w-[30%] -translate-x-1/2 rounded-full bg-[#0B0F19]" />
          <div className="relative min-h-0 flex-1">{children ?? (screen && <ScreenImage screen={screen} />)}</div>
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
