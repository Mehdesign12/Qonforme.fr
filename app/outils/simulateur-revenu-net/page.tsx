"use client"

import { useState, useMemo, useRef } from "react"
import { TrendingUp, Info } from "lucide-react"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import { Callout, Field, Formula, JsonLd, Prose, ResultBox, ResultRow, ToolArea, ToolCta, ToolFaq, ToolGuide, ToolLinks, ToolPanel, ToolShell, faqJsonLd, toolJsonLd } from "@/components/outils/kit"
import { AmountInput, CopyButton, ResetButton, Seg } from "@/components/outils/controls"
import { ACTIVITES, calculerCharges, type ActiviteId } from "@/lib/outils/charges"

function fmtEur(n: number) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n) }

const TRANCHES_IR = [
  { min: 0, max: 11294, taux: 0 },
  { min: 11294, max: 28797, taux: 11 },
  { min: 28797, max: 82341, taux: 30 },
  { min: 82341, max: 177106, taux: 41 },
  { min: 177106, max: Infinity, taux: 45 },
]

function calculerIR(revenuImposable: number): number {
  let impot = 0
  for (const t of TRANCHES_IR) {
    if (revenuImposable <= t.min) break
    const base = Math.min(revenuImposable, t.max) - t.min
    impot += base * (t.taux / 100)
  }
  return Math.round(impot)
}

const FAQ = [
  { q: "L'abattement fiscal est-il automatique ?", a: "Oui, le fisc l'applique automatiquement sur votre déclaration. Vous déclarez votre CA brut." },
  { q: "Le versement libératoire change-t-il le calcul ?", a: "Oui, il remplace l'IR progressif par un taux fixe (1 % à 2,2 %). Utilisez le simulateur de charges pour cette option." },
  { q: "Ce calcul est-il exact ?", a: "C'est une estimation pour 1 part fiscale. Votre IR réel dépend de votre foyer fiscal et autres revenus." },
]

/** Parts du CA : bleu (net), bleu clair (charges), ardoise (impôt) — avec libellés, jamais la couleur seule. */
const PARTS = [
  { key: "net", label: "Net", bar: "bg-q-accent" },
  { key: "charges", label: "Charges", bar: "bg-[var(--q-accent-on-ink)]" },
  { key: "ir", label: "IR", bar: "bg-q-placeholder" },
] as const

