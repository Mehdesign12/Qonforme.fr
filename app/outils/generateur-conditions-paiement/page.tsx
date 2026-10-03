"use client"

import { useState } from "react"
import { Receipt } from "lucide-react"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import { Field, JsonLd, Prose, ToolArea, ToolCta, ToolFaq, ToolGuide, ToolLinks, ToolPanel, ToolShell, faqJsonLd, toolJsonLd } from "@/components/outils/kit"
import { ChoiceGroup, CopyButton, ResetButton, SwitchRow } from "@/components/outils/controls"
import { parseNombre } from "@/lib/outils/montant"
import { aAuPlusDecimales } from "@/lib/outils/decimal"
import { SEMESTRE_REFERENCE, TAUX_PENALITES_DEFAUT, TAUX_PENALITES_PLANCHER } from "@/lib/outils/penalites"

const fmtPct = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`

const DELAIS = [
  { id: "30", label: "30 jours date de facture", text: "à 30 jours date de facture" },
  { id: "30fin", label: "30 jours fin de mois", text: "à 30 jours fin de mois" },
  { id: "45fin", label: "45 jours fin de mois", text: "à 45 jours fin de mois" },
  { id: "60", label: "60 jours date de facture", text: "à 60 jours date de facture" },
  { id: "comptant", label: "Comptant (à réception)", text: "à réception de la facture" },
]

/**
 * Taux de pénalités proposés (Code de commerce, art. L441-10 II) : un taux prévu
 * ne peut pas être inférieur à 3 × le taux d'intérêt légal ; sans taux prévu,
 * c'est le taux BCE + 10 points. Valeurs du semestre dans lib/outils/penalites.ts.
 */
const TAUX_OPTIONS = [
  {
    id: "bce10",
    label: `BCE + 10 points (${fmtPct(TAUX_PENALITES_DEFAUT)})`,
    value: "au taux d'intérêt appliqué par la Banque centrale européenne à son opération de refinancement la plus récente, majoré de 10 points de pourcentage",
  },
  {
    id: "3xlegal",
    label: `3 × taux légal (${fmtPct(TAUX_PENALITES_PLANCHER)})`,
    value: "à un taux égal à trois fois le taux d'intérêt légal",
  },
  { id: "15", label: "15 % (taux fixe)", value: "au taux fixe de 15,00 % l'an" },
  { id: "10", label: "10 % (taux fixe)", value: "au taux fixe de 10,00 % l'an" },
]

const FAQ = [
  { q: "Le délai de 60 jours est-il un maximum ?", a: "Oui : le délai convenu ne peut pas dépasser 60 jours après la date de la facture, ou 45 jours fin de mois s'il est prévu au contrat. Sans délai convenu, c'est 30 jours après la réception des marchandises ou l'exécution de la prestation (art. L441-10 I du Code de commerce)." },
  { q: "Puis-je choisir n'importe quel taux de pénalités ?", a: `Non : le taux prévu ne peut pas être inférieur à trois fois le taux d'intérêt légal, soit ${fmtPct(TAUX_PENALITES_PLANCHER)} au ${SEMESTRE_REFERENCE.libelle}. Sans taux prévu, c'est le taux de la BCE majoré de 10 points, soit ${fmtPct(TAUX_PENALITES_DEFAUT)} au ${SEMESTRE_REFERENCE.libelle} (art. L441-10 du Code de commerce).` },
  { q: "La mention escompte est-elle obligatoire ?", a: "Oui. Si vous n'accordez pas d'escompte, la mention « Pas d'escompte accordé pour paiement anticipé » est requise." },
]

export default function GenerateurConditionsPaiementPage() {
  const [delai, setDelai] = useState("30")
  const [taux, setTaux] = useState("bce10")
  const [escompte, setEscompte] = useState(false)
  const [tauxEscompte, setTauxEscompte] = useState("2")
  const [rib, setRib] = useState(false)

  const delaiObj = DELAIS.find((d) => d.id === delai)!
  const tauxObj = TAUX_OPTIONS.find((t) => t.id === taux)!

  // Taux d'escompte : nombre positif (virgule ou point), deux décimales au plus, affiché « 1,5 % »
  const tauxEscompteNum = parseNombre(tauxEscompte)
  const erreurEscompte = !escompte
    ? ""
    : tauxEscompte.trim() === ""
      ? "Saisissez le taux d'escompte, par exemple 1,5."
      : tauxEscompteNum === null
        ? "Taux invalide : saisissez par exemple 1,5."
        : tauxEscompteNum <= 0 || tauxEscompteNum >= 100
          ? "Le taux doit être compris entre 0 et 100 %."
          : !aAuPlusDecimales(tauxEscompteNum, 2)
            ? "Deux décimales au plus."
            : ""
  const tauxEscompteTexte = tauxEscompteNum !== null ? `${tauxEscompteNum.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}\u00a0%` : ""

  const reset = () => {
    setDelai("30")
    setTaux("bce10")
    setEscompte(false)
    setTauxEscompte("2")
    setRib(false)
  }

  const generatedText = `Conditions de paiement : ${delaiObj.text}.

