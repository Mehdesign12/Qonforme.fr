import Link from "next/link"
import { ArrowRight, BadgeCheck, Check, ChevronDown, FolderOpen, HardHat, Lamp, PaintRoller, Ruler, ShieldCheck, Stamp, Wrench } from "lucide-react"
import { Doodles } from "@/components/brand/Doodles"
import { D_SECTION, D_WRAP, SIGNUP_HREF } from "@/components/home/kit"
import { SOLUTION_COMPATIBLE, SolutionCompatible } from "@/components/brand/SolutionCompatible"
import { CtaButtons, SectionTitle } from "@/components/landing/ui"
import { GUARANTEE_DAYS } from "@/lib/stripe/access"
import { PLANS, TAX_SUFFIX } from "@/lib/stripe/plans"
import { PLATFORM_SENDING_LIVE } from "@/lib/pa/sending"
import { cn } from "@/lib/utils"

/**
 * Fin de l'accueil : garanties, engagements, appel final et questions
 * fréquentes. Ce que Qonforme garantit vraiment, tel qu'écrit dans ses
 * conditions générales (article 4) : aucun avis, aucune note, aucun chiffre
 * d'utilisateurs.
 *
 * Prix et durée de la garantie lus dans lib/stripe (jamais recopiés). Le label
 * « Solution compatible » et ce qui le décrit disparaissent avec le logotype si
 * SOLUTION_COMPATIBLE passe à false. Couleurs par jetons --q-* (thème sombre
 * compris), sauf l'appel final marine, identique dans les deux thèmes.
 * Apparitions au défilement par data-reveal ; la FAQ s'ouvre sans JavaScript
 * (<details> natif) ; `FAQ_ITEMS` alimente aussi le JSON-LD FAQPage de app/page.tsx.
 */

const NB = "\u00a0"
const DELAYS = ["", "lp-d1", "lp-d2"] as const
const essentiel = PLANS.starter

/** Prix en euros, insécable : « 24 € » (« 24 € HT » quand la TVA est ajoutée par-dessus). */
const ht = (n: number) => `${n}${NB}€${TAX_SUFFIX ? `${NB}HT` : ""}`

/** Typographie française : espace insécable avant « ? : ; ! » et dans les guillemets. */
const fr = (s: string) =>
  s
    .replace(/ ([?:;!»])/g, `${NB}$1`)
    .replace(/« /g, `«${NB}`)

/* ─────────────────────────────────────────────────────────
   J — Garanties : trois colonnes (à la place des badges)
───────────────────────────────────────────────────────── */
const ASSURANCES = [
  ...(SOLUTION_COMPATIBLE
    ? [{ visual: <SolutionCompatible size="sm" />, title: "Solution compatible", text: "Raccordé à une plateforme agréée" }]
    : []),
  {
    visual: <ShieldCheck className="h-[30px] w-[30px] text-q-accent-strong" strokeWidth={1.6} aria-hidden />,
    title: "Factures conformes",
    text: "Mentions obligatoires, numérotation continue, Factur-X",
  },
  {
    visual: <FolderOpen className="h-[30px] w-[30px] text-q-accent-strong" strokeWidth={1.6} aria-hidden />,
    title: "Vos documents restent à vous",
    text: "Consultables et exportables, même sans formule",
  },
]

