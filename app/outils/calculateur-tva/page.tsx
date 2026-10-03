"use client"

import { useCallback, useRef, useState } from "react"
import { ArrowLeftRight, Calculator } from "lucide-react"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import {
  Field,
  Formula,
  JsonLd,
  Prose,
  ResultBox,
  ResultRow,
  ToolArea,
  ToolCta,
  ToolFaq,
  ToolGuide,
  ToolLinks,
  ToolPanel,
  ToolShell,
  faqJsonLd,
  toolJsonLd,
} from "@/components/outils/kit"
import { AmountInput, ChoiceGroup, CopyButton, ResetButton, Seg } from "@/components/outils/controls"
import { TVA_RATES, htToTtc, ttcToHt, calculateVat } from "@/lib/outils/tva"

function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n)
}

function fmtRate(r: number): string {
  return `${String(r).replace(".", ",")}\u00a0%`
}

const FAQ = [
  { q: "Comment passer du HT au TTC ?", a: "Multipliez le montant HT par (1 + taux de TVA). Pour 20 %, multipliez par 1,20. Exemple : 500 € HT × 1,20 = 600 € TTC." },
  { q: "Comment retrouver le HT à partir du TTC ?", a: "Divisez le montant TTC par (1 + taux de TVA). Pour 20 %, divisez par 1,20. Exemple : 600 € TTC / 1,20 = 500 € HT." },
  { q: "Quel taux de TVA appliquer sur mes factures ?", a: "Le taux dépend de la nature de votre activité. Le taux normal est 20 %. Consultez impots.gouv.fr pour votre cas." },
  { q: "Un auto-entrepreneur doit-il facturer la TVA ?", a: "Non, tant que son CA reste sous les seuils de franchise. La mention « TVA non applicable, art. 293 B du CGI » doit figurer sur chaque facture." },
]