En cas de retard de paiement, des pénalités de retard seront appliquées ${tauxObj.value}. Ces pénalités sont exigibles de plein droit, sans qu'un rappel soit nécessaire, conformément à l'article L441-10 du Code de commerce.

Une indemnité forfaitaire pour frais de recouvrement de 40 € sera due de plein droit en cas de retard de paiement (art. D441-5 du Code de commerce).

${escompte ? `Escompte pour paiement anticipé : ${tauxEscompteTexte} du montant HT.` : "Pas d'escompte accordé en cas de paiement anticipé."}
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
                <input
                  id="cp-escompte"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={tauxEscompte}
                  onChange={(e) => setTauxEscompte(e.target.value.replace(/[^0-9.,]/g, ""))}
                  aria-invalid={erreurEscompte ? true : undefined}
                  aria-describedby={erreurEscompte ? "cp-escompte-err" : undefined}
                  className="q-input !w-24 text-center font-semibold tabular-nums"
                />
                <span className="text-[13px] text-q-text-3">% du montant HT</span>
              </div>
              {erreurEscompte && <p id="cp-escompte-err" className="q-field-error mt-1.5">{erreurEscompte}</p>}
            </SwitchRow>
            <SwitchRow checked={rib} onChange={setRib} label="Mention virement + RIB joint" />
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-q-line bg-q-surface-2">
            <div className="flex items-center justify-between gap-3 border-b border-q-line px-4 py-2.5 sm:px-5">
              <p className="text-[13px] font-semibold text-q-text-3">Texte généré</p>
              <div className="flex items-center gap-1">
                <ResetButton onClick={reset} />
                {!erreurEscompte && <CopyButton text={generatedText} label="Copier" />}
              </div>
            </div>
            <p className="whitespace-pre-line px-4 py-4 text-[14px] leading-[1.65] text-q-ink sm:px-5" aria-live="polite">
              {erreurEscompte ? "Corrigez le taux d'escompte pour obtenir le texte." : generatedText}
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
          <p>Les articles L441-9 et L441-10 du Code de commerce imposent d&apos;indiquer sur chaque facture entre professionnels :</p>
          <ul>
            <li><strong>La date de paiement</strong> : au plus 60 jours après la date de la facture, ou 45 jours fin de mois</li>
            <li><strong>Le taux de pénalités de retard</strong> : jamais moins de trois fois le taux d&apos;intérêt légal ({fmtPct(TAUX_PENALITES_PLANCHER)} au {SEMESTRE_REFERENCE.libelle}) ; sans taux prévu, taux de la BCE majoré de 10 points ({fmtPct(TAUX_PENALITES_DEFAUT)})</li>
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
