"use client"

import { useState, useMemo, useRef } from "react"
import { TrendingUp, Info } from "lucide-react"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import { Callout, Field, Formula, JsonLd, Prose, ResultBox, ResultRow, ToolArea, ToolCta, ToolFaq, ToolGuide, ToolLinks, ToolPanel, ToolShell, faqJsonLd, toolJsonLd } from "@/components/outils/kit"
import { AmountInput, CopyButton, ResetButton, Seg } from "@/components/outils/controls"
import { ACTIVITES, type ActiviteId } from "@/lib/outils/charges"
import { DECOTE_PERSONNE_SEULE, calculerRevenuNet, pourcentagesEntiers } from "@/lib/outils/revenu-net"
import { filtrerSaisieMontant, parseMontant } from "@/lib/outils/montant"

function fmtEur(n: number) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n) }

const FAQ = [
  { q: "L'abattement fiscal est-il automatique ?", a: "Oui, le fisc l'applique automatiquement sur votre déclaration. Vous déclarez votre CA brut." },
  { q: "Le versement libératoire change-t-il le calcul ?", a: "Oui, il remplace l'IR progressif par un taux fixe (1 % à 2,2 %). Utilisez le simulateur de charges pour cette option." },
  { q: "Ce calcul est-il exact ?", a: "C'est une estimation pour 1 part fiscale, au barème 2026 des revenus 2025, décote comprise. Votre impôt réel dépend de votre foyer fiscal et de vos autres revenus." },
  { q: "Qu'est-ce que la décote ?", a: `Une réduction d'impôt pour les petits montants : pour une personne seule dont l'impôt brut est inférieur à ${DECOTE_PERSONNE_SEULE.plafondImpotBrut.toLocaleString("fr-FR")} €, elle vaut ${DECOTE_PERSONNE_SEULE.forfait} € moins 45,25 % de l'impôt brut (art. 197 du CGI). Le simulateur l'applique.` },
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

  const parsed = parseMontant(ca)
  const erreurCa = ca.trim() && (parsed === null || parsed < 0) ? "Montant invalide : saisissez par exemple 3 000 ou 1 234,56." : ""
  const numCa = erreurCa ? 0 : (parsed ?? 0)
  const caAnnuel = periode === "mensuel" ? Math.round(numCa * 12 * 100) / 100 : numCa

  const result = useMemo(() => (caAnnuel > 0 ? calculerRevenuNet(caAnnuel, activiteId) : null), [caAnnuel, activiteId])

  const copyText = result ? `CA : ${fmtEur(result.caAnnuel)} | Charges : ${fmtEur(result.charges)} | Impôt : ${fmtEur(result.impotAnnuel)} | Net : ${fmtEur(result.netAnnuel)} par an (${fmtEur(result.netMensuel)} par mois)` : ""

  const handleCaChange = (v: string) => { setCa(filtrerSaisieMontant(v)); setTimeout(() => { if (resultRef.current && (parseMontant(v) ?? 0) > 0) resultRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" }) }, 100) }

  // Répartition du CA : largeurs exactes pour la barre, pourcentages entiers qui totalisent 100 pour la légende
  const brut = result ? [Math.max(0, result.netAnnuel), result.charges, result.impotAnnuel] : [0, 0, 0]
  const total = brut.reduce((s, v) => s + v, 0) || 1
  const [netPct, chargesPct, irPct] = pourcentagesEntiers(brut)
  const largeurs = { net: (brut[0] / total) * 100, charges: (brut[1] / total) * 100, ir: (brut[2] / total) * 100 }
  const parts = { net: netPct, charges: chargesPct, ir: irPct }

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
            <AmountInput id="net-ca" value={ca} onChange={handleCaChange} placeholder={periode === "mensuel" ? "3 000" : "36 000"} autoFocus invalid={!!erreurCa} ariaDescribedBy={erreurCa ? "net-ca-err" : undefined} />
            {erreurCa && <p id="net-ca-err" className="q-field-error">{erreurCa}</p>}
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
                        <span key={p.key} className={`${p.bar} h-full transition-[width] duration-500 motion-reduce:transition-none`} style={{ width: `${largeurs[p.key]}%` }} />
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
                  {result.decote > 0 && <ResultRow label="Impôt brut, avant décote" value={fmtEur(result.impotBrut)} tone="muted" />}
                  {result.decote > 0 && <ResultRow label="Décote" value={`−${fmtEur(result.decote)}`} tone="muted" />}
                  <ResultRow label="Impôt sur le revenu (estimé)" value={result.impotAnnuel > 0 ? `−${fmtEur(result.impotAnnuel)}` : fmtEur(0)} tone="danger" />
                  <ResultRow label="Revenu net annuel" value={fmtEur(result.netAnnuel)} tone="ok" strong divider />
                  <ResultRow label="Soit par mois" value={fmtEur(result.netMensuel)} tone="ok" strong />
                </ResultBox>

                <Callout tone="neutral" icon={Info}>
                  L&apos;impôt est estimé pour une personne seule (1 part), au barème 2026 des revenus 2025, décote comprise. Le calcul réel dépend de votre situation familiale et de vos autres revenus.
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
            <li><strong>Cotisations sociales</strong> : un pourcentage du CA (12,3 % à 25,6 % selon l&apos;activité en 2026)</li>
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
