"use client"

import { useState, useMemo, useRef } from "react"
import { Calculator, AlertTriangle, CheckCircle2, Info } from "lucide-react"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import { Callout, Field, Gauge, JsonLd, Prose, RateTable, ToolArea, ToolCta, ToolFaq, ToolGuide, ToolLinks, ToolPanel, ToolShell, faqJsonLd, toolJsonLd } from "@/components/outils/kit"
import { AmountInput, ChoiceGroup, ResetButton } from "@/components/outils/controls"
import { SEUILS_FRANCHISE_TVA as SEUILS, situationFranchise, type ActiviteFranchise } from "@/lib/outils/franchise-tva"

function fmtEur(n: number) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n) }

const FAQ = [
  { q: "Quand dois-je commencer à facturer la TVA ?", a: "Dès que votre chiffre d'affaires de l'année dépasse le seuil majoré (93 500 € pour la vente, 41 250 € pour les services) : la TVA s'applique aux opérations réalisées à partir de la date du dépassement. Si vous dépassez seulement le seuil de base, la franchise continue jusqu'au 31 décembre et la TVA s'applique au 1er janvier suivant (art. 293 B du CGI)." },
  { q: "Dois-je rembourser la TVA sur mes anciennes factures ?", a: "Non, les opérations réalisées avant le dépassement restent en franchise." },
  { q: "Puis-je récupérer la TVA sur mes achats ?", a: "Seulement une fois assujetti. En franchise, vous ne facturez ni ne récupérez la TVA." },
]

