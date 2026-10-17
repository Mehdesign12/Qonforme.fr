import Link from "next/link"
import { CalendarClock, Check, FileText, PencilRuler, ReceiptText, RotateCcw, Send } from "lucide-react"

import { Doodles } from "@/components/brand/Doodles"

import { CountUp } from "@/components/design/CountUp"
import { D_SECTION, D_WRAP, SIGNUP_HREF } from "@/components/design/kit"
import { CtaButtons, SectionTitle } from "@/components/landing/ui"
import { TRADE_CATALOGUES } from "@/lib/catalogue/trades"
import { GUARANTEE_DAYS } from "@/lib/stripe/access"
import { PLANS } from "@/lib/stripe/plans"
import { cn } from "@/lib/utils"

/**
 * Bandeaux de la variante B de l'accueil (/design) : le bandeau bleu « aussi
 * simple », les quatre chiffres de l'offre et les trois cartes « gagnez du temps ».
 *
 * Les chiffres d'utilisateurs, de devis ou de chantiers de la page de référence
 * ne sont pas repris : Qonforme n'en publie aucun. Chaque nombre affiché vient
 * de la source qui fait foi (grille de lib/stripe/plans.ts, garantie de
 * lib/stripe/access.ts, catalogues de lib/catalogue/trades.ts) : il change
 * avec elle, jamais à la main.
 *
 * Couleurs par jetons --q-* (thème sombre compris), sauf le bandeau bleu,
 * identique dans les deux thèmes. Mouvement : apparitions au défilement
 * (data-reveal) et nombres comptés à l'entrée (CountUp), valeur finale sans
 * JavaScript et avec « Réduire les animations ».
 */

const DELAYS = ["", "lp-d1", "lp-d2", "lp-d3"] as const
const NB = " "
const essentiel = PLANS.starter

/* ─────────────────────────────────────────────────────────
   Bandeau bleu pleine largeur : une phrase, trois coches
───────────────────────────────────────────────────────── */
const SIMPLE_POINTS = [
  "Dans le navigateur, rien à installer",
  "Ordinateur, tablette et téléphone",
  "Devis gratuits et illimités",
]

