import { ClipboardList } from "lucide-react"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { JsonLd, Prose, ToolArea, ToolCta, ToolFaq, ToolGuide, ToolLinks, ToolShell, faqJsonLd, toolJsonLd } from "@/components/outils/kit"
import { DocumentGenerator } from "@/components/outils/doc-generator"

const FAQ = [
  { q: "Un devis est-il obligatoire ?", a: "Oui dans certains secteurs (BTP > 150 €, dépannage, déménagement). Dans les autres cas, il est fortement recommandé." },
  { q: "Quelle est la durée de validité d'un devis ?", a: "Il n'y a pas de durée légale. En pratique, 30 jours est le standard. Précisez-la toujours sur le devis." },
  { q: "Un devis signé engage-t-il le client ?", a: "Oui, un devis signé avec la mention « Bon pour accord » a valeur de contrat." },
]

export default function GenerateurDevisPage() {
  return (
    <ToolShell>
      <OutilsHero
        crumb="Générateur de devis"
        icon={<ClipboardList />}
        badge="PDF gratuit"
        title="Générateur de devis"
        accent="gratuit, en PDF."
        subtitle="Créez un devis professionnel en PDF. Remplissez, téléchargez. Gratuit, sans inscription."
      />

      <ToolArea width="lg">
        <DocumentGenerator type="devis" />

        <ToolCta
          title="Un devis accepté devient une facture en un clic"
          text="Dans Qonforme, les devis sont gratuits et illimités, s'envoient par email avec leur PDF, et un devis accepté se convertit en facture sans tout ressaisir."
        />
      </ToolArea>

      <ToolGuide title="Comment créer" accent="un devis conforme ?">
        <Prose>
          <p>
            Un devis doit contenir : l&apos;identité de l&apos;émetteur et du client, la date, un numéro unique, la description détaillée des prestations, les prix unitaires HT, le montant total HT et TTC, la durée de validité, et les conditions de paiement. En franchise de TVA, ajoutez « TVA non applicable, art. 293 B du CGI » ; si vous êtes artisan, votre assurance professionnelle, son assureur et sa couverture géographique.
          </p>
          <p>Un devis signé par le client a <strong>valeur contractuelle</strong> et engage les deux parties.</p>
        </Prose>

        <ToolFaq items={FAQ} />

        <ToolLinks
          links={[
            { href: "/outils/generateur-facture-gratuite", label: "Générateur de facture gratuit" },
            { href: "/outils/calculateur-tva", label: "Calculateur TVA HT/TTC" },
            { href: "/outils/verificateur-mentions-facture", label: "Vérificateur mentions facture" },
            { href: "/outils/verification-siret", label: "Vérificateur SIREN/SIRET" },
          ]}
        />
      </ToolGuide>

      <JsonLd data={toolJsonLd("Générateur de devis gratuit en ligne", "/outils/generateur-devis-gratuit")} />
      <JsonLd data={faqJsonLd(FAQ)} />
    </ToolShell>
  )
}
