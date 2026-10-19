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
import { HomeHero, EInvoicingBand, TradesStrip } from "@/components/home/HomeHero"
import { OfferFacts, SimpleBand, TimeBand } from "@/components/home/Bands"
import { CatalogueBlock, DevisBlock, FacturationBlock, PilotageBlock, RelancesBlock } from "@/components/home/Features"
import { ConvertBand, type ConvertBandData } from "@/components/home/ConvertBand"
import { TradesCarousel } from "@/components/home/TradesCarousel"
import { Assurances, Commitments, FAQ_ITEMS, FinalBand, HomeFaq } from "@/components/home/Closing"
import { Resources } from "@/components/home/Resources"
import { D_SECTION, D_WRAP, SIGNUP_HREF } from "@/components/home/kit"

/*
 * Accueil (17/10/2026) : la structure et le rythme d'une page de référence
 * (note interne ANALYSE-LANDING-CONCURRENT-2026-10.md), au langage de Qonforme,
 * choisie par le fondateur à la place de l'ancien accueil (récupérable dans
 * l'historique git : dernier commit avant le remplacement, a78a9cd).
 *
 * Chaque élément du modèle a son équivalent vrai : la note d'avis devient le
 * label « Solution compatible », les logos de presse les métiers, les chiffres
 * d'utilisateurs les faits de l'offre, les avis nos engagements écrits, la vidéo
 * les trois étapes animées, la signature électronique (pas encore vendue) le
 * passage du devis à la facture. Aucun élément flottant, aucune affirmation
 * invérifiable (CLAUDE.md, DECISIONS-STRATEGIQUES.md § 2).
 *
 * Composants dans components/home/. FAQ : son JSON-LD vient des mêmes
 * questions que celles affichées (FAQ_ITEMS) : jamais l'un sans l'autre.
 */
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

/** JSON-LD FAQPage : les questions et réponses affichées, espaces insécables ramenés à des espaces. */
const plain = (text: string) => text.replace(/\u00a0/g, " ")
const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: plain(item.q),
    acceptedAnswer: { "@type": "Answer", text: plain(item.a) },
  })),
}

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-q-surface">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }} />
      <PublicHeader isLandingPage />
      <main>
        <HomeHero />
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
        <Resources />
        <FinalBand />
        <HomeFaq />
      </main>
      <Footer showCta={false} />
    </div>
  )
}