export default function SimulateurRevenuNetPage() {
  const [ca, setCa] = useState("")
  const [activiteId, setActiviteId] = useState<ActiviteId>("prestations-bnc")
  const [periode, setPeriode] = useState<"mensuel" | "annuel">("mensuel")
  const resultRef = useRef<HTMLDivElement>(null)

  const numCa = parseFloat(ca.replace(",", ".").replace(/\s/g, "")) || 0
  const caAnnuel = periode === "mensuel" ? numCa * 12 : numCa
  const activite = ACTIVITES.find((a) => a.id === activiteId)!

  const result = useMemo(() => {
    if (caAnnuel <= 0) return null
    const charges = calculerCharges(caAnnuel, activiteId, false)
    const revenuImposable = Math.round(caAnnuel * (1 - activite.abattement / 100))
    const impotAnnuel = calculerIR(revenuImposable)
    const netAnnuel = caAnnuel - charges.totalCharges - impotAnnuel
    return { caAnnuel, charges: charges.totalCharges, tauxCharges: charges.tauxEffectif, revenuImposable, abattement: activite.abattement, impotAnnuel, netAnnuel, netMensuel: Math.round(netAnnuel / 12) }
  }, [caAnnuel, activiteId, activite.abattement])

  const copyText = result ? `CA: ${fmtEur(result.caAnnuel)} | Charges: ${fmtEur(result.charges)} | IR: ${fmtEur(result.impotAnnuel)} | Net: ${fmtEur(result.netAnnuel)}/an (${fmtEur(result.netMensuel)}/mois)` : ""

  const handleCaChange = (v: string) => { setCa(v.replace(/[^0-9.,\s]/g, "")); setTimeout(() => { if (resultRef.current && parseFloat(v.replace(",", ".").replace(/\s/g, "")) > 0) resultRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" }) }, 100) }

  // Répartition du CA
  const netPercent = result ? Math.max(0, (result.netAnnuel / result.caAnnuel) * 100) : 0
  const chargesPercent = result ? (result.charges / result.caAnnuel) * 100 : 0
  const irPercent = result ? (result.impotAnnuel / result.caAnnuel) * 100 : 0
  const parts = { net: netPercent, charges: chargesPercent, ir: irPercent }

  return (
    <ToolShell ctaBar={<OutilsCtaBar text="Suivez ce que vous avez encaissé, mois par mois." />}>
      <OutilsHero
        crumb="Simulateur revenus net"
        icon={<TrendingUp />}
        badge="Barèmes 2026"
        title="Simulateur de revenu net"
        accent="auto-entrepreneur."
        subtitle="De votre chiffre d'affaires brut à votre revenu net réel. Charges sociales + impôt sur le revenu."
      />

      <ToolArea>
        <ToolPanel>
          <Field label="Type d'activité" htmlFor="net-activite">
            <select id="net-activite" value={activiteId} onChange={(e) => setActiviteId(e.target.value as ActiviteId)} className="q-input">
              {ACTIVITES.map((a) => <option key={a.id} value={a.id}>{a.label} (abattement {a.abattement} %)</option>)}
            </select>
          </Field>

          <Field
            label="Chiffre d'affaires"
            htmlFor="net-ca"
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
            <AmountInput id="net-ca" value={ca} onChange={handleCaChange} placeholder={periode === "mensuel" ? "3 000" : "36 000"} autoFocus />
          </Field>

          <div ref={resultRef}>
            {result && (
              <div className="mt-6 flex flex-col gap-4">
                <ResultBox
                  label="Revenu net par mois"
                  value={fmtEur(result.netMensuel)}
                  tone="ok"
                  sub={`Soit ${fmtEur(result.netAnnuel)} par an`}
                  footer={
                    <>
                      <ResetButton onClick={() => setCa("")} />
                      <CopyButton text={copyText} label="Copier" />
                    </>
                  }
                >
                  <div className="flex flex-col gap-2">
                    <p className="text-[13px] text-q-text-3">Répartition de votre CA</p>
                    <div className="flex h-3 overflow-hidden rounded-full bg-[var(--q-line-soft)]" aria-hidden>
                      {PARTS.map((p) => (
                        <span key={p.key} className={`${p.bar} h-full transition-[width] duration-500 motion-reduce:transition-none`} style={{ width: `${parts[p.key]}%` }} />
                      ))}
                    </div>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-medium text-q-text-3">
                      {PARTS.map((p) => (
                        <li key={p.key} className="inline-flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${p.bar}`} aria-hidden />
                          {p.label} <span className="tabular-nums">{Math.round(parts[p.key])}&nbsp;%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <ResultRow label="Chiffre d'affaires annuel" value={fmtEur(result.caAnnuel)} divider />
                  <ResultRow label={`Charges sociales (${String(result.tauxCharges).replace(".", ",")} %)`} value={`−${fmtEur(result.charges)}`} tone="danger" />
                  <ResultRow label={`Revenu imposable (abattement ${result.abattement} %)`} value={fmtEur(result.revenuImposable)} tone="muted" />
                  <ResultRow label="Impôt sur le revenu (estimé)" value={`−${fmtEur(result.impotAnnuel)}`} tone="danger" />
                  <ResultRow label="Revenu net annuel" value={fmtEur(result.netAnnuel)} tone="ok" strong divider />
                  <ResultRow label="Soit par mois" value={fmtEur(result.netMensuel)} tone="ok" strong />
                </ResultBox>

                <Callout tone="neutral" icon={Info}>
                  L&apos;IR est estimé pour une personne seule (1 part). Le calcul réel dépend de votre situation familiale et de vos autres revenus.
                </Callout>
              </div>
            )}
          </div>
          {!result && numCa > 0 && (
            <div className="mt-4 flex justify-center">
              <ResetButton onClick={() => setCa("")} />
            </div>
          )}
        </ToolPanel>

        <ToolCta
          className="hidden sm:flex"
          title="Suivez votre chiffre d'affaires au fil des factures"
          text="Le tableau de bord de Qonforme montre ce que vous avez encaissé et ce qui reste à encaisser, mois par mois."
        />
      </ToolArea>

      <ToolGuide title="Comment calculer son revenu net" accent="d'auto-entrepreneur ?">
        <Prose>
          <p>Le revenu net d&apos;un auto-entrepreneur se calcule en <strong>3 étapes</strong> :</p>
          <ol>
            <li><strong>Cotisations sociales</strong> : un pourcentage du CA (12,3 % à 23,2 % selon l&apos;activité)</li>
            <li><strong>Abattement fiscal</strong> : le fisc applique un abattement forfaitaire sur le CA (34 % à 71 %) pour déterminer le revenu imposable</li>
            <li><strong>Impôt sur le revenu</strong> : barème progressif appliqué au revenu imposable (0 % à 45 %)</li>
          </ol>
          <Formula>
            <p>Net = CA − Cotisations − Impôt sur le revenu</p>
          </Formula>
        </Prose>

        <ToolFaq items={FAQ} />

        <ToolLinks
          links={[
            { href: "/outils/simulateur-charges-auto-entrepreneur", label: "Simulateur charges" },
            { href: "/outils/simulateur-seuil-tva", label: "Simulateur seuil TVA" },
            { href: "/outils/calculateur-tva", label: "Calculateur TVA" },
            { href: "/outils/generateur-facture-gratuite", label: "Générateur de facture" },
          ]}
        />
      </ToolGuide>

      <JsonLd data={toolJsonLd("Simulateur revenus net auto-entrepreneur", "/outils/simulateur-revenu-net")} />
      <JsonLd data={faqJsonLd(FAQ)} />
    </ToolShell>
  )
}
