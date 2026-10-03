"use client"

import { useState, useMemo, useRef } from "react"
import { TrendingUp, Info } from "lucide-react"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import { Callout, Field, Gauge, JsonLd, Prose, RateTable, ResultBox, ResultRow, StatGrid, ToolArea, ToolCta, ToolFaq, ToolGuide, ToolLinks, ToolPanel, ToolShell, faqJsonLd, toolJsonLd } from "@/components/outils/kit"
import { AmountInput, ChoiceGroup, CopyButton, ResetButton, Seg, SwitchRow } from "@/components/outils/controls"
import { ACTIVITES, calculerCharges, type ActiviteId } from "@/lib/outils/charges"
import { filtrerSaisieMontant, parseMontant } from "@/lib/outils/montant"

function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n)
}

const fmtInt = (n: number) => new Intl.NumberFormat("fr-FR").format(n)

const FAQ = [
  { q: "Quand payer mes cotisations URSSAF ?", a: "Chaque mois ou trimestre sur autoentrepreneur.urssaf.fr. Déclaration obligatoire même si CA = 0 €." },
  { q: "Que se passe-t-il si je dépasse le plafond ?", a: "Vous quittez le régime au 1er janvier qui suit deux années civiles consécutives de dépassement (plafonds 2026 : 203 100 € pour la vente, 83 600 € pour les services)." },
  { q: "Le versement libératoire est-il intéressant ?", a: "Intéressant si votre taux marginal d'imposition dépasse 1 % à 2,2 %." },
]