export function Assurances() {
  return (
    <section aria-labelledby="dz-assurances" className="border-t border-q-line bg-q-surface px-6 py-[clamp(56px,6vw,80px)]">
      <h2 id="dz-assurances" className="sr-only">
        Nos garanties
      </h2>
      <ul
        className={cn(
          D_WRAP,
          "grid grid-cols-1 gap-10 md:gap-0 md:divide-x md:divide-q-line",
          ASSURANCES.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2",
        )}
      >
        {ASSURANCES.map((a, i) => (
          <li key={a.title} data-reveal="" className={cn("flex flex-col items-center px-6 text-center", DELAYS[i])}>
            <div className="flex items-center justify-center md:h-[92px]">{a.visual}</div>
            <h3 className="mt-4 font-display text-[19px] font-semibold leading-[1.25] tracking-[-0.02em] text-q-ink-strong">{a.title}</h3>
            <p className="mt-1.5 max-w-[300px] text-[15px] leading-[1.55] text-q-text-3 [text-wrap:balance]">{a.text}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   K — Engagements en mosaïque (à la place des avis clients :
   aucun avis inventé)
───────────────────────────────────────────────────────── */
const COMMITMENTS = [
  {
    title: "Devis gratuits et illimités",
    text: "Devis, clients, catalogue et factures en brouillon sont gratuits, sans limite de durée.",
  },
  {
    title: "Sans carte bancaire pour commencer",
    text: "Une formule n'est demandée qu'au moment d'envoyer votre première facture.",
  },
  {
    title: `Satisfait ou remboursé pendant ${GUARANTEE_DAYS}${NB}jours`,
    text: "Le remboursement se demande depuis vos paramètres, sans justification, une fois par compte.",
  },
  {
    title: "Sans engagement",
    text: "La résiliation se fait depuis vos paramètres, sans frais, à tout moment.",
  },
  {
    title: "Vos documents restent à vous",
    text: "Consultation, téléchargement et export, avec ou sans formule, même après une résiliation.",
  },
  {
    title: "Un prix clair",
    text: `${essentiel.name}${NB}: ${ht(essentiel.monthlyPrice)} par mois ou ${ht(essentiel.yearlyPrice)} par an. Rien d'autre à payer pour facturer.`,
  },
]

export function Commitments() {
  return (
    <section className={cn(D_SECTION, "bg-q-bg")}>
      <Doodles layout="sides-short" icons={[BadgeCheck, Stamp]} />
      <div className={D_WRAP}>
        <SectionTitle
          align="center"
          title="Zéro risque"
          accent="pour commencer."
        />
        <div className="mt-12 columns-1 gap-5 md:columns-2 lg:columns-3">
          {COMMITMENTS.map((c, i) => (
            <article
              key={c.title}
              data-reveal=""
              className={cn("mb-5 break-inside-avoid rounded-[20px] border border-q-line bg-q-surface p-6 sm:p-7", DELAYS[i % 3])}
            >
              <h3 className="flex gap-2.5 font-display text-[19px] font-semibold leading-[1.3] tracking-[-0.02em] text-q-ink-strong">
                <Check className="mt-[4px] h-[18px] w-[18px] shrink-0 text-q-accent" strokeWidth={2.25} aria-hidden />
                <span>{c.title}</span>
              </h3>
              <p className="mt-2.5 pl-7 text-[15px] leading-[1.6] text-q-text-3">{c.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   M — Appel final sur fond marine
───────────────────────────────────────────────────────── */
export function FinalBand() {
  return (
    <section className="q-on-ink lp-clip relative bg-[#0A1122] px-6 py-[clamp(72px,9vw,96px)]">
      {/* Pictogrammes de marque en blanc sur le fond marine, de chaque côté du texte (grand écran seulement) */}
      <Doodles layout="frame" tone="light" icons={[HardHat, Ruler, PaintRoller, Wrench]} />
      <div data-reveal="scale" className={cn(D_WRAP, "relative flex flex-col items-center text-center")}>
        <h2 className="max-w-[820px] font-display text-[clamp(32px,4vw,52px)] font-semibold leading-[1.08] tracking-[-0.03em] text-white [text-wrap:balance]">
          Votre prochain chantier <span className="q-serif inline-block !text-[#9DBBFF]">commence ici.</span>
        </h2>
        <p className="mt-5 max-w-[560px] text-[17px] leading-[1.6] text-[#AFBDD3] [text-wrap:pretty] sm:text-[18px]">
          {`Zéro euro pour chiffrer. Tout ce qu'il faut pour encaisser. Sans carte bancaire.`}
        </p>
        <CtaButtons className="mt-9" primary={{ href: SIGNUP_HREF, label: "Faire mon premier devis gratuit" }} />
        <SolutionCompatible size="sm" className="mt-10" />
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   N — Questions fréquentes (sans JSON-LD : déjà sur l'accueil)
───────────────────────────────────────────────────────── */
export const FAQ_ITEMS: { q: string; a: string; logo?: boolean }[] = [
  {
    q: "Puis-je essayer Qonforme gratuitement ?",
    a: `Oui. Devis, clients, catalogue, planning, notes et factures en brouillon sont gratuits, sans limite de durée et sans carte bancaire. Vous choisissez une formule au moment d'envoyer votre première facture : ${essentiel.name}, ${ht(essentiel.monthlyPrice)} par mois ou ${ht(essentiel.yearlyPrice)} par an.`,
  },
  {
    q: "Puis-je gérer mes chantiers avec Qonforme ?",
    a: `Oui. Le planning de rendez-vous, les notes, les tâches et le scan de documents sont inclus dans tous les comptes. Avec ${PLANS.pro.name}, chaque chantier a sa fiche : devis, factures, acomptes, situations, retenue de garantie et rendez-vous au même endroit, avec ce qui est signé, facturé, encaissé et reste à facturer.`,
  },
  {
    q: "Puis-je l'utiliser sur mon téléphone ?",
    a: "Oui. Qonforme fonctionne dans le navigateur, sur ordinateur, tablette et téléphone. Sur téléphone, vous pouvez l'ajouter à l'écran d'accueil pour l'ouvrir comme une application, sans passer par un store.",
  },
  // Retirée avec le logotype si l'État retire le label (SOLUTION_COMPATIBLE)
  ...(SOLUTION_COMPATIBLE
    ? [
        {
          q: "Qonforme est-il prêt pour la facturation électronique ?",
          a: PLATFORM_SENDING_LIVE
            ? `Oui. Qonforme est solution compatible facturation électronique, raccordé à la plateforme agréée Super PDP. Avec ${essentiel.name}, vos factures fournisseurs arrivent par la plateforme et vos factures partent vers vos clients professionnels au format de la réforme. Le 1er septembre 2027, vous n'aurez rien à changer.`
            : `Oui. Qonforme est solution compatible facturation électronique, raccordé à la plateforme agréée Super PDP. Avec ${essentiel.name}, vos factures fournisseurs arrivent par la plateforme, et vos factures sont émises au format Factur-X de la réforme.`,
          logo: true,
        },
      ]
    : []),
  {
    q: "Je suis en franchise de TVA. Est-ce prévu ?",
    a: `Oui. La mention « TVA non applicable, art. 293${NB}B du CGI » s'ajoute à vos documents depuis Paramètres, à partir d'un modèle prêt à l'emploi.`,
  },
  {
    q: "Puis-je faire des devis et factures pour un particulier ?",
    a: "Oui. Un client particulier se crée sans SIREN, et ses devis et factures se font comme les autres, avec les mentions qui le concernent.",
  },
  {
    q: "Puis-je résilier à tout moment ?",
    a: `Oui, sans engagement ni frais, depuis vos paramètres. Vos devis et factures restent consultables, téléchargeables et exportables, même après. Et si Qonforme ne vous convient pas, vous êtes remboursé dans les ${GUARANTEE_DAYS}${NB}jours.`,
  },
]

export function HomeFaq() {
  return (
    <section className={cn(D_SECTION, "bg-q-surface")}>
      <Doodles layout="sides-short" icons={[Lamp, Wrench]} />
      <div className="mx-auto w-full max-w-[800px]">
        <SectionTitle align="center" title="Questions" accent="fréquentes" className="mb-10" />
        <div data-reveal="" className="border-b border-q-line">
          {FAQ_ITEMS.map((item, i) => (
            // <details> natif : s'ouvre au clavier et sans JavaScript ; la première réponse est ouverte.
            <details key={item.q} open={i === 0} className="group border-t border-q-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left [&::-webkit-details-marker]:hidden">
                <span className="text-[16px] font-semibold text-q-ink-strong">{fr(item.q)}</span>
                <ChevronDown
                  className="h-[18px] w-[18px] shrink-0 text-q-text-4 transition-transform duration-300 group-open:rotate-180 motion-reduce:transition-none"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </summary>
              <p className={cn("max-w-[680px] text-[15px] leading-[1.65] text-q-text-3", item.logo ? "pb-4" : "pb-6")}>{fr(item.a)}</p>
              {item.logo && <SolutionCompatible size="sm" className="mb-6" />}
            </details>
          ))}
        </div>
        <div
          data-reveal=""
          className="mt-10 flex flex-col items-start gap-5 rounded-[22px] border border-q-line bg-q-bg p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7"
        >
          <p className="text-[15px] leading-[1.6] text-q-text-3">
            <span className="block text-[16px] font-semibold text-q-ink-strong">{fr("Une autre question ?")}</span>
            {fr("Le plus simple est d'essayer : vos devis sont gratuits, sans carte bancaire.")}
          </p>
          <Link href={SIGNUP_HREF} className="lp-btn-p shrink-0">
            Essayer gratuitement
            <ArrowRight className="lp-btn-arrow h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
