import { getImageProps } from "next/image"
import { Calculator, Check, ChevronRight, FileText, Hammer, HardHat, ReceiptText, Ruler } from "lucide-react"
import { MacBook, IPhone, PhoneChrome, SCREENS } from "@/components/landing/devices"
import { Doodles } from "@/components/brand/Doodles"
import { CtaButtons } from "@/components/landing/ui"
import { SolutionCompatible } from "@/components/brand/SolutionCompatible"

/**
 * Héros de l'accueil : variante « Clair sobre » validée (DECISIONS § 6), au
 * langage du canevas « Main » v20 : titre en deux voix, vrai produit dans un
 * ordinateur et un téléphone. Aucun élément flottant (décision du fondateur,
 * 17/10/2026) : le produit parle seul.
 *
 * Le titre validé finit par « conforme de bout en bout ». Il reviendra quand la
 * transmission par plateforme agréée sera livrée ; d'ici là, on ne promet que
 * ce que le produit fait déjà.
 *
 * Entrée en CSS pur (.lp-fade-up, .lp-tilt, .lp-phone-in) : elle joue avant
 * l'hydratation, et « Réduire les animations » l'annule.
 */

/** Décor du héros : devis et facture en bleu plein, l'outillage du chantier en bleu pâle (gauche ×3, droite ×3). */
const DOODLE_ICONS = [FileText, Ruler, HardHat, Hammer, ReceiptText, Calculator]

const PROMISES = ["Devis gratuits et illimités", "Sans carte bancaire", "Vous payez à la première facture"]

/**
 * Capture du tableau de bord : version ordinateur dès 640 px, version téléphone
 * en dessous (une seule des deux est téléchargée). C'est l'image prioritaire de
 * la page.
 */
function HeroScreen() {
  const { tableauDeBord: desk, mobileTableauDeBord: mob } = SCREENS
  const {
    props: { srcSet: deskSrcSet, sizes: deskSizes },
  } = getImageProps({ src: desk.src, alt: desk.alt, width: desk.width, height: desk.height, sizes: "(min-width: 1248px) 1172px, 92vw", priority: true })
  const { props: mobProps } = getImageProps({ src: mob.src, alt: desk.alt, width: mob.width, height: mob.height, sizes: "92vw", priority: true })

  return (
    <picture>
      <source media="(min-width: 640px)" srcSet={deskSrcSet} sizes={deskSizes} />
      {/* eslint-disable-next-line @next/next/no-img-element -- <picture> : getImageProps fournit les attributs optimisés */}
      <img {...mobProps} alt={desk.alt} className="absolute inset-0 h-full w-full object-cover object-top" />
    </picture>
  )
}

function HeroDevices() {
  return (
    <div className="relative mx-auto mt-[clamp(40px,6vw,72px)] max-w-[1200px] pb-12 sm:pb-16">
      <div className="lp-tilt">
        <MacBook screenClassName="max-sm:aspect-[393/852]" baseClassName="max-sm:hidden">
          <HeroScreen />
          {/* Sur téléphone, l'ordinateur devient un téléphone : barre d'état et indicateur d'accueil */}
          <PhoneChrome className="sm:hidden" />
        </MacBook>
      </div>

      {/* Téléphone : monte un peu plus vite que la page (masqué sur petit écran) */}
      <div className="lp-drift absolute bottom-0 left-0 z-[3] hidden w-[clamp(150px,18vw,236px)] min-[861px]:block min-[1320px]:left-[-36px]">
        <IPhone className="lp-phone-in" screen={{ ...SCREENS.mobileTableauDeBord, sizes: "236px" }} />
      </div>
    </div>
  )
}

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative bg-q-surface px-6">
      <Doodles layout="hero" icons={DOODLE_ICONS} />
      <div className="mx-auto flex max-w-[1200px] flex-col items-center pt-[120px] text-center sm:pt-[150px]">
        <a
          href="#reforme"
          className="lp-fade-up group flex max-w-full flex-col items-center gap-2.5 text-[13.5px] leading-[1.35] text-q-text-2 [text-wrap:balance] sm:flex-row sm:rounded-full sm:border sm:border-q-line sm:bg-q-surface sm:py-[5px] sm:pl-[5px] sm:pr-3.5 sm:text-left sm:shadow-[0_1px_2px_rgba(10,17,34,.04)] sm:transition-[border-color,box-shadow] sm:hover:border-q-field sm:hover:shadow-[0_1px_2px_rgba(10,17,34,.05),0_8px_20px_-12px_rgba(10,17,34,.22)]"
        >
          <span className="shrink-0 whitespace-nowrap rounded-full bg-[#0A1122] px-2.5 py-1 text-[12px] font-semibold tabular-nums tracking-[.01em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.14)]">
            1er sept. 2027
          </span>
          <span>Émission de factures électroniques obligatoire pour les TPE</span>
          <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-q-text-4 transition-transform group-hover:translate-x-0.5 sm:block" strokeWidth={2} aria-hidden />
        </a>

        <h1
          id="hero-title"
          className="lp-fade-up mt-7 max-w-[1100px] font-display text-[clamp(38px,5vw,68px)] font-semibold leading-[1.04] tracking-[-0.04em] text-q-ink-strong [text-wrap:balance]"
          style={{ animationDelay: ".08s" }}
        >
          <span className="sm:block">La facturation des artisans du bâtiment,</span>{" "}
          <span className="q-serif sm:block">simple dès le premier devis.</span>
        </h1>

        <p
          className="lp-fade-up mt-6 max-w-[640px] text-[clamp(17px,1.4vw,19px)] leading-[1.6] text-q-text-3 [text-wrap:pretty]"
          style={{ animationDelay: ".16s" }}
        >
          Devis, factures, relances et suivi des paiements, au bureau comme sur le chantier.
          Vos devis sont gratuits&nbsp;: vous payez quand vous facturez.
        </p>

        <div className="lp-fade-up mt-9 flex w-full justify-center" style={{ animationDelay: ".24s" }}>
          <CtaButtons />
        </div>

        <ul
          className="lp-fade-up mt-5 flex flex-col items-center gap-x-[22px] gap-y-2 text-[14px] text-q-text-3 sm:flex-row sm:flex-wrap sm:justify-center"
          style={{ animationDelay: ".32s" }}
        >
          {PROMISES.map((p) => (
            <li key={p} className="inline-flex items-center gap-[7px]">
              <Check className="h-[15px] w-[15px] text-q-accent" strokeWidth={2.25} aria-hidden />
              {p}
            </li>
          ))}
        </ul>

        {/* Label de la DGFiP : règles de la charte dans components/brand/SolutionCompatible.tsx */}
        <div className="lp-fade-up mt-8" style={{ animationDelay: ".4s" }}>
          <SolutionCompatible priority />
        </div>
      </div>

      <HeroDevices />
    </section>
  )
}

/** Héros de l'accueil. L'en-tête du site est rendu par la page, hors du <main>. */
export function LandingHero() {
  return <Hero />
}
