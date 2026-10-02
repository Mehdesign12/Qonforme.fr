"use client"

import Image from "next/image"
import { useState } from "react"
import { IPhone, SCREENS } from "@/components/landing/devices"
import { SectionTitle } from "@/components/landing/ui"
import { PHOTOS } from "@/lib/landing/photos"
import { cn } from "@/lib/utils"

/**
 * « Du premier devis au dernier paiement » : quatre étapes et un téléphone qui
 * montre l'écran de l'étape choisie (survol, clic ou focus clavier). Mise en
 * page du canevas v20 (« cycle complet »), contenu limité à ce qui existe :
 * ni signature en ligne ni transmission par plateforme agréée.
 */

const STORY = [
  {
    n: "01",
    title: "Un devis propre, en quelques minutes",
    text: "Votre entreprise se remplit avec votre numéro SIREN. Vos prestations vont dans un catalogue, puis dans vos devis en un clic, avec la TVA à 5,5, 10 ou 20 % ligne par ligne.",
    screen: SCREENS.mobileDevis,
  },
  {
    n: "02",
    title: "Le devis accepté devient une facture",
    text: "Un clic, et toutes les lignes passent sur la facture. Rien à ressaisir, et la numérotation se suit toute seule.",
    screen: SCREENS.mobileFacture,
  },
  {
    n: "03",
    title: "Envoyée par email, relancée sans vous",
    text: "La facture part en PDF à votre client, avec votre IBAN. Si elle reste impayée, Qonforme relance votre client 30 puis 45 jours après l'échéance.",
    screen: SCREENS.mobileFactures,
  },
  {
    n: "04",
    title: "Vous savez où vous en êtes",
    text: "Encaissé, en attente, en retard : votre tableau de bord vous le dit d'un coup d'œil. L'export FEC est prêt pour votre comptable.",
    screen: SCREENS.mobileTableauDeBord,
  },
]

export function StorySection() {
  const [active, setActive] = useState(0)
  const photo = PHOTOS.chezLeClient

  return (
    <section id="features" className="border-y border-q-line bg-q-bg px-6 py-[clamp(88px,9vw,120px)]">
      <div className="mx-auto grid max-w-[1200px] items-center gap-14 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <SectionTitle
            title="Du premier devis"
            accent="au dernier paiement."
            sub="Quatre étapes, un seul outil. Voici le vrai Qonforme, avec des données d'exemple."
          />
          <ol className="mt-10 grid gap-4 sm:grid-cols-2">
            {STORY.map((step, i) => {
              const on = active === i
              return (
                <li key={step.n} className={cn("lp-reveal", i % 2 === 1 && "lp-d1")}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setActive(i)}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    className={cn(
                      "flex h-full w-full flex-col gap-2.5 rounded-2xl border p-6 text-left transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-q-accent",
                      on ? "border-q-ink-strong bg-q-ink-strong" : "border-q-line bg-q-surface hover:border-q-field",
                    )}
                  >
                    <span className={cn("font-mono text-[12px]", on ? "text-q-surface opacity-60" : "text-q-text-4")}>{step.n}</span>
                    <span className={cn("text-[17px] font-semibold leading-snug", on ? "text-q-surface" : "text-q-ink-strong")}>{step.title}</span>
                    <span className={cn("text-[15px] leading-[1.55]", on ? "text-q-surface opacity-75" : "text-q-text-3")}>{step.text}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>

        {/* Le téléphone montre l'écran de l'étape choisie, sur une photo d'illustration */}
        <div className="relative mx-auto w-full max-w-[360px] pt-10 lg:pt-16">
          {photo && (
            <div className="lp-reveal lp-clip absolute right-[-6%] top-0 aspect-[4/3] w-[78%] rounded-[22px] bg-q-sunken lg:right-[-24%]">
              <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 1024px) 280px, 70vw" loading="lazy" className="object-cover" />
            </div>
          )}
          <IPhone className="lp-reveal lp-d1 relative z-[2] w-[min(290px,72%)] lg:ml-[-4%]">
            {STORY.map((step, i) => (
              <div
                key={step.n}
                aria-hidden={active !== i}
                className={cn("absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none", active === i ? "opacity-100" : "opacity-0")}
              >
                <Image src={step.screen.src} alt={step.screen.alt} fill sizes="290px" loading="lazy" className="object-cover object-top" />
              </div>
            ))}
          </IPhone>
          <p className="relative z-[2] mt-4 w-[min(290px,72%)] text-center text-[13px] text-q-text-4 lg:ml-[-4%]" aria-live="polite">
            Étape {STORY[active].n}
          </p>
        </div>
      </div>
    </section>
  )
}
