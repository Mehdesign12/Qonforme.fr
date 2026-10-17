import Image from "next/image"
import { Check } from "lucide-react"
import type { LandingPhoto } from "@/lib/landing/photos"

/**
 * Photo des pages d'accès (maquette « Main » de l'inscription, validée le
 * 06/10/2026, reprise pour la connexion le 17/10/2026) : un artisan au travail,
 * pleine hauteur à droite du formulaire (≥ 1024 px), et la même photo en bande
 * de 150 px sous le logo sur téléphone (`AuthPhotoBand`).
 *
 * Photos Pexels de l'accueil (lib/landing/photos.ts) : illustrations, jamais
 * des clients de Qonforme. Aucun élément flottant sur la photo (décision du
 * fondateur, 17/10/2026) : un titre en deux voix et trois engagements vrais.
 *
 * Voile sombre et texte blanc dans les deux thèmes (la photo reste sombre).
 * Ni backdrop-filter ni will-change (règle iOS de CLAUDE.md).
 */

/**
 * Même `sizes` pour le panneau et la bande : une seule image choisie dans le
 * srcset, donc un seul préchargement et un seul téléchargement, quel que soit
 * l'écran (la colonne de droite fait 1,05 / 2,05 de la largeur).
 */
const SIZES = "(min-width: 1024px) 52vw, 100vw"

export interface AuthPhotoContent {
  photo: LandingPhoto
  /** Cadrage de la photo (object-position) dans le panneau et dans la bande. */
  position?: { panel: string; band: string }
  /** Titre en deux voix : Bricolage, puis Instrument Serif italique. */
  title: string
  accent: string
  /** Engagements vrais, cochés sous le titre. */
  items: string[]
}

/** Colonne de droite, pleine hauteur (AuthLayout `asideVariant="photo"`). */
export function AuthPhotoPanel({ photo, position, title, accent, items }: AuthPhotoContent) {
  return (
    <figure className="relative m-0 h-full overflow-hidden rounded-[28px] bg-[#1B2333]">
      <Image
        src={photo.src}
        alt={photo.alt}
        fill
        priority
        sizes={SIZES}
        className="object-cover"
        style={{ objectPosition: position?.panel ?? "50% 30%" }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,17,34,0)_38%,rgba(10,17,34,.82)_100%)]"
      />

      <figcaption className="absolute inset-x-10 bottom-10 flex flex-col gap-[22px] xl:inset-x-12 xl:bottom-11">
        <p className="q-display m-0 max-w-[560px] text-[34px] leading-[1.08] tracking-[-0.03em] text-white [text-wrap:balance] xl:text-[42px]">
          {title} <em className="q-serif !text-white">{accent}</em>
        </p>
        <ul className="m-0 flex list-none flex-wrap gap-x-[26px] gap-y-2.5 p-0 text-[15px] font-medium text-white">
          {items.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <Check className="h-[17px] w-[17px] shrink-0" strokeWidth={2} aria-hidden />
              {item}
            </li>
          ))}
        </ul>
        <span className="self-end text-[12px] text-white/[.72]">Photo d’illustration</span>
      </figcaption>
    </figure>
  )
}

/** Bande photo de 150 px sous le logo, sur téléphone (< 1024 px) : la photo seule, sans texte. */
export function AuthPhotoBand({ photo, position }: Pick<AuthPhotoContent, "photo" | "position">) {
  return (
    <figure className="relative m-0 h-[150px] overflow-hidden rounded-[22px] bg-[#1B2333]">
      <Image
        src={photo.src}
        alt={photo.alt}
        fill
        priority
        sizes={SIZES}
        className="object-cover"
        style={{ objectPosition: position?.band ?? "50% 28%" }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,17,34,0)_55%,rgba(10,17,34,.28)_100%)]"
      />
    </figure>
  )
}
