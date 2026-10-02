"use client"

import { useState } from "react"
import { Receipt } from "lucide-react"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import { Field, JsonLd, Prose, ToolArea, ToolCta, ToolFaq, ToolGuide, ToolLinks, ToolPanel, ToolShell, faqJsonLd, toolJsonLd } from "@/components/outils/kit"
import { ChoiceGroup, CopyButton, SwitchRow } from "@/components/outils/controls"

const DELAIS = [
  { id: "30", label: "30 jours date de facture", text: "à 30 jours date de facture" },
  { id: "30fin", label: "30 jours fin de mois", text: "à 30 jours fin de mois" },
  { id: "45fin", label: "45 jours fin de mois", text: "à 45 jours fin de mois" },
  { id: "60", label: "60 jours date de facture", text: "à 60 jours date de facture" },
  { id: "comptant", label: "Comptant (à réception)", text: "à réception de la facture" },
]

const TAUX_OPTIONS = [
  { id: "3xbce", label: "3 × BCE (12 %)", value: "trois (3) fois le taux d'intérêt légal appliqué par la Banque Centrale Européenne, soit 12,00 % l'an" },
  { id: "1xbce", label: "1 × BCE (4 %)", value: "le taux d'intérêt légal appliqué par la Banque Centrale Européenne, soit 4,00 % l'an" },
  { id: "15", label: "15 % (taux fixe)", value: "un taux fixe de 15,00 % l'an" },
  { id: "10", label: "10 % (taux fixe)", value: "un taux fixe de 10,00 % l'an" },
]

const FAQ = [
  { q: "Le délai de 60 jours est-il un maximum ?", a: "Oui, sauf accord dérogatoire interprofessionnel. Le délai par défaut (sans mention) est de 30 jours." },
  { q: "Puis-je choisir n'importe quel taux de pénalités ?", a: "Le taux ne peut pas être inférieur au taux directeur BCE × 1 (4 % en 2026). Par défaut, c'est BCE × 3 = 12 %." },
  { q: "La mention escompte est-elle obligatoire ?", a: "Oui. Si vous n'accordez pas d'escompte, la mention « Pas d'escompte accordé pour paiement anticipé » est requise." },
]

export default function GenerateurConditionsPaiementPage() {
  const [delai, setDelai] = useState("30")
  const [taux, setTaux] = useState("3xbce")
  const [escompte, setEscompte] = useState(false)
  const [tauxEscompte, setTauxEscompte] = useState("2")
  const [rib, setRib] = useState(false)

  const delaiObj = DELAIS.find((d) => d.id === delai)!
  const tauxObj = TAUX_OPTIONS.find((t) => t.id === taux)!

  const generatedText = `Conditions de paiement : ${delaiObj.text}.

En cas de retard de paiement, des pénalités de retard seront appliquées au taux de ${tauxObj.value}. Ces pénalités sont exigibles de plein droit, sans qu'un rappel soit nécessaire, conformément à l'article L441-10 du Code de commerce.

Une indemnité forfaitaire pour frais de recouvrement de 40 € sera due de plein droit en cas de retard de paiement (art. D441-5 du Code de commerce).

${escompte ? `Escompte pour paiement anticipé : ${tauxEscompte} % du montant HT.` : "Pas d'escompte accordé en cas de paiement anticipé."}
${rib ? "\nMode de paiement : virement bancaire. RIB joint à la facture." : ""}`

  return (
    <ToolShell ctaBar={<OutilsCtaBar text="Vos mentions enregistrées une fois, sur chaque facture." />}>
      <OutilsHero
        crumb="Conditions de paiement"
        icon={<Receipt />}
        badge="Mentions légales"
        title="Générateur de conditions"
        accent="de paiement."
        subtitle="Générez les mentions légales de conditions de paiement à ajouter sur vos factures et devis. Texte prêt à copier-coller."
      />

      <ToolArea width="md">
        <ToolPanel>
          <Field label="Délai de paiement">
            <ChoiceGroup label="Délai de paiement" columns={2} value={delai} onChange={setDelai} options={DELAIS.map((d) => ({ value: d.id, label: d.label }))} />
          </Field>

          <Field label="Taux de pénalités de retard" className="mt-6">
            <ChoiceGroup label="Taux de pénalités de retard" columns={2} value={taux} onChange={setTaux} options={TAUX_OPTIONS.map((t) => ({ value: t.id, label: t.label }))} />
          </Field>

          <div className="mt-6 flex flex-col gap-3">
            <SwitchRow checked={escompte} onChange={setEscompte} label="Escompte pour paiement anticipé">
              <div className="flex items-center gap-2">
                <label htmlFor="cp-escompte" className="sr-only">Taux d&apos;escompte</label>
                <input id="cp-escompte" type="number" min={0} step={0.5} value={tauxEscompte} onChange={(e) => setTauxEscompte(e.target.value)} className="q-input !w-24 text-center font-semibold tabular-nums" />
                <span className="text-[13px] text-q-text-3">% du montant HT</span>
              </div>
            </SwitchRow>
            <SwitchRow checked={rib} onChange={setRib} label="Mention virement + RIB joint" />
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-q-line bg-q-surface-2">
            <div className="flex items-center justify-between gap-3 border-b border-q-line px-4 py-2.5 sm:px-5">
              <p className="text-[13px] font-semibold text-q-text-3">Texte généré</p>
              <CopyButton text={generatedText} label="Copier" />
            </div>
            <p className="whitespace-pre-line px-4 py-4 text-[14px] leading-[1.65] text-q-ink sm:px-5" aria-live="polite">
              {generatedText}
            </p>
          </div>
        </ToolPanel>

        <ToolCta
          className="hidden sm:flex"
          title="Vos mentions enregistrées une fois"
          text="Dans Qonforme, vos mentions légales s'enregistrent une fois dans vos réglages et s'impriment en pied de chaque facture."
        />
      </ToolArea>

      <ToolGuide title="Conditions de paiement :" accent="ce que dit la loi.">
        <Prose>
          <p>L&apos;article L441-10 du Code de commerce impose d&apos;indiquer sur chaque facture :</p>
          <ul>
            <li><strong>Le délai de paiement</strong> : maximum 60 jours date de facture ou 45 jours fin de mois</li>
            <li><strong>Le taux de pénalités de retard</strong> : minimum taux directeur BCE × 1 (4 %), par défaut BCE × 3 (12 %)</li>
            <li><strong>L&apos;indemnité forfaitaire de recouvrement</strong> : 40 €, mentionnée obligatoirement</li>
            <li><strong>Les conditions d&apos;escompte</strong> : ou la mention « Pas d&apos;escompte accordé »</li>
          </ul>
        </Prose>

        <ToolFaq items={FAQ} />

        <ToolLinks
          links={[
            { href: "/outils/calculateur-penalites-retard", label: "Calculateur pénalités retard" },
            { href: "/outils/verificateur-mentions-facture", label: "Vérificateur mentions facture" },
            { href: "/outils/generateur-facture-gratuite", label: "Générateur de facture" },
            { href: "/outils/generateur-numero-facture", label: "Générateur n° facture" },
          ]}
        />
      </ToolGuide>

      <JsonLd data={toolJsonLd("Générateur conditions de paiement facture", "/outils/generateur-conditions-paiement")} />
      <JsonLd data={faqJsonLd(FAQ)} />
    </ToolShell>
  )
}
