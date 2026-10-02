import type { Metadata } from "next"
import { FileText, Receipt, FileCheck, ClipboardList, Mail, Wand2 } from "lucide-react"
import { MODELES } from "@/lib/pseo/modeles"
import { ContentCta, ContentHero, ContentPage, LinkCard, SectionHeading, WRAP } from "@/components/content/ui"

export const metadata: Metadata = {
  title: "Modèles de factures et devis gratuits | Qonforme",
  description: "Modèles gratuits de factures, devis, avoirs et bons de commande, avec les mentions obligatoires de la réglementation française. Prêts à utiliser.",
  keywords: ["modele facture gratuit", "modele devis gratuit", "modele avoir", "modele bon de commande"],
  alternates: { canonical: "/modele" },
  openGraph: {
    title: "Modèles de factures et devis gratuits | Qonforme",
    description: "Modèles gratuits : factures, devis, avoirs, bons de commande, avec les mentions obligatoires.",
    url: "https://qonforme.fr/modele",
    images: [{ url: "/api/og?title=Mod%C3%A8les%20gratuits&subtitle=Factures%2C%20devis%2C%20avoirs%20et%20bons%20de%20commande", width: 1200, height: 630 }],
  },
}

const TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  facture: { label: "Facture", icon: <Receipt /> },
  devis: { label: "Devis", icon: <FileText /> },
  avoir: { label: "Avoir", icon: <FileCheck /> },
  "bon-de-commande": { label: "Bon de commande", icon: <ClipboardList /> },
  relance: { label: "Relance", icon: <Mail /> },
}

/** Générateurs gratuits existants (/outils) : remplir un modèle en ligne. */
const GENERATORS = [
  { href: "/outils/generateur-facture-gratuite", title: "Générateur de facture gratuit", text: "Remplissez les champs, téléchargez votre facture en PDF. Sans inscription." },
  { href: "/outils/generateur-devis-gratuit", title: "Générateur de devis gratuit", text: "Préparez un devis propre en quelques minutes et téléchargez-le en PDF." },
]

export default function ModeleIndexPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Modèles de factures et devis gratuits",
    description: "Modèles gratuits avec les mentions obligatoires de la réglementation française.",
    url: "https://qonforme.fr/modele",
    publisher: { "@type": "Organization", name: "Qonforme", url: "https://qonforme.fr" },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ContentPage>
        <ContentHero
          eyebrow="Ressources"
          title="Modèles de factures et de devis,"
          accent="gratuits."
          sub="Factures, devis, avoirs, bons de commande et relances : chaque modèle liste les mentions obligatoires et les pièges à éviter."
        />

        <section aria-label="Modèles" className="px-4 sm:px-6">
          <div className={`${WRAP} grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5`}>
            {MODELES.map((modele) => {
              const typeInfo = TYPE_LABELS[modele.type] ?? { label: modele.type, icon: <FileText /> }
              return (
                <LinkCard
                  key={modele.slug}
                  href={`/modele/${modele.slug}`}
                  icon={typeInfo.icon}
                  kicker={<span className="q-pill q-pill-info">{typeInfo.label}</span>}
                  title={modele.titre}
                  text={modele.description}
                  cta="Voir le modèle"
                />
              )
            })}
          </div>
        </section>

        {/* Générateurs gratuits */}
        <section className="px-4 pt-16 sm:px-6 sm:pt-20">
          <div className={WRAP}>
            <SectionHeading
              title="Remplir un modèle"
              accent="en ligne."
              sub="Nos générateurs gratuits produisent un PDF prêt à envoyer, sans créer de compte."
              className="mb-8"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {GENERATORS.map((g) => (
                <LinkCard key={g.href} href={g.href} icon={<Wand2 />} title={g.title} text={g.text} cta="Ouvrir l'outil" as="h3" />
              ))}
            </div>
          </div>
        </section>

        <ContentCta
          title="Plutôt qu'un modèle à remplir,"
          accent="vos devis en ligne."
          links={[
            { href: "/facturation", label: "Facturation par métier" },
            { href: "/guide", label: "Guides pratiques" },
            { href: "/glossaire", label: "Glossaire" },
            { href: "/pricing", label: "Tarifs" },
            { href: "/blog", label: "Blog" },
          ]}
        />
      </ContentPage>
    </>
  )
}
