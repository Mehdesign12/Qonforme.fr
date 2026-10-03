"use client"

import { useState, useMemo } from "react"
import { Scale, AlertTriangle } from "lucide-react"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import { Field, Formula, JsonLd, Prose, ResultBox, ResultRow, ToolArea, ToolCta, ToolFaq, ToolGuide, ToolLinks, ToolPanel, ToolShell, faqJsonLd, toolJsonLd } from "@/components/outils/kit"
import { AmountInput, CopyButton, ResetButton } from "@/components/outils/controls"
import {
  calculerPenalites, joursEntre, INDEMNITE_FORFAITAIRE, SEMESTRE_REFERENCE, TAUX_PENALITES_DEFAUT, TAUX_PENALITES_PLANCHER,
} from "@/lib/outils/penalites"

function fmtEur(n: number) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n) }
const fmtPct = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`

const FAQ = [
  { q: "L'indemnité de 40 € est-elle par facture ou globale ?", a: "Par facture, et seulement d'un client professionnel (art. D441-5 du Code de commerce). Si un client a 3 factures en retard, il doit 3 × 40 € = 120 € d'indemnité forfaitaire." },
  { q: "Dois-je envoyer une mise en demeure avant ?", a: "Non, les pénalités de retard sont exigibles sans qu'un rappel soit nécessaire (art. L441-10 du Code de commerce)." },
  { q: "Quel taux appliquer si rien n'est précisé dans mes CGV ?", a: `Le taux de la Banque centrale européenne à son opération de refinancement la plus récente, majoré de 10 points (art. L441-10 du Code de commerce). Au ${SEMESTRE_REFERENCE.libelle} : ${fmtPct(SEMESTRE_REFERENCE.tauxBce)} + 10 points = ${fmtPct(TAUX_PENALITES_DEFAUT)}.` },
  { q: "Puis-je prévoir un taux plus bas dans mes conditions ?", a: `Oui, mais jamais moins de trois fois le taux d'intérêt légal (art. L441-10 du Code de commerce). Au ${SEMESTRE_REFERENCE.libelle}, le taux d'intérêt légal entre professionnels est de ${fmtPct(SEMESTRE_REFERENCE.tauxInteretLegalPro)} : le minimum est donc de ${fmtPct(TAUX_PENALITES_PLANCHER)}.` },
]

export default function CalculateurPenalitesPage() {
  const [montant, setMontant] = useState("")
  const [dateEcheance, setDateEcheance] = useState("")
  const [datePaiement, setDatePaiement] = useState(new Date().toISOString().slice(0, 10))
  const [tauxCustom, setTauxCustom] = useState("")

  const numMontant = parseFloat(montant.replace(",", ".").replace(/\s/g, "")) || 0
  const jours = dateEcheance && datePaiement ? joursEntre(dateEcheance, datePaiement) : 0
  const tauxAnnuel = tauxCustom ? parseFloat(tauxCustom.replace(",", ".")) : undefined

  const result = useMemo(() => {
    if (numMontant <= 0 || jours <= 0) return null
    return calculerPenalites(numMontant, jours, tauxAnnuel)
  }, [numMontant, jours, tauxAnnuel])

  const copyText = result ? `Intérêts de retard : ${fmtEur(result.interetsRetard)} | Indemnité forfaitaire : ${fmtEur(INDEMNITE_FORFAITAIRE)} | Total : ${fmtEur(result.totalDu)}` : ""

  return (
    <ToolShell ctaBar={<OutilsCtaBar text="Relances par email à J+30 et J+45 après l'échéance." />}>
      <OutilsHero
        crumb="Pénalités de retard"
        icon={<Scale />}
        badge={`Taux du ${SEMESTRE_REFERENCE.libelle}`}
        title="Calculateur de pénalités"
        accent="de retard."
        subtitle="Calculez les intérêts de retard et l'indemnité forfaitaire de recouvrement (40 €) pour vos factures impayées."
      />

      <ToolArea>
        <ToolPanel>
          <div className="flex flex-col gap-5">
            <Field label="Montant TTC de la facture" htmlFor="pen-montant">
              <AmountInput id="pen-montant" value={montant} onChange={(v) => setMontant(v.replace(/[^0-9.,\s]/g, ""))} placeholder="5 000" autoFocus />
            </Field>

            <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
              <Field label="Date d'échéance" htmlFor="pen-echeance">
                <input id="pen-echeance" type="date" className="q-input" value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} />
              </Field>
              <Field label="Date de paiement" htmlFor="pen-paiement">
                <input id="pen-paiement" type="date" className="q-input" value={datePaiement} onChange={(e) => setDatePaiement(e.target.value)} />
              </Field>
            </div>

            {jours > 0 && (
              <p className="flex justify-center">
                <span className="q-pill q-pill-warn">
                  <AlertTriangle aria-hidden />
                  {jours} jour{jours > 1 ? "s" : ""} de retard
                </span>
              </p>
            )}

            <Field
              label="Taux prévu dans vos conditions (optionnel)"
              htmlFor="pen-taux"
              hint={`Sans taux prévu : taux BCE (${fmtPct(SEMESTRE_REFERENCE.tauxBce)}) + 10 points = ${fmtPct(TAUX_PENALITES_DEFAUT)}. Un taux prévu ne peut pas être inférieur à ${fmtPct(TAUX_PENALITES_PLANCHER)} (3 × le taux d'intérêt légal). Taux du ${SEMESTRE_REFERENCE.libelle}.`}
            >
              <input
                id="pen-taux"
                type="text"
                inputMode="decimal"
                className="q-input tabular-nums"
                value={tauxCustom}
                onChange={(e) => setTauxCustom(e.target.value.replace(/[^0-9.,]/g, ""))}
                placeholder={`${fmtPct(TAUX_PENALITES_DEFAUT)} par défaut`}
                aria-describedby={result?.sousLePlancher ? "pen-taux-alerte" : undefined}
              />
            </Field>
            {result?.sousLePlancher && (
              <p id="pen-taux-alerte" role="status" className="-mt-3 text-[13px] text-[var(--q-warn)]">
                Ce taux est inférieur au minimum légal de {fmtPct(TAUX_PENALITES_PLANCHER)} (3 × le taux d&apos;intérêt légal) : une clause qui le prévoit n&apos;est pas conforme à l&apos;article L441-10 du Code de commerce.
              </p>
            )}
          </div>

          {result && (
            <ResultBox
              className="mt-6"
              label="Total dû par le client"
              value={fmtEur(result.totalDu)}
              tone="warn"
              footer={
                <>
                  <ResetButton onClick={() => { setMontant(""); setDateEcheance(""); setTauxCustom("") }} />
                  <CopyButton text={copyText} label="Copier" />
                </>
              }
            >
              <ResultRow label="Montant facture" value={fmtEur(result.montantFacture)} />
              <ResultRow label="Jours de retard" value={`${result.joursRetard} jours`} />
              <ResultRow label={result.tauxParDefaut ? "Taux annuel (BCE + 10 points)" : "Taux annuel"} value={fmtPct(result.tauxAnnuel)} />
              <ResultRow label="Intérêts de retard" value={fmtEur(result.interetsRetard)} tone="warn" divider />
              <ResultRow label="Indemnité forfaitaire" value={fmtEur(INDEMNITE_FORFAITAIRE)} tone="warn" />
              <ResultRow label="Total dû par le client" value={fmtEur(result.totalDu)} strong divider />
            </ResultBox>
          )}
          {!result && numMontant > 0 && (
            <div className="mt-4 flex justify-center">
              <ResetButton onClick={() => { setMontant(""); setDateEcheance(""); setTauxCustom("") }} />
            </div>
          )}
        </ToolPanel>

        <ToolCta
          className="hidden sm:flex"
          title="Relancez sans y penser"
          text="Avec la formule Essentiel, Qonforme relance par email vos clients 30 puis 45 jours après l'échéance d'une facture impayée. Vous pouvez aussi relancer à tout moment depuis la facture."
        />
      </ToolArea>

      <ToolGuide title="Pénalités de retard :" accent="ce que dit la loi.">
        <Prose>
          <p>Entre professionnels, un retard de paiement entraîne deux sommes, exigibles sans qu&apos;un rappel soit nécessaire :</p>
          <ul>
            <li><strong>Intérêts de retard</strong> (art. L441-10 du Code de commerce) : calculés sur le montant TTC, au taux prévu dans vos conditions, qui ne peut pas être inférieur à trois fois le taux d&apos;intérêt légal ({fmtPct(TAUX_PENALITES_PLANCHER)} au {SEMESTRE_REFERENCE.libelle}). Sans taux prévu : taux de la BCE majoré de 10 points ({fmtPct(TAUX_PENALITES_DEFAUT)} au {SEMESTRE_REFERENCE.libelle}).</li>
            <li><strong>Indemnité forfaitaire pour frais de recouvrement</strong> (art. D441-5) : 40 € par facture.</li>
          </ul>
          <p>Le taux de la BCE retenu est celui en vigueur au 1er janvier pour le premier semestre et au 1er juillet pour le second. Le taux d&apos;intérêt légal est fixé chaque semestre par arrêté.</p>
          <h3>Formule de calcul</h3>
          <Formula>
            <p>Intérêts = Montant TTC × (Taux annuel / 100) × (Jours retard / 365)</p>
            <p>Total = Intérêts + 40 € (indemnité forfaitaire)</p>
          </Formula>
        </Prose>

        <ToolFaq items={FAQ} />

        <ToolLinks
          links={[
            { href: "/outils/generateur-facture-gratuite", label: "Générateur de facture gratuit" },
            { href: "/outils/generateur-conditions-paiement", label: "Générateur conditions paiement" },
            { href: "/outils/verificateur-mentions-facture", label: "Vérificateur mentions facture" },
            { href: "/outils/calculateur-tva", label: "Calculateur TVA" },
          ]}
        />
      </ToolGuide>

      <JsonLd data={toolJsonLd("Calculateur pénalités de retard facture", "/outils/calculateur-penalites-retard")} />
      <JsonLd data={faqJsonLd(FAQ)} />
    </ToolShell>
  )
}