export default function CalculateurTvaPage() {
  const [mode, setMode] = useState<"ht-to-ttc" | "ttc-to-ht">("ht-to-ttc")
  const [amount, setAmount] = useState("")
  const [rateIndex, setRateIndex] = useState(0)
  const resultRef = useRef<HTMLDivElement>(null)

  const rate = TVA_RATES[rateIndex].value
  const numAmount = parseFloat(amount.replace(",", ".")) || 0

  const result = useCallback(() => {
    if (numAmount <= 0) return null
    if (mode === "ht-to-ttc") {
      return { ht: numAmount, tva: calculateVat(numAmount, rate), ttc: htToTtc(numAmount, rate) }
    }
    const ht = ttcToHt(numAmount, rate)
    return { ht, tva: calculateVat(ht, rate), ttc: numAmount }
  }, [numAmount, rate, mode])()

  const handleSwapMode = () => {
    setMode((m) => (m === "ht-to-ttc" ? "ttc-to-ht" : "ht-to-ttc"))
    setAmount("")
  }

  const handleAmountChange = (v: string) => {
    setAmount(v.replace(/[^0-9.,]/g, ""))
    // Fait défiler jusqu'au résultat sur mobile
    setTimeout(() => {
      if (resultRef.current && parseFloat(v.replace(",", ".")) > 0) {
        resultRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" })
      }
    }, 100)
  }

  const copyText = result ? `HT: ${fmtEur(result.ht)} | TVA (${rate}%): ${fmtEur(result.tva)} | TTC: ${fmtEur(result.ttc)}` : ""

  return (
    <ToolShell ctaBar={<OutilsCtaBar text="La TVA calculée sur chaque ligne de vos devis et factures." />}>
      <OutilsHero
        crumb="Calculateur TVA"
        icon={<Calculator />}
        badge="Les 4 taux français"
        title="Calculateur de TVA"
        accent="HT ↔ TTC."
        subtitle="Convertissez instantanément vos montants HT en TTC et inversement. Tous les taux de TVA français : 20 %, 10 %, 5,5 %, 2,1 %."
      />

      <ToolArea>
        <ToolPanel>
          <div className="flex items-center justify-between gap-3">
            <Seg
              label="Sens du calcul"
              value={mode}
              onChange={(m) => { setMode(m); setAmount("") }}
              options={[
                { value: "ht-to-ttc", label: "HT → TTC" },
                { value: "ttc-to-ht", label: "TTC → HT" },
              ]}
            />
            <button type="button" onClick={handleSwapMode} className="q-btn q-btn-ghost q-btn-icon" aria-label="Inverser le sens du calcul" title="Inverser">
              <ArrowLeftRight aria-hidden />
            </button>
          </div>

          <Field label={`Montant ${mode === "ht-to-ttc" ? "HT" : "TTC"}`} htmlFor="tva-montant" className="mt-6">
            <AmountInput id="tva-montant" value={amount} onChange={handleAmountChange} placeholder={mode === "ht-to-ttc" ? "1 000" : "1 200"} autoFocus />
          </Field>

          <Field label="Taux de TVA" className="mt-5">
            <ChoiceGroup
              label="Taux de TVA"
              columns={2}
              dot={false}
              value={rateIndex}
              onChange={setRateIndex}
              options={TVA_RATES.map((r, i) => ({
                value: i,
                label: r.desc,
                lead: (
                  <span
                    className={
                      rateIndex === i
                        ? "grid h-9 min-w-[52px] shrink-0 place-items-center rounded-lg bg-q-accent px-1.5 text-[13px] font-semibold tabular-nums text-white"
                        : "grid h-9 min-w-[52px] shrink-0 place-items-center rounded-lg bg-q-sunken px-1.5 text-[13px] font-semibold tabular-nums text-q-text-3"
                    }
                  >
                    {fmtRate(r.value)}
                  </span>
                ),
              }))}
            />
          </Field>

          <div ref={resultRef} className="mt-6">
            {result ? (
              <ResultBox
                label={mode === "ht-to-ttc" ? "Montant TTC" : "Montant HT"}
                value={fmtEur(mode === "ht-to-ttc" ? result.ttc : result.ht)}
                footer={
                  <>
                    <ResetButton onClick={() => setAmount("")} />
                    <CopyButton text={copyText} />
                  </>
                }
              >
                <ResultRow label="Montant HT" value={fmtEur(result.ht)} />
                <ResultRow label={`TVA ${fmtRate(rate)}`} value={fmtEur(result.tva)} tone="accent" />
                <ResultRow label="Montant TTC" value={fmtEur(result.ttc)} strong divider />
              </ResultBox>
            ) : (
              <p className="rounded-2xl border border-dashed border-q-field px-5 py-6 text-center text-[14px] text-q-text-4">
                Saisissez un montant : le HT, la TVA et le TTC s&apos;affichent ici.
              </p>
            )}
          </div>
        </ToolPanel>

        <ToolCta
          className="hidden sm:flex"
          title="Vous facturez souvent avec la TVA ?"
          text="Qonforme calcule la TVA ligne par ligne sur vos devis et vos factures. Les devis sont gratuits et illimités."
        />
      </ToolArea>

      <ToolGuide title="Comment calculer" accent="la TVA ?">
        <Prose>
          <p>
            La <strong>taxe sur la valeur ajoutée (TVA)</strong> est un impôt indirect sur la consommation. En France, il existe quatre taux :
          </p>
          <ul>
            <li><strong>20 % (taux normal)</strong> : majorité des biens et services</li>
            <li><strong>10 % (taux intermédiaire)</strong> : restauration, transports, travaux</li>
            <li><strong>5,5 % (taux réduit)</strong> : alimentation, énergie, livres</li>
            <li><strong>2,1 % (taux super-réduit)</strong> : presse, médicaments remboursés</li>
          </ul>
          <h3>Formules</h3>
          <Formula>
            <p>HT → TTC : Montant TTC = Montant HT × (1 + Taux / 100)</p>
            <p>TTC → HT : Montant HT = Montant TTC / (1 + Taux / 100)</p>
          </Formula>
          <h3>Auto-entrepreneurs et TVA</h3>
          <p>
            Les auto-entrepreneurs bénéficient de la <strong>franchise en base de TVA</strong> tant que leur chiffre d&apos;affaires ne dépasse pas les seuils de l&apos;article 293 B du CGI : en 2026, 85 000 € pour la vente et 37 500 € pour les services (seuils majorés : 93 500 € et 41 250 €).
          </p>
        </Prose>

        <ToolFaq items={FAQ} />

        <ToolLinks
          links={[
            { href: "/outils/simulateur-charges-auto-entrepreneur", label: "Simulateur charges auto-entrepreneur" },
            { href: "/outils/simulateur-seuil-tva", label: "Simulateur seuil TVA" },
            { href: "/outils/generateur-facture-gratuite", label: "Générateur de facture gratuit" },
            { href: "/guide/tva-auto-entrepreneur", label: "Guide TVA auto-entrepreneur" },
          ]}
        />
      </ToolGuide>

      <JsonLd data={toolJsonLd("Calculateur TVA HT TTC gratuit", "/outils/calculateur-tva", "Convertissez instantanément vos montants HT en TTC et inversement avec les 4 taux de TVA français.")} />
      <JsonLd data={faqJsonLd(FAQ)} />
    </ToolShell>
  )
}