export default function SimulateurChargesPage() {
  const [ca, setCa] = useState("")
  const [activiteId, setActiviteId] = useState<ActiviteId>("prestations-bnc")
  const [versementLiberatoire, setVersementLiberatoire] = useState(false)
  const [periode, setPeriode] = useState<"mensuel" | "annuel">("mensuel")
  const resultRef = useRef<HTMLDivElement>(null)

  const parsed = parseMontant(ca)
  const erreurCa = ca.trim() && (parsed === null || parsed < 0) ? "Montant invalide : saisissez par exemple 3 000 ou 1 234,56." : ""
  const numCa = erreurCa ? 0 : (parsed ?? 0)
  const caAnnuel = periode === "mensuel" ? numCa * 12 : numCa
  const caMensuel = periode === "annuel" ? numCa / 12 : numCa
  const activite = ACTIVITES.find((a) => a.id === activiteId)!

  const resultAnnuel = useMemo(() => calculerCharges(caAnnuel, activiteId, versementLiberatoire), [caAnnuel, activiteId, versementLiberatoire])
  const resultMensuel = useMemo(() => calculerCharges(caMensuel, activiteId, versementLiberatoire), [caMensuel, activiteId, versementLiberatoire])

  const depassePlafond = caAnnuel > activite.plafondCA

  // Jauge : taux effectif rapporté à 30 %
  const gaugePercent = Math.min(resultMensuel.tauxEffectif / 30 * 100, 100)

  const copyText = `CA mensuel: ${fmtEur(caMensuel)} | Charges: ${fmtEur(resultMensuel.totalCharges)} (${resultMensuel.tauxEffectif}%) | Net: ${fmtEur(resultMensuel.revenuNet)}`

  const handleCaChange = (v: string) => {
    setCa(filtrerSaisieMontant(v))
    setTimeout(() => {
      if (resultRef.current && (parseMontant(v) ?? 0) > 0) {
        resultRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" })
      }
    }, 100)
  }

  return (
    <ToolShell ctaBar={<OutilsCtaBar text="Suivez ce que vous avez encaissé, mois par mois." />}>
      <OutilsHero
        crumb="Simulateur charges"
        icon={<TrendingUp />}
        badge="Barèmes 2026"
        title="Simulateur de charges"
        accent="auto-entrepreneur."
        subtitle="Calculez vos cotisations URSSAF, CFP et versement libératoire selon votre CA et votre activité. Barèmes 2026."
      />

      <ToolArea width="md">
        <ToolPanel>
          <Field label="Type d'activité">
            <ChoiceGroup
              label="Type d'activité"
              value={activiteId}
              onChange={(id) => setActiviteId(id as ActiviteId)}
              options={ACTIVITES.map((a) => ({
                value: a.id,
                label: a.label,
                desc: `Cotisations ${String(a.tauxCotisations).replace(".", ",")} % · Plafond ${fmtInt(a.plafondCA)} €`,
              }))}
            />
          </Field>

          <Field
            label="Chiffre d'affaires"
            htmlFor="charges-ca"
            className="mt-6"
            aside={
              <Seg
                size="sm"
                label="Période"
                value={periode}
                onChange={(p) => { setPeriode(p); setCa("") }}
                options={[
                  { value: "mensuel", label: "Mensuel" },
                  { value: "annuel", label: "Annuel" },
                ]}
              />
            }
          >
            <AmountInput id="charges-ca" value={ca} onChange={handleCaChange} placeholder={periode === "mensuel" ? "3 000" : "36 000"} suffix={periode === "mensuel" ? "€/mois" : "€/an"} invalid={!!erreurCa} ariaDescribedBy={erreurCa ? "charges-ca-err" : undefined} />
            {erreurCa && <p id="charges-ca-err" className="q-field-error">{erreurCa}</p>}
          </Field>

          <div className="mt-5">
            <SwitchRow
              checked={versementLiberatoire}
              onChange={setVersementLiberatoire}
              label="Versement libératoire"
              desc={`+${String(activite.tauxVersementLiberatoire).replace(".", ",")} % sur le CA`}
            />
          </div>

          {depassePlafond && numCa > 0 && (
            <Callout tone="warn" icon={Info} title="Plafond dépassé" className="mt-5">
              Votre CA annuel ({fmtEur(caAnnuel)}) dépasse {fmtInt(activite.plafondCA)} €.
            </Callout>
          )}

          <div ref={resultRef}>
            {numCa > 0 && (
              <div className="mt-6 flex flex-col gap-4">
                <ResultBox
                  label="Revenu net par mois"
                  value={fmtEur(resultMensuel.revenuNet)}
                  tone="ok"
                  footer={
                    <>
                      <ResetButton onClick={() => setCa("")} />
                      <CopyButton text={copyText} />
                    </>
                  }
                >
                  <Gauge label="Taux de charges effectif" value={`${String(resultMensuel.tauxEffectif).replace(".", ",")} %`} percent={gaugePercent} />
                  <ResultRow label="Chiffre d'affaires" value={fmtEur(caMensuel)} />
                  <ResultRow label={`Cotisations (${String(activite.tauxCotisations).replace(".", ",")} %)`} value={`−${fmtEur(resultMensuel.cotisations)}`} tone="danger" />
                  <ResultRow label={`CFP (${String(activite.tauxCFP).replace(".", ",")} %)`} value={`−${fmtEur(resultMensuel.cfp)}`} tone="danger" />
                  {resultMensuel.versementLiberatoire !== null && (
                    <ResultRow label={`VL (${String(activite.tauxVersementLiberatoire).replace(".", ",")} %)`} value={`−${fmtEur(resultMensuel.versementLiberatoire)}`} tone="danger" />
                  )}
                  <ResultRow label="Revenu net" value={fmtEur(resultMensuel.revenuNet)} tone="ok" strong divider />
                </ResultBox>

                <div>
                  <p className="mb-2 text-[13px] font-semibold text-q-text-3">Projection annuelle</p>
                  <StatGrid
                    items={[
                      { label: "CA", value: fmtEur(caAnnuel) },
                      { label: "Charges", value: `−${fmtEur(resultAnnuel.totalCharges)}`, tone: "danger" },
                      { label: "Net", value: fmtEur(resultAnnuel.revenuNet), tone: "ok" },
                    ]}
                  />
                </div>
              </div>
            )}
          </div>
        </ToolPanel>

        <ToolCta
          className="hidden sm:flex"
          title="Suivez votre chiffre d'affaires au fil des factures"
          text="Le tableau de bord de Qonforme montre ce que vous avez encaissé et ce qui reste à encaisser, mois par mois."
        />
      </ToolArea>

      <ToolGuide title="Comprendre les charges" accent="auto-entrepreneur en 2026.">
        <Prose>
          <p>
            En tant qu&apos;<strong>auto-entrepreneur</strong>, vous payez des <strong>cotisations sociales proportionnelles</strong> à votre CA.
          </p>
          <RateTable
            head={["Activité", "Taux", "Plafond"]}
            rows={ACTIVITES.map((a) => [a.label, `${String(a.tauxCotisations).replace(".", ",")} %`, `${fmtInt(a.plafondCA)} €`])}
          />
        </Prose>

        <ToolFaq items={FAQ} />

        <ToolLinks
          links={[
            { href: "/outils/calculateur-tva", label: "Calculateur TVA HT/TTC" },
            { href: "/outils/simulateur-seuil-tva", label: "Simulateur seuil TVA" },
            { href: "/outils/generateur-facture-gratuite", label: "Générateur de facture gratuit" },
            { href: "/outils/simulateur-revenu-net", label: "Simulateur revenus net" },
          ]}
        />
      </ToolGuide>

      <JsonLd data={toolJsonLd("Simulateur charges auto-entrepreneur 2026", "/outils/simulateur-charges-auto-entrepreneur")} />
      <JsonLd data={faqJsonLd(FAQ)} />
    </ToolShell>
  )
}