export function SimpleBand() {
  return (
    <section className="bg-[#2563EB] px-6 py-[clamp(56px,6vw,72px)] text-white">
      <div className={cn(D_WRAP, "flex flex-col items-center text-center")}>
        <h2
          data-reveal=""
          className="max-w-[860px] font-display text-[clamp(28px,3.4vw,42px)] font-semibold leading-[1.1] tracking-[-0.03em] text-white [text-wrap:balance]"
        >
          {"Gérer vos devis et factures n'a jamais été aussi simple"}
        </h2>
        {/* Téléphone : les coches partagent un bord gauche sous le titre centré */}
        <ul className="mx-auto mt-7 flex w-fit flex-col items-start gap-3 md:w-auto md:flex-row md:flex-wrap md:items-center md:justify-center md:gap-x-10">
          {SIMPLE_POINTS.map((point, i) => (
            <li
              key={point}
              data-reveal=""
              className={cn("flex items-start gap-2.5 text-[16px] font-medium leading-[1.4] text-white sm:text-[17px]", DELAYS[i + 1])}
            >
              <Check className="mt-[3px] h-[18px] w-[18px] shrink-0 text-white" strokeWidth={2.25} aria-hidden />
              <span className="min-w-0 text-left">{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   Quatre chiffres de l'offre (à la place des chiffres
   d'utilisateurs de la référence). Le nombre et son unité
   sont séparés : l'unité, plus petite, tient sur deux
   colonnes de téléphone comme sur quatre colonnes à 1 024 px.
───────────────────────────────────────────────────────── */
const TRADE_COUNT = Object.keys(TRADE_CATALOGUES).filter((k) => k !== "autre").length

const OFFER_FACTS = [
  { icon: FileText, value: 0, unit: "€", label: "pour vos devis, sans limite" },
  { icon: ReceiptText, value: essentiel.monthlyPrice, unit: `€${NB}HT`, label: `par mois pour facturer (${essentiel.name})` },
  { icon: RotateCcw, value: GUARANTEE_DAYS, unit: "jours", label: "satisfait ou remboursé" },
  { icon: PencilRuler, value: TRADE_COUNT, unit: "métiers", label: "avec leurs prestations prêtes à importer" },
]

export function OfferFacts() {
  return (
    <section aria-label="L'offre de Qonforme en quatre chiffres" className="relative bg-q-bg px-6 py-[clamp(56px,7vw,88px)]">
      <div className={D_WRAP}>
        <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {OFFER_FACTS.map((fact, i) => (
            <li
              key={fact.label}
              data-reveal=""
              className={cn(
                "flex flex-col items-center rounded-[18px] border border-q-line bg-q-surface px-3 py-7 text-center sm:px-6 sm:py-9",
                DELAYS[i],
              )}
            >
              <fact.icon className="h-[26px] w-[26px] text-q-accent-strong" strokeWidth={1.6} aria-hidden />
              <p className="mt-4 whitespace-nowrap font-display font-semibold leading-none tracking-[-0.03em] text-q-ink-strong">
                {fact.value === 0 ? (
                  <span className="text-[40px] tabular-nums sm:text-[44px]">0</span>
                ) : (
                  <CountUp value={fact.value} className="text-[40px] sm:text-[44px]" />
                )}
                <span className="text-[17px] tracking-[-0.01em] text-q-text-2 sm:text-[18px]">
                  {NB}
                  {fact.unit}
                </span>
              </p>
              <p className="mt-3 text-[14px] leading-[1.45] text-q-text-3 [text-wrap:balance] sm:text-[15px]">{fact.label}</p>
            </li>
          ))}
        </ul>
        <p data-reveal="" className="mt-6 text-center text-[13px] leading-[1.5] text-q-text-4">
          {"Tarif hors taxes, sans engagement. Détail des formules sur "}
          <Link href="/pricing" className="q-link hover:underline">
            la page Tarifs
          </Link>
          .
        </p>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   « Gagnez du temps » : trois cartes, un grand nombre en
   bleu, son libellé, puis une phrase
───────────────────────────────────────────────────────── */
const TIME_FACTS = [
  {
    value: 0,
    suffix: `${NB}ressaisie`,
    label: "du devis accepté à la facture",
    text: "Client, lignes et TVA sont repris tels quels dans la facture en brouillon.",
  },
  {
    value: 3,
    suffix: `${NB}étapes`,
    label: "pour votre premier devis",
    text: "Votre SIREN, vos prestations, votre devis.",
  },
  {
    // Zéro : rien à compter, le nombre s'affiche tel quel
    value: 0,
    suffix: `${NB}relance`,
    label: "à écrire vous-même",
    text: `Avec ${essentiel.name}, les relances des factures impayées partent seules, au nom de votre entreprise.`,
  },
]

export function TimeBand() {
  return (
    <section className={cn(D_SECTION, "bg-q-bg")}>
      <Doodles layout="sides-short" icons={[CalendarClock, Send]} />
      <div className={D_WRAP}>
        <SectionTitle align="center" title="Gagnez du temps," accent="pas des clics." />
        <ul className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {TIME_FACTS.map((fact, i) => (
            <li
              key={fact.label}
              data-reveal=""
              className={cn("flex flex-col rounded-[20px] border border-q-line bg-q-surface p-7 sm:p-8", DELAYS[i])}
            >
              <p className="font-display text-[52px] font-semibold leading-none tracking-[-0.035em] text-q-accent-strong md:text-[clamp(40px,4.6vw,60px)]">
                {fact.value === 0 ? (
                  <span className="tabular-nums">0{fact.suffix}</span>
                ) : (
                  <CountUp value={fact.value} suffix={fact.suffix} />
                )}
              </p>
              <p className="mt-3 text-[16px] font-medium leading-[1.45] text-q-text-3">{fact.label}</p>
              <p className="mt-6 border-t border-q-line pt-5 text-[15px] leading-[1.6] text-q-text-2">{fact.text}</p>
            </li>
          ))}
        </ul>
        <CtaButtons reveal className="mt-12" primary={{ href: SIGNUP_HREF, label: "S'inscrire gratuitement" }} secondary={null} />
      </div>
    </section>
  )
}
