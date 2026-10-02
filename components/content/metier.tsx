import Image from "next/image"
import { Check, FileText } from "lucide-react"
import { PHOTOS, type LandingPhoto } from "@/lib/landing/photos"
import type { Metier } from "@/lib/pseo/metiers"
import { SectionHeading } from "./ui"
import { fr } from "./text"

/**
 * Blocs des pages « Facturation par métier » (/facturation/[slug] et sa
 * déclinaison par ville), partagés pour garder les deux pages identiques.
 */

/** Photos des métiers du bâtiment (mêmes photos que l'accueil, lib/landing/photos). */
export const TRADE_PHOTOS: Record<string, LandingPhoto | null> = {
  plombier: PHOTOS.plombier,
  electricien: PHOTOS.sansLogiciel,
  macon: PHOTOS.macon,
  peintre: PHOTOS.chantier,
  carreleur: PHOTOS.carreleur,
  menuisier: PHOTOS.menuisier,
  couvreur: PHOTOS.couvreur,
  plaquiste: PHOTOS.plaquiste,
  chauffagiste: PHOTOS.chauffagiste,
}

/**
 * Photo du métier pour l'en-tête (prop media de ContentHero), ou undefined
 * s'il n'y en a pas. Au-dessus de la ligne de flottaison : priority.
 */
export function tradeHeroPhoto(slug: string): React.ReactNode | undefined {
  const photo = TRADE_PHOTOS[slug]
  if (!photo) return undefined
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-[24px] border border-q-line bg-q-sunken lg:aspect-[4/5]">
      <Image src={photo.src} alt={photo.alt} fill priority sizes="(max-width: 1024px) 100vw, 400px" className="object-cover" />
    </div>
  )
}

/** Fonctions utiles au métier (lib/pseo/metiers.ts ne liste que des fonctions livrées). */
export function MetierFeatures({ metier, limit }: { metier: Metier; limit?: number }) {
  const features = metier.features.slice(0, limit)
  if (features.length === 0) return null
  return (
    <section aria-labelledby="fonctions" className="px-4 pt-6 sm:px-6">
      <div className="mx-auto w-full max-w-[1200px]">
        <SectionHeading id="fonctions" title="Ce qui vous" accent="fait gagner du temps." className="mb-8" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {features.map((f) => (
            <div key={f.titre} className="rounded-[20px] border border-q-line bg-q-surface p-6 shadow-[var(--q-shadow-card)]">
              <span className="mb-5 grid h-10 w-10 place-items-center rounded-xl bg-q-wash text-q-accent-strong">
                <FileText className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="font-display text-[19px] font-semibold leading-[1.25] tracking-[-0.02em] text-q-ink-strong">{fr(f.titre)}</h3>
              <p className="mt-2 text-[14px] leading-[1.6] text-q-text-3">{fr(f.texte)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Obligations légales du métier : liste cochée dans une carte. */
export function MetierObligations({ metier }: { metier: Metier }) {
  if (metier.obligations.length === 0) return null
  return (
    <section aria-labelledby="obligations" className="px-4 pt-16 sm:px-6 sm:pt-20">
      <div className="mx-auto grid w-full max-w-[1200px] gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
        <SectionHeading
          id="obligations"
          title="Obligations légales"
          accent="du métier."
          sub="Les mentions et règles à respecter sur vos devis et vos factures."
        />
        <ul className="q-card q-list overflow-hidden">
          {metier.obligations.map((o) => (
            <li key={o} className="flex items-start gap-3 px-5 py-4 text-[15px] leading-[1.55] text-q-text-2">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-q-ok-bg text-q-ok">
                <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
              </span>
              {fr(o)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
