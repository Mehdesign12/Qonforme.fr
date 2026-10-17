import Image from "next/image"
import { cn } from "@/lib/utils"

/**
 * Cadres d'appareils de l'accueil, en CSS pur (aucune image de cadre à charger),
 * aux proportions du canevas « Main » v20.
 * Les écrans affichés sont de vraies captures du produit (pages de démo,
 * données fictives) : public/landing/ecrans/ (scripts/capture-landing-screens.mjs).
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
 * Écran d'iPhone 15, en points. Les captures mobiles (public/landing/ecrans/mobile-*)
 * sont prises à cette taille avec ses zones sûres simulées (59 points en haut pour
 * la barre d'état et l'îlot, 34 en bas pour l'indicateur d'accueil) : la page s'y
 * place comme sur le téléphone, et la capture remplit l'écran sans être rognée.
 */
export const PHONE = { width: 393, height: 852, safeTop: 59, safeBottom: 34 } as const

const GLYPH = "#0B0F19"

/**
 * Barre d'état (heure, réseau, wifi, batterie), îlot et indicateur d'accueil,
 * dessinés par-dessus la capture dans ses zones sûres, vides : rien de la page
 * n'est caché. En SVG à l'échelle de l'écran, quelle que soit la taille du téléphone.
 */
export function PhoneChrome({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 z-[2]", className)}>
      <svg className="absolute inset-x-0 top-0 h-auto w-full" viewBox={`0 0 ${PHONE.width} ${PHONE.safeTop}`}>
        <text x="64" y="35.5" textAnchor="middle" fontSize="17" fontWeight="600" letterSpacing="-0.2" fill={GLYPH} fontFamily="-apple-system, 'SF Pro Text', 'DM Sans', system-ui, sans-serif">9:41</text>
        <rect x="133.5" y="11" width="126" height="37.5" rx="18.75" fill={GLYPH} />
        {/* Réseau */}
        <rect x="294" y="31" width="3" height="4" rx="1" fill={GLYPH} />
        <rect x="298.5" y="28.6" width="3" height="6.4" rx="1" fill={GLYPH} />
        <rect x="303" y="26.3" width="3" height="8.7" rx="1" fill={GLYPH} />
        <rect x="307.5" y="24" width="3" height="11" rx="1" fill={GLYPH} />
        {/* Wifi */}
        <g fill="none" stroke={GLYPH} strokeWidth="2" strokeLinecap="round">
          <path d="M318.3 30.3 A4.9 4.9 0 0 1 325.7 30.3" />
          <path d="M315.2 27.3 A9.2 9.2 0 0 1 328.8 27.3" />
        </g>
        <circle cx="322" cy="33.4" r="1.7" fill={GLYPH} />
        {/* Batterie */}
        <rect x="337.5" y="24.25" width="24.5" height="11.5" rx="3.6" fill="none" stroke={GLYPH} strokeOpacity=".38" />
        <rect x="339.5" y="26.25" width="20.5" height="7.5" rx="2.1" fill={GLYPH} />
        <rect x="363.2" y="28" width="1.7" height="4" rx=".85" fill={GLYPH} fillOpacity=".4" />
      </svg>
      <svg className="absolute inset-x-0 bottom-0 h-auto w-full" viewBox={`0 0 ${PHONE.width} ${PHONE.safeBottom}`}>
        <rect x="129.5" y="21" width="134" height="5" rx="2.5" fill={GLYPH} />
      </svg>
    </div>
  )
}

/**
 * Téléphone : coque arrondie 16 % / 7,4 %, écran d'iPhone 15 (393/852) arrondi
 * 12,6 % / 5,8 %, boutons latéraux. La capture occupe tout l'écran ; la barre
 * d'état, l'îlot et l'indicateur d'accueil tombent dans ses zones sûres.
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
        <div className="lp-clip relative aspect-[393/852] rounded-[12.6%/5.8%] bg-[#F6F8FB]">
          {children ?? (screen && <ScreenImage screen={screen} />)}
          <PhoneChrome />
        </div>
      </div>
    </div>
  )
}

/**
 * Série de captures en ligne. Une nouvelle série (scripts/capture-landing-screens.mjs)
 * va dans un nouveau dossier, puis ce chemin change : l'optimisation d'images de
 * Vercel garde une image tant que son adresse ne change pas.
 */
const ECRANS = "/landing/ecrans/v2"

/**
 * Captures disponibles (dimensions réelles des fichiers) : pages de la démo,
 * ordinateur en 1280 × 800 à 1,5, téléphone en 393 × 852 à 2 avec ses zones sûres.
 */
export const SCREENS = {
  tableauDeBord: { src: `${ECRANS}/tableau-de-bord.webp`, width: 1920, height: 1200, alt: "Tableau de bord Qonforme : chiffre d'affaires du mois, montants en attente et en retard, dernières factures" },
  devis: { src: `${ECRANS}/devis.webp`, width: 1920, height: 1200, alt: "Fiche d'un devis dans Qonforme : lignes, totaux HT et TTC, envoi par email" },
  facture: { src: `${ECRANS}/facture.webp`, width: 1920, height: 1200, alt: "Fiche d'une facture envoyée dans Qonforme, avec les boutons Relancer et Marquer comme payée" },
  factures: { src: `${ECRANS}/factures.webp`, width: 1920, height: 1200, alt: "Liste des factures dans Qonforme avec leur statut" },
  catalogue: { src: `${ECRANS}/catalogue.webp`, width: 1920, height: 1200, alt: "Catalogue de prestations dans Qonforme : unité, prix net HT et taux de TVA de chaque ligne" },
  relances: { src: `${ECRANS}/relances.webp`, width: 1920, height: 1200, alt: "Page Relances de Qonforme : relances à venir, déjà envoyées, et documents à traiter soi-même" },
  mobileDevis: { src: `${ECRANS}/mobile-devis.webp`, width: 786, height: 1704, alt: "Un devis consulté sur téléphone dans Qonforme" },
  mobileTableauDeBord: { src: `${ECRANS}/mobile-tableau-de-bord.webp`, width: 786, height: 1704, alt: "Le tableau de bord Qonforme sur téléphone" },
  mobileFactures: { src: `${ECRANS}/mobile-factures.webp`, width: 786, height: 1704, alt: "La liste des factures Qonforme sur téléphone" },
  mobileFacture: { src: `${ECRANS}/mobile-facture.webp`, width: 786, height: 1704, alt: "Une facture envoyée, consultée sur téléphone dans Qonforme" },
  mobileRelances: { src: `${ECRANS}/mobile-relances.webp`, width: 786, height: 1704, alt: "Les relances à venir, consultées sur téléphone dans Qonforme" },
  mobileCatalogue: { src: `${ECRANS}/mobile-catalogue.webp`, width: 786, height: 1704, alt: "Le catalogue de prestations, consulté sur téléphone dans Qonforme" },
} as const
