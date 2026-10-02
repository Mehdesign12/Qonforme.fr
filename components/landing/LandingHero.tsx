import { getImageProps } from "next/image"
import { BellRing, Check, ChevronRight, CircleCheck, FileCheck2 } from "lucide-react"
import { PublicHeader } from "@/components/layout/PublicHeader"
import { MacBook, IPhone, SCREENS } from "@/components/landing/devices"
import { CtaButtons, Floater } from "@/components/landing/ui"
import { EXAMPLES } from "@/components/landing/examples"
import { formatCurrency } from "@/lib/utils/invoice"

/**
 * Héros de l'accueil : variante « Clair sobre » validée (DECISIONS § 6), au
 * langage du canevas « Main » v20 : titre en deux voix, vrai produit dans un
 * ordinateur et un téléphone, notifications flottantes.
 *
 * Le titre validé finit par « conforme de bout en bout ». Il reviendra quand la
 * transmission par plateforme agréée sera livrée ; d'ici là, on ne promet que
 * ce que le produit fait déjà. Les notifications ne montrent que des actions
 * qui existent (relance, devis accepté, facture marquée payée), avec les
 * données d'exemple de la démo (lib/demo/data.ts).
 *
 * Entrée en CSS pur (.lp-fade-up, .lp-tilt, .lp-phone-in) : elle joue avant
 * l'hydratation, et « Réduire les animations » l'annule.
 */

const PROMISES = ["Devis gratuits et illimités", "Sans carte bancaire", "Vous payez à la première facture"]

const { relance: RELANCE, accepte: ACCEPTE, payee: PAYEE } = EXAMPLES

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
        <MacBook screenClassName="max-sm:aspect-[390/844]" baseClassName="max-sm:hidden">
          <HeroScreen />
        </MacBook>
      </div>

      {/* Téléphone : monte un peu plus vite que la page (masqué sur petit écran) */}
      <div className="lp-drift absolute bottom-0 left-0 z-[3] hidden w-[clamp(150px,18vw,236px)] min-[861px]:block min-[1320px]:left-[-36px]">
        <IPhone className="lp-phone-in" screen={{ ...SCREENS.mobileTableauDeBord, sizes: "236px" }} />
      </div>

      {/* Notifications : seulement quand elles tiennent hors de l'écran de l'ordinateur */}
      <div aria-hidden className="lp-fade-up absolute left-[-72px] top-[-48px] z-[5] hidden min-[1320px]:block" style={{ animationDelay: "1.65s" }}>
        <Floater icon={BellRing} tone="warn" title="Relance envoyée" sub={`${RELANCE.client.name} · ${RELANCE.invoice_number}`} bob={1} />
      </div>
      <div aria-hidden className="lp-fade-up absolute right-[-64px] top-[-34px] z-[5] hidden min-[1320px]:block" style={{ animationDelay: "1.5s" }}>
        <Floater icon={FileCheck2} tone="ok" title={`Devis ${ACCEPTE.quote_number} accepté`} sub={`${ACCEPTE.client.name} · ${formatCurrency(ACCEPTE.total_ttc)}`} bob={2} />
      </div>
      <div aria-hidden className="lp-fade-up absolute right-[-72px] top-[66%] z-[5] hidden min-[1320px]:block" style={{ animationDelay: "1.8s" }}>
        <Floater icon={CircleCheck} tone="info" title={`Facture ${PAYEE.invoice_number} payée`} sub={`${PAYEE.client.name} · ${formatCurrency(PAYEE.total_ttc)}`} bob={3} />
      </div>
    </div>
  )
}

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative bg-q-surface px-6">
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
          <span className="sm:block">La facturation des pros du bâtiment,</span>{" "}
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
      </div>

      <HeroDevices />
    </section>
  )
}

export function LandingHero() {
  return (
    <>
      <PublicHeader isLandingPage />
      <Hero />
    </>
  )
}
