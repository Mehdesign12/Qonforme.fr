import Image from "next/image"
import { Check, FileCheck2, Send } from "lucide-react"
import { PHOTOS } from "@/lib/landing/photos"
import { demoQuote } from "@/lib/demo/data"
import { formatCurrency } from "@/lib/utils/invoice"
import { cn } from "@/lib/utils"

/**
 * Photo de l'inscription (maquette « Main » validée le 06/10/2026) : un artisan
 * au travail, pleine hauteur à droite du formulaire (≥ 1024 px), et la même
 * photo en bande de 150 px sous le logo sur téléphone (`SignupPhotoBand`).
 *
 * Photo Pexels de l'accueil (lib/landing/photos.ts) : illustration, jamais un
 * client de Qonforme. Les deux cartes flottantes reprennent un devis de la démo
 * (lib/demo/data.ts), annoncé comme donnée d'exemple dans la légende.
 *
 * Voile sombre et texte blanc dans les deux thèmes (la photo reste sombre) ;
 * cartes sur les jetons --q-surface. Ni backdrop-filter ni will-change
 * (règle iOS de CLAUDE.md).
 */
const PHOTO = PHOTOS.sansLogiciel ?? {
  src: "/landing/photos/electricien.webp",
  width: 1000,
  height: 1250,
  alt: "Un électricien intervient sur un tableau électrique",
}

/**
 * Même `sizes` pour le panneau et la bande : une seule image choisie dans le
 * srcset, donc un seul préchargement et un seul téléchargement, quel que soit
 * l'écran (la colonne de droite fait 1,05 / 2,05 de la largeur).
 */
const SIZES = "(min-width: 1024px) 52vw, 100vw"

const QUOTE = demoQuote("D-2026-035")

/** Carte flottante : pastille d'icône, titre, ligne de détail. */
function FloatCard({
  icon, tone, title, detail, className,
}: {
  icon: React.ReactNode
  tone: "ok" | "info"
  title: string
  detail: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-q-line bg-q-surface py-2.5 pl-2.5 pr-[18px] shadow-[0_1px_2px_rgba(10,17,34,.05),0_18px_36px_-16px_rgba(10,17,34,.28)]",
        className,
      )}
    >
      <span
        className={cn(
          "grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px]",
          tone === "ok" ? "bg-q-ok-bg text-q-ok" : "bg-q-wash text-q-accent-strong",
        )}
      >
        {icon}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-q-ink-strong">{title}</span>
        <span className="text-[12px] text-q-text-3">{detail}</span>
      </span>
    </div>
  )
}

/** Colonne de droite de l'inscription, pleine hauteur (AuthLayout `asideVariant="photo"`). */
export default function SignupPhotoPanel() {
  return (
    <figure className="relative m-0 h-full overflow-hidden rounded-[28px] bg-[#1B2333]">
      <Image
        src={PHOTO.src}
        alt={PHOTO.alt}
        fill
        priority
        sizes={SIZES}
        className="object-cover object-[50%_30%]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,17,34,0)_42%,rgba(10,17,34,.80)_100%)]"
      />

      {/* Données d'exemple (légende) : décor, hors de la lecture d'écran */}
      <div aria-hidden className="absolute right-8 top-8 flex flex-col items-end gap-3 xl:right-9 xl:top-9">
        <FloatCard
          tone="ok"
          icon={<Send className="h-[17px] w-[17px]" strokeWidth={1.75} />}
          title={`Devis ${QUOTE?.quote_number ?? "D-2026-035"} envoyé`}
          detail={
            <>
              {QUOTE?.client.name ?? "M. et Mme Lambert"} ·{" "}
              <span className="tabular-nums">{formatCurrency(QUOTE?.total_ttc ?? 4024.3)}</span>&nbsp;TTC
            </>
          }
        />
        <FloatCard
          tone="info"
          className="mr-11"
          icon={<FileCheck2 className="h-[17px] w-[17px]" strokeWidth={1.75} />}
          title="Mentions obligatoires"
          detail="SIREN, TVA, durée de validité"
        />
      </div>

      <figcaption className="absolute inset-x-10 bottom-10 flex flex-col gap-[22px] xl:inset-x-12 xl:bottom-11">
        <p className="q-display m-0 max-w-[560px] text-[34px] leading-[1.08] tracking-[-0.03em] text-white [text-wrap:balance] xl:text-[42px]">
          Vos devis entre deux chantiers, <em className="q-serif !text-white">pas le dimanche soir.</em>
        </p>
        <ul className="m-0 flex list-none flex-wrap gap-x-[26px] gap-y-2.5 p-0 text-[15px] font-medium text-white">
          {["Sans carte bancaire", "Sans engagement", "Sur ordinateur et téléphone"].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <Check className="h-[17px] w-[17px] shrink-0" strokeWidth={2} aria-hidden />
              {item}
            </li>
          ))}
        </ul>
        <span className="self-end text-[12px] text-white/[.72]">Photo d’illustration · données d’exemple</span>
      </figcaption>
    </figure>
  )
}

/** Bande photo de 150 px sous le logo, sur téléphone (< 1024 px) : la photo seule, sans texte. */
export function SignupPhotoBand() {
  return (
    <figure className="relative m-0 h-[150px] overflow-hidden rounded-[22px] bg-[#1B2333]">
      <Image
        src={PHOTO.src}
        alt={PHOTO.alt}
        fill
        priority
        sizes={SIZES}
        className="object-cover object-[50%_28%]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,17,34,0)_55%,rgba(10,17,34,.28)_100%)]"
      />
    </figure>
  )
}
