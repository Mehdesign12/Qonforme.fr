"use client"

import { useMemo, useRef, useState } from "react"
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
import { TVA_RATES, depuisHt, depuisTtc } from "@/lib/outils/tva"
import { filtrerSaisieMontant, parseMontant } from "@/lib/outils/montant"

function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n)
}

function fmtRate(r: number): string {
  return `${String(r).replace(".", ",")}\u00a0%`
}

/** Au-delà, le calcul en centimes entiers sortirait des entiers exacts. */
const MONTANT_MAX = 1_000_000_000

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
  const numAmount = parseMontant(amount)
  // Saisie non vide mais illisible, négative ou démesurée : message sous le champ
  const erreur =
    amount.trim() === ""
      ? ""
      : numAmount === null
        ? "Montant invalide : saisissez par exemple 1 234,56."
        : numAmount < 0
          ? "Le montant doit être positif."
          : numAmount > MONTANT_MAX
            ? "Montant trop élevé (1 milliard d'euros au plus)."
            : ""

  // HT + TVA = TTC au centime : la TVA (ou le HT) est arrondie au centime, l'autre montant s'en déduit
  const result = useMemo(() => {
    if (erreur || numAmount === null || numAmount <= 0) return null
    return mode === "ht-to-ttc" ? depuisHt(numAmount, rate) : depuisTtc(numAmount, rate)
  }, [erreur, numAmount, rate, mode])

  const handleSwapMode = () => {
    setMode((m) => (m === "ht-to-ttc" ? "ttc-to-ht" : "ht-to-ttc"))
    setAmount("")
  }

  const handleAmountChange = (v: string) => {
    setAmount(filtrerSaisieMontant(v))
    // Fait défiler jusqu'au résultat sur mobile
    setTimeout(() => {
      if (resultRef.current && (parseMontant(v) ?? 0) > 0) {
        resultRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" })
      }
    }, 100)
  }

  const copyText = result ? `HT : ${fmtEur(result.ht)} | TVA (${fmtRate(rate)}) : ${fmtEur(result.tva)} | TTC : ${fmtEur(result.ttc)}` : ""

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

          <Field label={`Montant ${mode === "ht-to-ttc" ? "HT" : "TTC"}`} htmlFor="tva-montant" className="mt-6" hint={erreur ? undefined : "Virgule ou point pour les centimes : 1 234,56 ou 1234.56."}>
            <AmountInput id="tva-montant" value={amount} onChange={handleAmountChange} placeholder={mode === "ht-to-ttc" ? "1 000" : "1 200"} autoFocus ariaDescribedBy={erreur ? "tva-montant-err" : undefined} invalid={!!erreur} />
            {erreur && <p id="tva-montant-err" className="q-field-error">{erreur}</p>}
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
            <li><strong>20 % (taux normal)</strong> : majorité des biens et services, construction neuve</li>
            <li><strong>10 % (taux intermédiaire)</strong> : travaux d&apos;amélioration, de transformation, d&apos;aménagement et d&apos;entretien d&apos;un logement achevé depuis plus de deux ans (art. 279-0 bis du CGI), restauration, transports</li>
            <li><strong>5,5 % (taux réduit)</strong> : travaux de rénovation énergétique d&apos;un logement achevé depuis plus de deux ans (art. 278-0 bis A du CGI), alimentation, livres</li>
            <li><strong>2,1 % (taux super-réduit)</strong> : presse, médicaments remboursables</li>
          </ul>
          <h3>Formules</h3>
          <Formula>
            <p>HT → TTC : TVA = Montant HT × Taux / 100, arrondie au centime ; TTC = HT + TVA</p>
            <p>TTC → HT : Montant HT = Montant TTC / (1 + Taux / 100), arrondi au centime ; TVA = TTC − HT</p>
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
            { href: "/guide/facture-sans-tva", label: "Guide : facture sans TVA" },
          ]}
        />
      </ToolGuide>

      <JsonLd data={toolJsonLd("Calculateur TVA HT TTC gratuit", "/outils/calculateur-tva", "Convertissez instantanément vos montants HT en TTC et inversement avec les 4 taux de TVA français.")} />
      <JsonLd data={faqJsonLd(FAQ)} />
    </ToolShell>
  )
}
