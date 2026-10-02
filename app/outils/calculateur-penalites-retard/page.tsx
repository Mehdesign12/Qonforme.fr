"use client"

import { useState, useMemo } from "react"
import { Scale, AlertTriangle } from "lucide-react"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import { Field, Formula, JsonLd, Prose, ResultBox, ResultRow, ToolArea, ToolCta, ToolFaq, ToolGuide, ToolLinks, ToolPanel, ToolShell, faqJsonLd, toolJsonLd } from "@/components/outils/kit"
import { AmountInput, CopyButton, ResetButton } from "@/components/outils/controls"
import { calculerPenalites, joursEntre, TAUX_BCE, INDEMNITE_FORFAITAIRE } from "@/lib/outils/penalites"

function fmtEur(n: number) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n) }
const fmtPct = (n: number) => `${String(n).replace(".", ",")} %`

const FAQ = [
  { q: "L'indemnité de 40 € est-elle par facture ou globale ?", a: "Par facture. Si un client a 3 factures en retard, il doit 3 × 40 € = 120 € d'indemnité forfaitaire." },
  { q: "Dois-je envoyer une mise en demeure avant ?", a: "Non, les pénalités de retard sont exigibles de plein droit, sans mise en demeure préalable (art. L441-10)." },
  { q: "Quel taux appliquer si rien n'est précisé dans mes CGV ?", a: "Le taux légal par défaut est le taux directeur de la BCE × 3 (soit 12 % en 2026)." },
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
        badge="Taux BCE 2026"
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
              label="Taux annuel (optionnel)"
              htmlFor="pen-taux"
              hint={`Par défaut : taux BCE (${fmtPct(TAUX_BCE)}) × 3 = ${fmtPct(TAUX_BCE * 3)}. Minimum légal : taux BCE × 1.`}
            >
              <input
                id="pen-taux"
                type="text"
                inputMode="decimal"
                className="q-input tabular-nums"
                value={tauxCustom}
                onChange={(e) => setTauxCustom(e.target.value.replace(/[^0-9.,]/g, ""))}
                placeholder={`${TAUX_BCE * 3}% (BCE × 3 par défaut)`}
              />
            </Field>
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
              <ResultRow label="Taux annuel" value={fmtPct(result.tauxAnnuel)} />
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
          <p>L&apos;article L441-10 du Code de commerce impose deux types de pénalités en cas de retard de paiement :</p>
          <ul>
            <li><strong>Intérêts de retard</strong> : calculés sur le montant TTC, au taux annuel convenu (minimum : taux BCE × 1, par défaut : taux BCE × 3)</li>
            <li><strong>Indemnité forfaitaire de recouvrement</strong> : 40 € par facture, due de plein droit sans mise en demeure</li>
          </ul>
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
