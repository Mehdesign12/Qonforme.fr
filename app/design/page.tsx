import type { Metadata } from "next"
import { Layers, Send } from "lucide-react"

import { PublicHeader } from "@/components/layout/PublicHeader"
import { Doodles } from "@/components/brand/Doodles"
import Footer from "@/components/layout/Footer"
import { CtaButtons, SectionTitle } from "@/components/landing/ui"
import { StepsShowcase, type StepsData } from "@/components/landing/steps-showcase"
import { EXAMPLE_COMPANY, EXAMPLE_PRODUCTS, EXAMPLES } from "@/components/landing/examples"
import { DEMO_PRODUCTS } from "@/lib/demo/data"
import { formatCurrency } from "@/lib/utils/invoice"
import { DesignHero, EInvoicingBand, TradesStrip } from "@/components/design/DesignHero"
import { OfferFacts, SimpleBand, TimeBand } from "@/components/design/Bands"
import { CatalogueBlock, DevisBlock, FacturationBlock, PilotageBlock, RelancesBlock } from "@/components/design/Features"
import { ConvertBand, type ConvertBandData } from "@/components/design/ConvertBand"
import { TradesCarousel } from "@/components/design/TradesCarousel"
import { Assurances, Commitments, DesignFaq, FinalBand } from "@/components/design/Closing"
import { D_SECTION, D_WRAP, SIGNUP_HREF } from "@/components/design/kit"

/*
 * Variante B de l'accueil, pour un test A/B (demande du fondateur, 17/10/2026) :
 * la structure et le rythme de la page d'accueil d'un concurrent (note interne
 * ANALYSE-LANDING-CONCURRENT-2026-10.md), au langage de Qonforme.
 *
 * Chaque section du modèle a son équivalent vrai : la note Google devient le
 * label « Solution compatible », les logos de presse les métiers, les chiffres
 * d'utilisateurs les faits de l'offre, les avis nos engagements écrits, la vidéo
 * les trois étapes animées, la signature électronique (pas encore vendue) le
 * passage du devis à la facture. Aucun élément flottant, aucune affirmation
 * invérifiable (CLAUDE.md, DECISIONS-STRATEGIQUES.md § 2).
 *
 * Référencement : canonical vers l'accueil (recommandation de Google pour une
 * variante de test), absente du plan du site. Pas de JSON-LD : celui de la FAQ
 * vit sur l'accueil. Les inscriptions venues d'ici portent ?ab=design, enregistré
 * dans user_metadata.landing_variant du compte (lib/auth/signup-input.ts).
 */
/* Title et description : ceux de l'accueil (layout racine), puisque c'est la même page pour Google. */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
}

/** Devis accepté de la démo (Bâti Ouest SAS), joué par le bandeau « du devis à la facture ». */
const accepted = EXAMPLES.accepte
const CONVERT_DATA: ConvertBandData = {
  quoteNumber: accepted.quote_number,
  clientName: accepted.client.name,
  totalTtc: formatCurrency(accepted.total_ttc),
  lines: accepted.lines.slice(0, 3).map((l) => ({ label: l.description, amount: formatCurrency(l.total_ht) })),
}

const STEPS_DATA: StepsData = {
  company: EXAMPLE_COMPANY,
  products: EXAMPLE_PRODUCTS,
  newProduct: DEMO_PRODUCTS.find((p) => p.id === "ba13")!,
  quote: EXAMPLES.devis,
}

/* La vidéo du modèle : ici, les trois premiers gestes joués dans une fenêtre */
function StepsSection() {
  return (
    <section className={`${D_SECTION} bg-q-surface`}>
      <Doodles layout="sides-short" icons={[Send, Layers]} />
      <div className={D_WRAP}>
        <SectionTitle
          align="center"
          title="Votre premier devis,"
          accent="en trois étapes."
          sub="Votre SIREN, vos prestations, votre devis : voici ce que vous ferez à votre première connexion."
        />
        <StepsShowcase data={STEPS_DATA} />
        <CtaButtons reveal className="mt-12" primary={{ href: SIGNUP_HREF, label: "Créer mon premier devis" }} secondary={null} />
      </div>
    </section>
  )
}

export default function DesignPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-q-surface">
      <PublicHeader links={{ product: "#devis", pricing: "/pricing", signup: SIGNUP_HREF }} />
      <main>
        <DesignHero />
        <EInvoicingBand />
        <TradesStrip />
        <SimpleBand />
        <OfferFacts />
        <DevisBlock />
        <FacturationBlock />
        <TimeBand />
        <RelancesBlock />
        <PilotageBlock />
        <CatalogueBlock />
        <ConvertBand data={CONVERT_DATA} />
        <TradesCarousel />
        <Assurances />
        <Commitments />
        <StepsSection />
        <FinalBand />
        <DesignFaq />
      </main>
      <Footer showCta={false} />
    </div>
  )
}