export default function SimulateurSeuilTvaPage() {
  const [activite, setActivite] = useState<ActiviteFranchise>("services")
  const [ca, setCa] = useState("")
  const resultRef = useRef<HTMLDivElement>(null)

  const seuil = SEUILS.find((s) => s.id === activite)!
  const numCa = parseFloat(ca.replace(",", ".").replace(/\s/g, "")) || 0

  const status = useMemo(() => {
    if (numCa <= 0) return null
    const situation = situationFranchise(numCa, seuil.id)
    if (situation === "franchise") return { level: "ok" as const, label: "Franchise en base", icon: CheckCircle2, message: `Vous restez sous le seuil de ${fmtEur(seuil.seuilBase)}. Pas de TVA à facturer.` }
    if (situation === "fin-au-31-decembre") return { level: "warn" as const, label: "Seuil de base dépassé", icon: AlertTriangle, message: `Vous dépassez le seuil de base (${fmtEur(seuil.seuilBase)}) sans dépasser le seuil majoré (${fmtEur(seuil.seuilMajore)}). La franchise continue jusqu'au 31 décembre ; la TVA s'appliquera au 1er janvier suivant.` }
    return { level: "danger" as const, label: "TVA obligatoire", icon: AlertTriangle, message: `Vous dépassez le seuil majoré de ${fmtEur(seuil.seuilMajore)}. La franchise cesse à la date du dépassement : la TVA s'applique aux opérations réalisées à partir de ce jour.` }
  }, [numCa, seuil])

  const gaugePercent = numCa > 0 ? Math.min((numCa / seuil.seuilMajore) * 100, 120) : 0

  const handleCaChange = (v: string) => {
    setCa(v.replace(/[^0-9.,\s]/g, ""))
    setTimeout(() => { if (resultRef.current && parseFloat(v.replace(",", ".").replace(/\s/g, "")) > 0) resultRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" }) }, 100)
  }

  return (
    <ToolShell ctaBar={<OutilsCtaBar text="La mention de franchise de TVA sur vos devis et factures." />}>
      <OutilsHero
        crumb="Simulateur seuil TVA"
        icon={<Calculator />}
        badge="Seuils 2026"
        title="Simulateur de seuil"
        accent="de franchise de TVA."
        subtitle="Vérifiez si votre chiffre d'affaires dépasse le seuil de franchise de TVA auto-entrepreneur. Seuils 2026."
      />

      <ToolArea>
        <ToolPanel>
          <Field label="Type d'activité">
            <ChoiceGroup
              label="Type d'activité"
              value={activite}
              onChange={(v) => setActivite(v as ActiviteFranchise)}
              options={SEUILS.map((s) => ({ value: s.id, label: s.label, desc: `Seuil ${fmtEur(s.seuilBase)} · Majoré ${fmtEur(s.seuilMajore)}` }))}
            />
          </Field>

          <Field label="Chiffre d'affaires annuel" htmlFor="seuil-ca" className="mt-6">
            <AmountInput id="seuil-ca" value={ca} onChange={handleCaChange} placeholder="35 000" suffix="€/an" autoFocus />
          </Field>

          <div ref={resultRef}>
            {status && (
              <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-q-line bg-q-surface-2 p-5 sm:p-6" aria-live="polite">
                <Gauge
                  label="Position par rapport au seuil majoré"
                  value={`${Math.round(gaugePercent)} %`}
                  percent={Math.min(gaugePercent, 100)}
                  tone={gaugePercent > 100 ? "danger" : gaugePercent > 80 ? "warn" : "ok"}
                  marker={(seuil.seuilBase / seuil.seuilMajore) * 100}
                  scale={["0 €", fmtEur(seuil.seuilBase), fmtEur(seuil.seuilMajore)]}
                />
                <Callout tone={status.level} icon={status.icon} title={status.label}>
                  {status.message}
                </Callout>
                {status.level === "ok" && <p className="text-[13px] text-q-text-4">Ajoutez la mention « TVA non applicable, art. 293 B du CGI » sur vos factures.</p>}
                <div className="flex justify-end">
                  <ResetButton onClick={() => setCa("")} />
                </div>
              </div>
            )}
          </div>
        </ToolPanel>

        <ToolCta
          className="hidden sm:flex"
          title="Vos mentions sur chaque document"
          text="Dans Qonforme, la mention de franchise (« TVA non applicable, art. 293 B du CGI ») s'enregistre une fois dans vos réglages et s'imprime ensuite en pied de chaque facture."
        />
      </ToolArea>

      <ToolGuide title="Seuils de franchise" accent="de TVA en 2026.">
        <Prose>
          <p>
            La <strong>franchise en base de TVA</strong> (article 293 B du CGI) dispense de facturer la TVA tant que le chiffre d&apos;affaires reste sous deux seuils : le seuil de base, apprécié sur l&apos;année précédente, et le seuil majoré, sur l&apos;année en cours.
          </p>
          <RateTable head={["Activité", "Seuil de base", "Seuil majoré"]} rows={SEUILS.map((s) => [s.label, fmtEur(s.seuilBase), fmtEur(s.seuilMajore)])} />
          <Callout tone="info" icon={Info}>
            Si vous dépassez le seuil de base sans dépasser le seuil majoré, la franchise continue jusqu&apos;au 31 décembre et la TVA s&apos;applique au 1er janvier suivant. Depuis le 1er mars 2025, la franchise n&apos;est plus conservée une seconde année.
          </Callout>
        </Prose>

        <ToolFaq items={FAQ} />

        <ToolLinks
          links={[
            { href: "/outils/calculateur-tva", label: "Calculateur TVA HT/TTC" },
            { href: "/outils/simulateur-charges-auto-entrepreneur", label: "Simulateur charges" },
            { href: "/outils/simulateur-revenu-net", label: "Simulateur revenus net" },
            { href: "/outils/generateur-facture-gratuite", label: "Générateur de facture" },
          ]}
        />
      </ToolGuide>

      <JsonLd data={toolJsonLd("Simulateur seuil TVA auto-entrepreneur", "/outils/simulateur-seuil-tva")} />
      <JsonLd data={faqJsonLd(FAQ)} />
    </ToolShell>
  )
}
