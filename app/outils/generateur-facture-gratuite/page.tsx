import { FileText } from "lucide-react"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { JsonLd, Prose, ToolArea, ToolCta, ToolFaq, ToolGuide, ToolLinks, ToolShell, faqJsonLd, toolJsonLd } from "@/components/outils/kit"
import { DocumentGenerator } from "@/components/outils/doc-generator"

const FAQ = [
  { q: "Cette facture est-elle une facture électronique ?", a: "Non, c'est un PDF simple. Il convient tant que la facturation électronique ne vous est pas imposée : toute entreprise doit pouvoir en recevoir depuis le 1er septembre 2026, et les TPE et PME devront en émettre à partir du 1er septembre 2027, par une plateforme agréée." },
  { q: "Mes données sont-elles sauvegardées ?", a: "Non, aucune donnée n'est stockée. Le PDF est généré puis téléchargé." },
  { q: "Combien de factures puis-je générer ?", a: "Autant que vous voulez, gratuitement." },
]

export default function GenerateurFacturePage() {
  return (
    <ToolShell>
      <OutilsHero
        crumb="Générateur de facture"
        icon={<FileText />}
        badge="PDF gratuit"
        title="Générateur de facture"
        accent="gratuit, en PDF."
        subtitle="Remplissez le formulaire et téléchargez votre facture en PDF. Gratuit, sans inscription, aucune donnée stockée."
      />

      <ToolArea width="lg">
        <DocumentGenerator type="facture" />

        <ToolCta
          title="Ce PDF n'est pas une facture électronique"
          text="Avec Qonforme, vos factures PDF partent avec leurs données Factur-X, se créent en un clic depuis un devis accepté et sont numérotées à la suite. La transmission par plateforme agréée est en préparation."
          cta="Créer mon compte"
        />
      </ToolArea>

      <ToolGuide title="Créer une facture" accent="conforme en France.">
        <Prose>
          <p>Une facture doit contenir des <strong>mentions obligatoires</strong> :</p>
          <ul>
            <li><strong>Identité émetteur</strong> : nom, SIREN ou SIRET, adresse, n° de TVA si vous la facturez</li>
            <li><strong>Identité client</strong> : nom, adresse</li>
            <li><strong>Numéro</strong> : unique, à la suite des précédents</li>
            <li><strong>Dates</strong> : émission et échéance</li>
            <li><strong>Montants</strong> : HT, TVA ventilée par taux (base HT et TVA de chaque taux), TTC</li>
            <li><strong>Mention de TVA</strong> : « TVA non applicable, art. 293 B du CGI » en franchise, « Autoliquidation » en sous-traitance du bâtiment</li>
            <li><strong>Conditions de paiement</strong> : entre professionnels, pénalités de retard, indemnité de 40 € et escompte</li>
            <li><strong>Assurance professionnelle</strong> : pour les artisans, assureur et couverture géographique</li>
          </ul>
          <h3>2026-2027 : ce qui change</h3>
          <p>
            Depuis le 1er septembre 2026, toute entreprise doit pouvoir recevoir des factures électroniques. À partir du 1er septembre 2027, les TPE et PME doivent aussi émettre leurs factures entre entreprises en électronique (Factur-X, UBL ou CII), par une plateforme agréée. Ce générateur produit un PDF simple, pas une facture électronique.
          </p>
        </Prose>

        <ToolFaq items={FAQ} />

        <ToolLinks
          links={[
            { href: "/outils/calculateur-tva", label: "Calculateur TVA HT/TTC" },
            { href: "/outils/generateur-devis-gratuit", label: "Générateur de devis gratuit" },
            { href: "/outils/verificateur-mentions-facture", label: "Vérificateur mentions facture" },
            { href: "/outils/verification-siret", label: "Vérificateur SIREN/SIRET" },
          ]}
        />
      </ToolGuide>

      <JsonLd data={toolJsonLd("Générateur de facture gratuit en ligne", "/outils/generateur-facture-gratuite")} />
      <JsonLd data={faqJsonLd(FAQ)} />
    </ToolShell>
  )
}
